import { Tool } from './tool-registry';
import { logger } from '../../utils/logger';
import {
    isExplicitEscalationRequest,
    trackEscalationAttempt,
    resetEscalationTracking,
    formatConversationSummary,
    getUserInfoForEscalation,
    createEscalationRecord,
    getEscalationConfirmationMessage,
    getPoliteDeclineMessage,
    isPhoneLid,
    setPendingPhoneCollection,
    EscalationReport
} from '../../utils/escalation-manager';
import { Message } from '../conversation-history';

// Store pending escalation context for forwarding
interface PendingEscalation {
    report: EscalationReport;
    conversationHistory: Message[];
}

const pendingEscalations = new Map<string, PendingEscalation>();

/**
 * Create the Escalation Tool for the agent
 * This tool handles user escalation requests and forwards to health workers
 */
export const createEscalationTool = (): Tool => {
    return {
        name: 'escalate_to_health_worker',
        description: `Request escalation to a human health worker. Use this tool when:
- User explicitly asks to speak to a human/nurse/doctor
- User insists on escalation after being offered guidance
- Emergency situation detected that requires human intervention
- User appears distressed, confused, or reports danger signs
- Bot has failed multiple times to address user's concern`,
        parameters: [
            {
                name: 'reason',
                type: 'string',
                description: 'The reason for escalation (e.g., "User requested to speak with nurse", "Emergency symptoms detected")',
                required: true,
            },
            {
                name: 'urgency_level',
                type: 'string',
                description: 'Urgency level: "emergency" (life-threatening), "urgent" (needs attention today), or "normal" (general request)',
                required: true,
            },
            {
                name: 'user_id',
                type: 'string',
                description: 'The user ID from the database',
                required: true,
            },
            {
                name: 'latest_message',
                type: 'string',
                description: 'The user\'s most recent message that triggered escalation',
                required: true,
            },
            {
                name: 'conversation_summary',
                type: 'string',
                description: 'Summary of the recent conversation (last 10 messages)',
                required: false,
            }
        ],
        execute: async (params: {
            reason: string;
            urgency_level: string;
            user_id: string;
            latest_message: string;
            conversation_summary?: string;
        }): Promise<string> => {
            try {
                const { reason, urgency_level, user_id, latest_message, conversation_summary } = params;

                logger.info('Escalation tool invoked', {
                    userId: user_id,
                    reason,
                    urgencyLevel: urgency_level
                });

                // Validate urgency level
                const validUrgencyLevels = ['emergency', 'urgent', 'normal'];
                const urgency = validUrgencyLevels.includes(urgency_level)
                    ? urgency_level as 'emergency' | 'urgent' | 'normal'
                    : 'normal';

                // Get user info (attempt to re-fetch for latest name/phone resolution)
                const userInfo = await getUserInfoForEscalation(user_id);
                if (!userInfo) {
                    logger.error('Could not find user for escalation', { userId: user_id });
                    return 'I apologize, but I encountered an issue processing your request. Please try again or visit your nearest health facility.';
                }

                // Check if user's phone is a Lid (hash number) - if so, ask for their real number
                if (isPhoneLid(userInfo.phone)) {
                    logger.info('User phone is a Lid, requesting real phone number', {
                        userId: user_id,
                        lidPhone: userInfo.phone
                    });

                    // Store the escalation data for later completion
                    setPendingPhoneCollection(user_id, {
                        reason,
                        urgency,
                        latest_message,
                        conversation_summary
                    });

                    // Ask user for their phone number
                    return `To connect you with a health worker, I need your phone number so they can reach you. Please reply with your phone number (e.g., 23276123456).

Once you provide your number, I will immediately forward your case to an available health worker.`;
                }

                const escalationId = await createEscalationRecord(
                    user_id,
                    reason,
                    urgency,
                    latest_message,
                    conversation_summary
                );

                if (!escalationId) {
                    logger.error('Failed to create escalation record', { userId: user_id });
                }

                // Build the escalation report
                const report: EscalationReport = {
                    userId: user_id,
                    userPhone: userInfo.phone,
                    userName: userInfo.name,
                    reason: reason,
                    conversationSummary: conversation_summary || 'No conversation summary available.',
                    latestMessage: latest_message,
                    timestamp: new Date().toISOString(),
                    urgencyLevel: urgency
                };

                // Store for later forwarding (the actual forwarding happens in the message handler)
                pendingEscalations.set(user_id, {
                    report,
                    conversationHistory: []
                });

                // Reset escalation tracking since we're proceeding
                resetEscalationTracking(user_id);

                logger.info('Escalation prepared for forwarding', {
                    userId: user_id,
                    escalationId,
                    urgencyLevel: urgency
                });

                // Return the confirmation message
                return getEscalationConfirmationMessage(urgency);

            } catch (error) {
                logger.error('Escalation tool failed', error as Error);
                return 'I apologize, but I encountered an issue while trying to connect you with a health worker. Please try again in a moment, or contact your nearest health facility directly.';
            }
        },
    };
};

/**
 * Create a tool for checking if escalation is appropriate
 * This helps the agent decide whether to escalate
 */
export const createEscalationCheckTool = (): Tool => {
    return {
        name: 'check_escalation_status',
        description: `Check if a user's escalation request should be processed or politely declined.
Use this before escalating to determine if the user has already requested escalation before.`,
        parameters: [
            {
                name: 'user_id',
                type: 'string',
                description: 'The user ID to check',
                required: true,
            },
            {
                name: 'user_message',
                type: 'string',
                description: 'The user\'s message requesting escalation',
                required: true,
            }
        ],
        execute: async (params: { user_id: string; user_message: string }): Promise<string> => {
            try {
                const { user_id, user_message } = params;

                // Check if this is an explicit escalation request
                const isExplicit = isExplicitEscalationRequest(user_message);

                if (!isExplicit) {
                    return JSON.stringify({
                        shouldEscalate: false,
                        reason: 'not_explicit_request',
                        message: 'User message does not appear to be an escalation request.'
                    });
                }

                // Track the attempt and check if user is insisting
                const { isInsisting, attemptCount } = trackEscalationAttempt(user_id);

                if (isInsisting) {
                    return JSON.stringify({
                        shouldEscalate: true,
                        reason: 'user_insisting',
                        attemptCount,
                        message: 'User has requested escalation multiple times. Proceed with escalation.'
                    });
                } else {
                    return JSON.stringify({
                        shouldEscalate: false,
                        reason: 'first_attempt',
                        attemptCount,
                        message: 'This is the user\'s first escalation request. Offer guidance first and explain bot capabilities.',
                        suggestedResponse: getPoliteDeclineMessage()
                    });
                }

            } catch (error) {
                logger.error('Escalation check failed', error as Error);
                return JSON.stringify({
                    shouldEscalate: true,
                    reason: 'error',
                    message: 'Error checking escalation status. Proceeding with escalation to be safe.'
                });
            }
        },
    };
};

/**
 * Get pending escalation for a user (for forwarding)
 */
export function getPendingEscalation(userId: string): PendingEscalation | undefined {
    return pendingEscalations.get(userId);
}

/**
 * Clear pending escalation after it's been forwarded
 */
export function clearPendingEscalation(userId: string): void {
    pendingEscalations.delete(userId);
}

/**
 * Set conversation history for pending escalation
 */
export function setEscalationConversationHistory(userId: string, history: Message[]): void {
    const pending = pendingEscalations.get(userId);
    if (pending) {
        pending.conversationHistory = history;
        pending.report.conversationSummary = formatConversationSummary(history);
    }
}
