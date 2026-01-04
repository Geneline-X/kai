import { Message, MessageMedia } from 'whatsapp-web.js';
import { WhatsAppClient } from './client';
import { QueueManager } from '../queue/manager';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { upsertUser, storeMessage, getUserIdByPhone, incrementUserMessageCount } from '../utils/database-sync';
import { getVoiceService } from '../services/voice-service';

/**
 * Download media with timeout and retry logic
 * Handles flaky WhatsApp Web API and addAnnotations errors
 */
async function downloadMediaWithRetry(
    message: Message,
    maxRetries: number = 2,
    timeoutMs: number = 30000
): Promise<MessageMedia | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Create a timeout promise
            const timeoutPromise = new Promise<null>((_, reject) => {
                setTimeout(() => reject(new Error('Download timeout')), timeoutMs);
            });

            // Race between download and timeout
            const media = await Promise.race([
                message.downloadMedia(),
                timeoutPromise
            ]);

            if (media) {
                return media;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Check for known WhatsApp Web API errors
            const isKnownError =
                errorMessage.includes('addAnnotations') ||
                errorMessage.includes('Execution context was destroyed') ||
                errorMessage.includes('Download timeout') ||
                errorMessage.includes('Protocol error');

            logger.warn(`Media download attempt ${attempt}/${maxRetries} failed`, {
                error: errorMessage,
                isKnownError,
                messageId: message.id._serialized
            });

            // If it's the last attempt or a fatal error, return null
            if (attempt === maxRetries || !isKnownError) {
                return null;
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    return null;
}

export class MessageHandler {
    private whatsappClient: WhatsAppClient;
    private queueManager: QueueManager;
    private config: typeof config;

    constructor(whatsappClient: WhatsAppClient, queueManager: QueueManager) {
        this.whatsappClient = whatsappClient;
        this.queueManager = queueManager;
        this.config = config;
    }

    /**
     * Result of extracting message content, including voice message metadata
     */
    private async extractMessageContent(message: Message): Promise<{
        text: string | undefined;
        isVoiceMessage: boolean;
        audioBuffer?: Buffer;
        location?: { latitude: number; longitude: number };
    }> {
        // Check if this is a location message
        if (message.type === 'location' && message.location) {
            // WhatsApp location coordinates might be strings, convert to numbers
            const latitude = typeof message.location.latitude === 'string'
                ? parseFloat(message.location.latitude)
                : message.location.latitude;
            const longitude = typeof message.location.longitude === 'string'
                ? parseFloat(message.location.longitude)
                : message.location.longitude;

            logger.info('Location message detected', {
                messageId: message.id._serialized,
                latitude,
                longitude,
            });

            // Return formatted message for agent to process
            return {
                text: `[User shared location: ${latitude}, ${longitude}]\n\nPlease use the find_health_facility tool to search for nearby health facilities.`,
                isVoiceMessage: false,
                location: { latitude, longitude },
            };
        }

        // Check if this is a voice message (push-to-talk)
        if (message.type === 'ptt' || message.type === 'audio') {
            logger.info('Voice message detected, downloading and transcribing', {
                messageId: message.id._serialized,
                type: message.type,
            });

            try {
                // Download the voice message media with retry logic
                const media = await downloadMediaWithRetry(message);
                if (!media) {
                    logger.warn('Could not download voice message media after retries', {
                        messageId: message.id._serialized,
                    });
                    return { text: undefined, isVoiceMessage: true };
                }

                const audioBuffer = Buffer.from(media.data, 'base64');

                // Determine file extension from MIME type
                const mimeToExt: { [key: string]: string } = {
                    'audio/ogg': 'ogg',
                    'audio/opus': 'opus',
                    'audio/mpeg': 'mp3',
                    'audio/mp4': 'm4a',
                    'audio/wav': 'wav',
                    'audio/webm': 'webm',
                };
                const ext = mimeToExt[media.mimetype] || 'ogg';
                const filename = `audio.${ext}`;

                logger.info('Voice message downloaded', {
                    messageId: message.id._serialized,
                    mimeType: media.mimetype,
                    size: audioBuffer.length,
                    filename,
                });

                // Transcribe the audio
                const voiceService = getVoiceService();
                const transcription = await voiceService.transcribeAudio(
                    audioBuffer,
                    media.mimetype,
                    filename
                );

                if (transcription.success && transcription.text) {
                    logger.info('Voice transcription successful', {
                        messageId: message.id._serialized,
                        textLength: transcription.text.length,
                        preview: transcription.text.substring(0, 50),
                    });
                    return {
                        text: transcription.text,
                        isVoiceMessage: true,
                        audioBuffer,
                    };
                } else {
                    logger.warn('Voice transcription failed', {
                        messageId: message.id._serialized,
                        error: transcription.error,
                        mimeType: media.mimetype,
                        audioSize: audioBuffer.length,
                    });
                    return { text: undefined, isVoiceMessage: true, audioBuffer };
                }
            } catch (error) {
                logger.error('Error processing voice message', {
                    messageId: message.id._serialized,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                return { text: undefined, isVoiceMessage: true };
            }
        }

        // Regular text message
        if (message.body && message.body.trim().length > 0) {
            return { text: message.body, isVoiceMessage: false };
        }

        // Handle quoted messages
        if (message.hasQuotedMsg) {
            try {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.body && quotedMsg.body.trim().length > 0) {
                    return { text: quotedMsg.body, isVoiceMessage: false };
                }
            } catch (error) {
                logger.debug('Could not get quoted message body', { error: (error as Error).message });
            }
        }

        return { text: undefined, isVoiceMessage: false };
    }

    /**
     * Handle incoming WhatsApp message
     */
    async handleMessage(message: Message): Promise<void> {
        try {
            const chatId = message.from;
            const messageId = message.id._serialized;

            // Early filtering - ignore unsupported message types
            if (chatId.includes('@newsletter')) {
                logger.debug('Ignoring newsletter message', { chatId, messageId });
                return;
            }

            if (chatId.includes('@broadcast')) {
                logger.debug('Ignoring broadcast message', { chatId, messageId });
                return;
            }

            if (chatId.includes('status@broadcast')) {
                logger.debug('Ignoring status message', { chatId, messageId });
                return;
            }

            // Filter out group messages if configured
            if (!this.config.whatsapp.allowGroupMessages && chatId.includes('@g.us')) {
                logger.debug('Ignoring group message', { chatId, messageId });
                return;
            }

            const messageResult = await this.extractMessageContent(message);
            const messageText = messageResult.text;
            const isVoiceMessage = messageResult.isVoiceMessage;

            // Get message content
            if (!messageText || messageText.trim().length === 0) {
                // For voice messages that failed transcription, send a helpful message
                if (isVoiceMessage) {
                    logger.warn('Voice message could not be transcribed', { chatId, messageId });
                    await this.sendResponse(chatId,
                        "🎤 Voice transcription is temporarily unavailable.\n\n" +
                        "Please send your message as text instead. I can still help you with:\n" +
                        "• Health questions and information\n" +
                        "• Finding nearby health facilities\n" +
                        "• General assistance\n\n" +
                        "Simply type your question or message."
                    );
                    return;
                }
                logger.debug('Ignoring empty message', { chatId, messageId });
                return;
            }

            // Get contact info (with fallback for WhatsApp Web API changes)
            let userName: string | undefined;
            let phone: string;
            try {
                const contact = await message.getContact();
                userName = contact.pushname || contact.name || undefined;

                // Get actual phone number from contact, fallback to chatId if not available
                phone = contact.number || chatId.split('@')[0];
            } catch (error) {
                // Fallback: Try to get from message metadata
                logger.debug('Could not fetch contact info, using fallback', {
                    chatId,
                    messageId,
                    error: (error as Error).message
                });
                userName = undefined;
                phone = chatId.split('@')[0];
            }

            logger.info('Handling message', {
                from: chatId,
                phone,
                hasText: !!messageText,
                isVoiceMessage,
                userName,
            });

            // IMPORTANT: Sync user to database FIRST and WAIT for it to complete
            // This ensures user exists before we try to store messages
            const userId = await this.syncUserToDatabase(phone, userName);

            if (!userId) {
                logger.warn('Could not sync user to database, messages will not be saved', { phone });
            }

            // Now store user message with the confirmed userId
            if (userId) {
                this.storeUserMessageWithUserId(userId, messageText).catch(err => {
                    logger.error('Failed to store user message', err);
                });
            }

            // Check if message is a button response (1, 2, 3, or 4)
            const { isButtonResponse, getButtonAction, getUserLastTopic, handleButtonInteraction } = await import('./interactive-buttons');

            if (isButtonResponse(messageText)) {
                const action = getButtonAction(messageText);

                if (action && userId) {
                    const lastTopic = getUserLastTopic(userId);

                    if (lastTopic) {
                        logger.info('Handling button interaction', { action, userId, topicId: lastTopic.id });

                        const response = await handleButtonInteraction(action, lastTopic, userId);

                        if (response) {
                            await this.sendResponse(chatId, response);
                            return; // Don't process as regular message
                        }
                    }
                }
            }

            // Send typing indicator (with error handling for unsupported chats)
            try {
                await this.whatsappClient.sendTyping(chatId);
            } catch (typingError) {
                logger.debug('Could not send typing indicator', { error: (typingError as Error).message });
                // Continue processing even if typing fails
            }

            // Get chat object for isGroup check
            const chat = await message.getChat();

            // Enqueue message for processing
            this.queueManager.enqueue({
                chatId,
                messageId,
                messageText,
                isGroup: chat.isGroup,
                userName,
                timestamp: Date.now(),
                isVoiceMessage,
                voiceAudioBuffer: messageResult.audioBuffer,
            });

        } catch (error) {
            logger.error('Failed to handle message', error as Error, {
                event: 'error',
                error: (error as Error).message,
                stack: (error as Error).stack,
                messageId: message?.id?._serialized,
            });
        }
    }

    /**
     * Send bot response to user
     */
    async sendResponse(chatId: string, responseText: string): Promise<void> {
        try {
            await this.whatsappClient.sendMessage(chatId, responseText);
            logger.info('Response sent', { chatId });

            // Store bot message in database (async, non-blocking)
            const phone = chatId.split('@')[0];
            this.storeBotMessage(phone, responseText).catch(err => {
                logger.error('Failed to store bot message', err);
            });

        } catch (error) {
            logger.error('Failed to send response', error as Error, { chatId });
            throw error;
        }
    }

    /**
     * Sync user data to database and return the userId
     */
    private async syncUserToDatabase(phone: string, name?: string): Promise<string | null> {
        try {
            const userId = await upsertUser({ phone, name });
            if (userId) {
                // Increment message count in background
                incrementUserMessageCount(userId).catch((err: Error) => {
                    logger.error('Failed to increment message count', err);
                });
            }
            return userId;
        } catch (error) {
            logger.error('Database sync failed for user', error as Error, { phone });
            return null;
        }
    }

    /**
     * Store user message in database with known userId
     */
    private async storeUserMessageWithUserId(userId: string, content: string): Promise<string | null> {
        try {
            const messageId = await storeMessage({
                user_id: userId,
                sender: 'user',
                content,
            });

            // Check if message should be escalated
            if (messageId) {
                this.checkAndEscalate(userId, messageId, content).catch((err: Error) => {
                    logger.error('Failed to check escalation', err);
                });
            }

            return messageId;
        } catch (error) {
            logger.error('Failed to store user message in database', error as Error, { userId });
            return null;
        }
    }


    /**
     * Store bot response in database
     * This method looks up the userId by phone - for cases where we don't have userId yet
     */
    private async storeBotMessage(phone: string, content: string): Promise<void> {
        try {
            const userId = await getUserIdByPhone(phone);
            if (userId) {
                await storeMessage({
                    user_id: userId,
                    sender: 'bot',
                    content,
                });
            } else {
                // User might not exist yet - try to create them first
                const newUserId = await upsertUser({ phone });
                if (newUserId) {
                    await storeMessage({
                        user_id: newUserId,
                        sender: 'bot',
                        content,
                    });
                } else {
                    logger.warn('Could not store bot message - user not found', { phone });
                }
            }
        } catch (error) {
            logger.error('Failed to store bot message in database', error as Error, { phone });
        }
    }

    /**
     * Check if message should be escalated and create escalation if needed
     */
    private async checkAndEscalate(userId: string, messageId: string, content: string): Promise<void> {
        try {
            const { checkForEscalation, createEscalation } = await import('../utils/escalation-detector');

            const escalationCheck = await checkForEscalation(content);

            if (escalationCheck.shouldEscalate) {
                logger.info('Escalation triggered', {
                    userId,
                    messageId,
                    reason: escalationCheck.reason,
                    triggerType: escalationCheck.triggerType
                });

                // Create escalation record
                const escalationId = await createEscalation({
                    userId,
                    messageId,
                    reason: escalationCheck.reason || 'Escalation triggered',
                    triggerType: escalationCheck.triggerType || 'keyword',
                    priority: escalationCheck.priority || 'normal',
                    messageContent: content
                });

                if (escalationId && escalationCheck.response) {
                    // Send acknowledgment to user
                    const chatId = await this.getChatIdFromUserId(userId);
                    if (chatId) {
                        await this.sendResponse(chatId, escalationCheck.response);
                    }
                }
            }
        } catch (error) {
            logger.error('Error in escalation check', error as Error);
        }
    }

    /**
     * Get WhatsApp chat ID from user ID
     */
    private async getChatIdFromUserId(userId: string): Promise<string | null> {
        try {
            const { getSupabaseClient } = await import('../config/supabase');
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('users')
                .select('phone')
                .eq('id', userId)
                .single();

            if (error || !data) {
                return null;
            }

            return `${data.phone}@c.us`;
        } catch (error) {
            logger.error('Failed to get chat ID from user ID', error as Error);
            return null;
        }
    }

    /**
     * Get user ID by phone number
     */
    private async getUserIdByPhone(phone: string): Promise<string | null> {
        try {
            const { getUserIdByPhone } = await import('../utils/database-sync');
            return await getUserIdByPhone(phone);
        } catch (error) {
            logger.error('Failed to get user ID by phone', error as Error);
            return null;
        }
    }

    /**
     * Forward pending escalation to health workers
     * This is called after the agent processes an escalation request
     */
    async forwardPendingEscalation(userId: string): Promise<boolean> {
        try {
            const { getPendingEscalation, clearPendingEscalation } = await import('../agent/tools/escalation-tool');
            const { forwardToHealthWorkers, formatEscalationReport } = await import('../utils/escalation-manager');

            const pending = getPendingEscalation(userId);
            if (!pending) {
                logger.debug('No pending escalation to forward', { userId });
                return false;
            }

            logger.info('Forwarding escalation to health workers', {
                userId,
                urgencyLevel: pending.report.urgencyLevel
            });

            // Create a send function that uses this handler
            const sendMessageFn = async (chatId: string, message: string): Promise<void> => {
                await this.whatsappClient.sendMessage(chatId, message);
            };

            // Forward to health workers
            const result = await forwardToHealthWorkers(pending.report, sendMessageFn);

            if (result.success) {
                logger.info('Escalation forwarded successfully', {
                    userId,
                    notifiedContacts: result.notifiedContacts
                });
                clearPendingEscalation(userId);
                return true;
            } else {
                logger.warn('Failed to forward escalation - no health workers notified', { userId });
                return false;
            }

        } catch (error) {
            logger.error('Error forwarding pending escalation', error as Error);
            return false;
        }
    }

    /**
     * Send message to a chat (exposed for escalation forwarding)
     */
    async sendMessageToChat(chatId: string, message: string): Promise<void> {
        await this.whatsappClient.sendMessage(chatId, message);
    }
}

