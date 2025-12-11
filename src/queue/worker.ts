import { GenelineClient } from '../geneline/client';
import { logger, logEvent } from '../utils/logger';
import { QueuedMessage } from './manager';
import { config } from '../config/env';
import { AgentLoop } from '../agent/agent-loop';
import { ConversationHistory } from '../agent/conversation-history';
import { ToolRegistry } from '../agent/tools/tool-registry';
import { createKnowledgeSearchTool } from '../agent/tools/knowledge-search-tool';

export class MessageWorker {
    private genelineClient: GenelineClient;
    private agentLoop: AgentLoop | null = null;
    private conversationHistory: ConversationHistory | null = null;

    constructor() {
        this.genelineClient = new GenelineClient();

        // Initialize agent if enabled
        if (config.agent.enabled) {
            this.initializeAgent();
        }
    }

    /**
     * Initialize the agent framework
     */
    private initializeAgent(): void {
        try {
            logger.info('Initializing agent framework');

            // Create conversation history manager
            this.conversationHistory = new ConversationHistory(
                1000, // max chats
                config.agent.conversationHistoryLimit
            );

            // Create tool registry
            const toolRegistry = new ToolRegistry();

            // Register tools
            const knowledgeSearchTool = createKnowledgeSearchTool();
            toolRegistry.registerTool(knowledgeSearchTool);

            // Register web search tool for current information
            const { createWebSearchTool } = require('../agent/tools/web-search-tool');
            const webSearchTool = createWebSearchTool();
            toolRegistry.registerTool(webSearchTool);

            // Register symptom triage tool for health guidance
            const { createSymptomTriageTool } = require('../agent/tools/symptom-triage-tool');
            const symptomTriageTool = createSymptomTriageTool();
            toolRegistry.registerTool(symptomTriageTool);

            // Register health alerts tool for public health information
            const { createHealthAlertsTool, createEmergencyAlertsTool } = require('../agent/tools/health-alerts-tool');
            const healthAlertsTool = createHealthAlertsTool();
            toolRegistry.registerTool(healthAlertsTool);
            const emergencyAlertsTool = createEmergencyAlertsTool();
            toolRegistry.registerTool(emergencyAlertsTool);

            // Register escalation tools for human handoff
            const { createEscalationTool, createEscalationCheckTool } = require('../agent/tools/escalation-tool');
            const escalationTool = createEscalationTool();
            toolRegistry.registerTool(escalationTool);
            const escalationCheckTool = createEscalationCheckTool();
            toolRegistry.registerTool(escalationCheckTool);

            // Register find facility tool for location-based search
            const { createFindFacilityTool } = require('../agent/tools/find-facility-tool');
            const findFacilityTool = createFindFacilityTool();
            toolRegistry.registerTool(findFacilityTool);

            // Create agent loop
            this.agentLoop = new AgentLoop(
                this.conversationHistory,
                toolRegistry,
                config.agent.maxIterations
            );

            logger.info('Agent framework initialized successfully', {
                maxIterations: config.agent.maxIterations,
                conversationHistoryLimit: config.agent.conversationHistoryLimit,
                registeredTools: toolRegistry.getAllTools().length,
            });

        } catch (error) {
            logger.error('Failed to initialize agent framework', error as Error);
            // Fall back to direct mode
            this.agentLoop = null;
            this.conversationHistory = null;
        }
    }

    /**
     * Process a queued message
     */
    async processMessage(message: QueuedMessage): Promise<void> {
        const { chatId, messageId, messageText, isGroup, userName, mediaAttachments, isVoiceMessage } = message;

        try {
            logEvent.incomingMessage(chatId, messageId, !!mediaAttachments?.length);

            // Use agent mode if enabled and initialized
            if (config.agent.enabled && this.agentLoop) {
                return this.processWithAgent(chatId, messageId, messageText, isVoiceMessage);
            } else {
                return this.processDirectly(chatId, messageId, messageText, isGroup, userName, mediaAttachments, isVoiceMessage);
            }

        } catch (error) {
            logEvent.error('Failed to process message', error as Error, {
                chatId,
                messageId,
            });

            // Send fallback message
            return this.sendFallbackMessage(chatId);
        }
    }

    /**
     * Process message using agent framework
     */
    private async processWithAgent(chatId: string, messageId: string, messageText: string, isVoiceMessage?: boolean): Promise<void> {
        logger.info('Processing message with agent', { chatId, messageId, isVoiceMessage });

        // Get user role for role-based prompting
        const phone = chatId.split('@')[0];
        const { getUserRoleByPhone } = await import('../utils/role-manager');
        const userRole = await getUserRoleByPhone(phone);

        // Get database userId for escalation tools
        const { getUserIdByPhone } = await import('../utils/database-sync');
        const userId = await getUserIdByPhone(phone);

        // Detect and track intent
        const { detectAndTrackIntent } = await import('../utils/intent-detector');
        const intentResult = await detectAndTrackIntent(messageText, messageId);

        logger.debug('User context retrieved for agent processing', {
            chatId,
            userRole,
            userId,
            intent: intentResult.intent,
            intentConfidence: intentResult.confidence
        });

        const agentResponse = await this.agentLoop!.run(chatId, messageText, userRole, userId || undefined, phone);

        logger.info('Agent processing completed', {
            chatId,
            messageId,
            userRole,
            userId,
            iterations: agentResponse.iterations,
            toolCallsCount: agentResponse.toolCallsCount,
            responseLength: agentResponse.response.length,
            shouldEscalate: agentResponse.shouldEscalate,
            confidence: agentResponse.confidence
        });

        // Handle escalation if needed
        if (agentResponse.shouldEscalate) {
            await this.handleEscalation(chatId, messageId, messageText, agentResponse, userRole);
        }

        // Send response (voice or text based on original message type)
        return this.sendResponseWithVoice(chatId, messageId, agentResponse.response, isVoiceMessage);
    }

    /**
     * Process message directly (legacy mode)
     */
    private async processDirectly(
        chatId: string,
        messageId: string,
        messageText: string,
        isGroup: boolean,
        userName?: string,
        mediaAttachments?: Array<{ filename: string; mime: string; data_base64: string }>,
        isVoiceMessage?: boolean
    ): Promise<void> {
        logger.info('Processing message directly (legacy mode)', { chatId, messageId, isVoiceMessage });

        // Build Geneline request
        const request = GenelineClient.buildRequest(
            chatId,
            messageId,
            messageText,
            isGroup,
            userName,
            mediaAttachments
        );

        logEvent.aiRequestSent(chatId, messageId);

        // Call Geneline-X API
        const aiResponse = await this.genelineClient.sendMessage(request);

        logEvent.aiResponseReceived(chatId, messageId, aiResponse.length);

        // Send response (voice or text based on original message type)
        return this.sendResponseWithVoice(chatId, messageId, aiResponse, isVoiceMessage);
    }

    /**
     * Send AI response back to WhatsApp
     * This will be overridden to use the actual WhatsApp client
     */
    private async sendResponse(chatId: string, messageId: string, response: string): Promise<void> {
        // Placeholder - will be set by the main app
        logger.debug('Sending response to WhatsApp', {
            chatId,
            messageId,
            responseLength: response.length,
        });
    }

    /**
     * Send voice message to WhatsApp
     * This will be overridden to use the actual WhatsApp client
     */
    private async sendVoiceResponse(chatId: string, audioBuffer: Buffer): Promise<void> {
        // Placeholder - will be set by the main app
        logger.debug('Sending voice response to WhatsApp', {
            chatId,
            audioSize: audioBuffer.length,
        });
    }

    /**
     * Send response - always sends text response
     * Voice messages are transcribed but response is always text
     */
    private async sendResponseWithVoice(
        chatId: string,
        messageId: string,
        response: string,
        isVoiceMessage?: boolean
    ): Promise<void> {
        // Log if this was originally a voice message (for debugging)
        if (isVoiceMessage) {
            logger.info('Voice message processed, sending text response', {
                chatId,
                responseLength: response.length,
            });
        }

        // Always send text response
        return this.sendResponse(chatId, messageId, response);
    }

    /**
     * Send fallback message on error
     */
    private async sendFallbackMessage(chatId: string): Promise<void> {
        logger.debug('Sending fallback message', { chatId });
    }

    /**
     * Set the response sender function (injected from WhatsApp client)
     */
    setResponseSender(sender: (chatId: string, messageId: string, response: string) => Promise<void>): void {
        this.sendResponse = sender;
    }

    /**
     * Set the voice response sender function (injected from WhatsApp client)
     */
    setVoiceResponseSender(sender: (chatId: string, audioBuffer: Buffer) => Promise<void>): void {
        this.sendVoiceResponse = sender;
    }

    /**
     * Set the fallback message sender function
     */
    setFallbackSender(sender: (chatId: string) => Promise<void>): void {
        this.sendFallbackMessage = sender;
    }

    /**
     * Handle escalation when agent determines human intervention is needed
     */
    private async handleEscalation(
        chatId: string,
        messageId: string,
        messageText: string,
        agentResponse: { shouldEscalate?: boolean; escalationReason?: string; confidence?: number },
        userRole?: string
    ): Promise<void> {
        try {
            logger.info('Creating escalation from agent detection', {
                chatId,
                messageId,
                userRole,
                reason: agentResponse.escalationReason,
                confidence: agentResponse.confidence
            });

            // Get user ID from phone number
            const phone = chatId.split('@')[0];
            const { getUserIdByPhone } = await import('../utils/database-sync');
            const userId = await getUserIdByPhone(phone);

            if (!userId) {
                logger.error('Cannot create escalation: user not found', { phone });
                return;
            }

            // Get message ID from database
            const { getSupabaseClient } = await import('../config/supabase');
            const supabase = getSupabaseClient();

            const { data: dbMessage } = await supabase
                .from('messages')
                .select('id')
                .eq('user_id', userId)
                .eq('content', messageText)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!dbMessage) {
                logger.error('Cannot create escalation: message not found in database');
                return;
            }

            // Create escalation
            const { createEscalation } = await import('../utils/escalation-detector');

            const escalationId = await createEscalation({
                userId,
                messageId: dbMessage.id,
                reason: agentResponse.escalationReason || 'Agent detected need for human assistance',
                triggerType: agentResponse.confidence !== undefined && agentResponse.confidence < 0.5 ? 'low_confidence' : 'failed_intent',
                priority: agentResponse.confidence !== undefined && agentResponse.confidence < 0.3 ? 'high' : 'normal',
                messageContent: messageText
            });

            if (escalationId) {
                logger.info('Escalation created successfully', {
                    escalationId,
                    userId,
                    messageId: dbMessage.id,
                    userRole
                });

                // Get role-based escalation message
                const { getEscalationMessage } = await import('../utils/role-manager');
                const { parseRole } = await import('../types/role-types');
                const role = parseRole(userRole);

                const acknowledgment = getEscalationMessage(role, agentResponse.escalationReason || 'escalation');
                await this.sendResponse(chatId, messageId, acknowledgment);

                // Forward escalation to health workers
                try {
                    const { forwardToHealthWorkers, getUserInfoForEscalation } = await import('../utils/escalation-manager');

                    // Get user info from database
                    const userInfo = await getUserInfoForEscalation(userId);

                    if (!userInfo) {
                        logger.error('Cannot forward escalation: user info not found in database', { userId });
                        return;
                    }

                    // Retrieve past 10 messages from database for conversation summary
                    let conversationSummary = 'Escalation triggered by agent';
                    try {
                        const { data: messages } = await supabase
                            .from('messages')
                            .select('content, sender, created_at')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false })
                            .limit(10);

                        if (messages && messages.length > 0) {
                            // Build conversation text for AI summarization
                            const conversationText = messages.reverse().map(msg => {
                                const speaker = msg.sender === 'user' ? 'User' : 'Bot';
                                return `${speaker}: ${msg.content}`;
                            }).join('\n');

                            // Use AI to generate a natural language summary
                            try {
                                const summaryPrompt = `Summarize the following conversation between a user and a health bot in 2-3 concise sentences. Focus on the user's main health concern and any key symptoms or requests mentioned:\n\n${conversationText}`;

                                const aiSummary = await this.genelineClient.sendMessage({
                                    chatbotId: config.geneline.chatbotId,
                                    email: `summarizer@system.local`,
                                    message: summaryPrompt,
                                    metadata: {
                                        whatsappChatId: chatId,
                                        messageId: messageId,
                                        isGroup: false,
                                        purpose: 'escalation_summary'
                                    }
                                });

                                conversationSummary = aiSummary.trim();
                            } catch (aiError) {
                                logger.error('Failed to generate AI summary, using formatted list', aiError as Error);
                                // Fallback to simple formatted list
                                conversationSummary = messages.reverse().map((msg, idx) => {
                                    const speaker = msg.sender === 'user' ? 'User' : 'Bot';
                                    const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
                                    return `${idx + 1}. ${speaker}: ${preview}`;
                                }).join('\n');
                            }
                        }
                    } catch (summaryError) {
                        logger.error('Failed to retrieve conversation history for summary', summaryError as Error);
                        // Continue with default summary
                    }

                    const report = {
                        userId,
                        userPhone: userInfo.phone,
                        userName: userInfo.name || 'Unknown User',
                        reason: agentResponse.escalationReason || 'Agent detected need for human assistance',
                        conversationSummary,
                        latestMessage: messageText,
                        timestamp: new Date().toISOString(),
                        urgencyLevel: (agentResponse.confidence !== undefined && agentResponse.confidence < 0.3 ? 'urgent' : 'normal') as 'emergency' | 'urgent' | 'normal'
                    };

                    const sendFn = async (targetChatId: string, msg: string) => {
                        await this.sendResponse(targetChatId, messageId, msg);
                    };

                    const result = await forwardToHealthWorkers(report, sendFn);
                    if (result.success) {
                        logger.info('Escalation forwarded to health workers', {
                            escalationId,
                            notifiedContacts: result.notifiedContacts
                        });
                    }
                } catch (forwardError) {
                    logger.error('Failed to forward escalation to health workers', forwardError as Error);
                }
            }
        } catch (error) {
            logger.error('Failed to handle escalation', error as Error);
        }
    }
}
