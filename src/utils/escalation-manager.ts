import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';
import { Message } from '../agent/conversation-history';

/**
 * Escalation Manager
 * Handles formatting, forwarding, and decision logic for escalations
 */

export interface EscalationReport {
    userId: string;
    userPhone: string;
    userName?: string;
    reason: string;
    conversationSummary: string;
    latestMessage: string;
    timestamp: string;
    urgencyLevel: 'emergency' | 'urgent' | 'normal';
    district?: string;
    hospital?: string;
}

export interface HealthWorkerContact {
    id: string;
    phone: string;
    name: string;
    role: string;
    district?: string;
    hospital?: string;
}

// Track escalation requests per user to handle "insistence"
const escalationAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Explicit escalation trigger phrases
export const explicitEscalationPhrases = [
    // Direct escalation requests
    'escalate', 'i want to escalate', 'please escalate',
    // Human requests
    'talk to human', 'talk to a human', 'speak to human', 'speak to a human',
    'i want to talk to a human', 'i need to talk to a human',
    'real person', 'real person please', 'connect me to a person',
    // Health worker requests
    'call a nurse', 'call nurse', 'need a nurse', 'i need a nurse',
    'call a doctor', 'call doctor', 'need a doctor', 'i need a doctor',
    'speak to nurse', 'speak to doctor', 'talk to nurse', 'talk to doctor',
    // Help requests
    'i need help', 'help me please', 'please help me',
    'connect me to someone', 'transfer me', 'get someone',
    // Krio equivalents
    'a want tok to dokta', 'a want tok to nos', 'a nid elp',
    'kol dokta', 'kol nos', 'a want tok to pɔsin'
];

/**
 * Check if message contains explicit escalation request
 */
export function isExplicitEscalationRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return explicitEscalationPhrases.some(phrase =>
        lowerMessage.includes(phrase.toLowerCase())
    );
}

/**
 * Track escalation attempts and check if user is insisting
 */
export function trackEscalationAttempt(userId: string): { isInsisting: boolean; attemptCount: number } {
    const now = Date.now();
    const existing = escalationAttempts.get(userId);

    // Reset if more than 30 minutes since last attempt
    if (existing && (now - existing.lastAttempt) > 30 * 60 * 1000) {
        escalationAttempts.delete(userId);
    }

    const current = escalationAttempts.get(userId) || { count: 0, lastAttempt: now };
    const newCount = current.count + 1;

    escalationAttempts.set(userId, { count: newCount, lastAttempt: now });

    return {
        isInsisting: newCount >= 2,
        attemptCount: newCount
    };
}

/**
 * Reset escalation tracking for a user (after successful escalation)
 */
export function resetEscalationTracking(userId: string): void {
    escalationAttempts.delete(userId);
}

/**
 * Check if a phone number is a WhatsApp Lid (Linked ID)
 * Lids are typically 13+ digit numeric strings that WhatsApp uses for privacy
 */
export function isPhoneLid(phone: string): boolean {
    if (!phone) return false;
    const clean = phone.replace(/[^\d]/g, '');
    // Lids are typically 13+ digits, real phone numbers are usually 7-12 digits
    // Sierra Leone numbers are 11 digits (232 + 8 digit local)
    return clean.length >= 13;
}

// Track users we're waiting for phone numbers from
const pendingPhoneCollection = new Map<string, { escalationData: any; timestamp: number }>();

/**
 * Mark a user as pending phone collection
 */
export function setPendingPhoneCollection(userId: string, escalationData: any): void {
    pendingPhoneCollection.set(userId, {
        escalationData,
        timestamp: Date.now()
    });
    logger.info('Waiting for user to provide phone number', { userId });
}

/**
 * Check if a user is pending phone collection
 */
export function isPendingPhoneCollection(userId: string): boolean {
    const pending = pendingPhoneCollection.get(userId);
    if (!pending) return false;
    // Expire after 5 minutes
    if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
        pendingPhoneCollection.delete(userId);
        return false;
    }
    return true;
}

/**
 * Get and clear pending phone collection data
 */
export function consumePendingPhoneCollection(userId: string): any | null {
    const pending = pendingPhoneCollection.get(userId);
    if (!pending) return null;
    pendingPhoneCollection.delete(userId);
    return pending.escalationData;
}

// Track users we're waiting for location from (for emergency escalation)
const pendingLocationCollection = new Map<string, { escalationData: any; timestamp: number }>();

/**
 * Mark a user as pending location collection for emergency escalation
 */
export function setPendingLocationCollection(userId: string, escalationData: any): void {
    pendingLocationCollection.set(userId, {
        escalationData,
        timestamp: Date.now()
    });
    logger.info('Waiting for user to provide location for emergency escalation', { userId });
}

/**
 * Check if a user is pending location collection
 */
export function isPendingLocationCollection(userId: string): boolean {
    const pending = pendingLocationCollection.get(userId);
    if (!pending) return false;
    // Expire after 10 minutes (emergencies may take a moment)
    if (Date.now() - pending.timestamp > 10 * 60 * 1000) {
        pendingLocationCollection.delete(userId);
        return false;
    }
    return true;
}

/**
 * Get and clear pending location collection data
 */
export function consumePendingLocationCollection(userId: string): any | null {
    const pending = pendingLocationCollection.get(userId);
    if (!pending) return null;
    pendingLocationCollection.delete(userId);
    return pending.escalationData;
}

/**
 * Simple phone number formatting utility
 */
export function formatPhoneNumber(phone: string): string {
    if (!phone) return 'Unknown';

    // Clean the number
    const clean = phone.replace(/[^\d]/g, '');

    // If it's a Lid (internal ID), it's usually very long or contains lid-like patterns
    // Note: Numbers with 15 or more digits are typically Lids in newer WhatsApp versions
    if (clean.length >= 15 || phone.toLocaleLowerCase().includes('lid')) {
        // Return a shortened, labeled version if it's very long
        if (clean.length >= 15) {
            return `[ID: ${clean.substring(0, 6)}...${clean.slice(-4)}]`;
        }
        return `[ID: ${phone.split('@')[0]}]`;
    }

    // If it looks like a real phone number but missing +, add it
    // Most SL numbers (232) or international numbers are between 7-15 digits
    if (clean.length >= 7 && clean.length <= 15 && !phone.startsWith('+')) {
        return `+${clean}`;
    }

    return phone;
}

/**
 * Format escalation report for health workers
 */
export function formatEscalationReport(report: EscalationReport): string {
    const urgencyEmoji = {
        emergency: '🚨 EMERGENCY',
        urgent: '⚠️ URGENT',
        normal: '📋 ESCALATION'
    };

    const formattedPhone = formatPhoneNumber(report.userPhone);

    // Build location line if available
    const locationParts: string[] = [];
    if (report.hospital) locationParts.push(`🏥 Hospital: ${report.hospital}`);
    if (report.district) locationParts.push(`📍 District: ${report.district}`);
    const locationSection = locationParts.length > 0
        ? `\n${locationParts.join('\n')}\n`
        : '';

    return `${urgencyEmoji[report.urgencyLevel]} REPORT

👤 User: ${report.userName || 'Unknown User'}
📱 Phone: ${formattedPhone}
🕐 Time: ${report.timestamp}${locationSection}

📝 REASON:
${report.reason}

💬 CONVERSATION SUMMARY:
${report.conversationSummary}

⚠️ LATEST MESSAGE:
"${report.latestMessage}"

---
Please respond to this user at: ${formattedPhone}
Internal ID: ${report.userPhone}`;
}

/**
 * Format conversation history for escalation report
 */
export function formatConversationSummary(messages: Message[], maxMessages: number = 10): string {
    if (!messages || messages.length === 0) {
        return 'No previous conversation history available.';
    }

    const recentMessages = messages.slice(-maxMessages);

    return recentMessages.map((msg, index) => {
        const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 Bot';
        const content = msg.content.length > 200
            ? msg.content.substring(0, 200) + '...'
            : msg.content;
        return `${index + 1}. ${roleLabel}: ${content}`;
    }).join('\n\n');
}

/**
 * Get health worker contacts from special_contacts table
 */
export async function getHealthWorkerContacts(): Promise<HealthWorkerContact[]> {
    try {
        const supabase = getSupabaseClient();

        // Get contacts with Health Worker, Supervisor, or Admin roles
        // Note: Role values match the database CHECK constraint: 'Admin', 'Health Worker', 'Supervisor', 'Support'
        const { data, error } = await supabase
            .from('special_contacts')
            .select('id, phone, name, role, district, hospital')
            .in('role', ['Health Worker', 'Supervisor', 'Admin'])
            .eq('status', 'active');

        if (error) {
            logger.error('Failed to fetch health worker contacts', error);
            return [];
        }

        logger.info('Health worker contacts fetched', { count: data?.length || 0 });

        // Ensure phone numbers are strings (in case they're stored as BIGINT)
        return (data || []).map(contact => ({
            ...contact,
            phone: String(contact.phone)
        }));
    } catch (error) {
        logger.error('Error fetching health worker contacts', error as Error);
        return [];
    }
}

/**
 * Get health worker contacts filtered by location (district/hospital)
 * Falls back to ALL contacts if no location-specific contacts exist
 */
export async function getHealthWorkerContactsByLocation(
    district?: string,
    hospital?: string
): Promise<{ contacts: HealthWorkerContact[]; isLocationMatch: boolean }> {
    const allContacts = await getHealthWorkerContacts();

    if (!district && !hospital) {
        return { contacts: allContacts, isLocationMatch: false };
    }

    // Try to find contacts matching the location
    let locationContacts: HealthWorkerContact[] = [];

    if (hospital) {
        // First try exact hospital match
        locationContacts = allContacts.filter(c =>
            c.hospital && c.hospital.toLowerCase() === hospital.toLowerCase()
        );
    }

    if (locationContacts.length === 0 && district) {
        // Fall back to district match
        locationContacts = allContacts.filter(c =>
            c.district && c.district.toLowerCase() === district.toLowerCase()
        );
    }

    if (locationContacts.length > 0) {
        logger.info('Location-specific contacts found for escalation', {
            district,
            hospital,
            matchedContacts: locationContacts.length,
            totalContacts: allContacts.length
        });
        return { contacts: locationContacts, isLocationMatch: true };
    }

    // Fallback: no location-specific contacts, use ALL contacts
    logger.info('No location-specific contacts found, falling back to all contacts', {
        district,
        hospital,
        totalContacts: allContacts.length
    });
    return { contacts: allContacts, isLocationMatch: false };
}

/**
 * Forward escalation to health workers via WhatsApp
 * Returns the list of contacts that were notified
 */
export async function forwardToHealthWorkers(
    report: EscalationReport,
    sendMessageFn: (chatId: string, message: string) => Promise<void>
): Promise<{ success: boolean; notifiedContacts: string[] }> {
    try {
        // Use location-based filtering if location is available
        const { contacts: healthWorkers, isLocationMatch } = await getHealthWorkerContactsByLocation(
            report.district,
            report.hospital
        );

        if (healthWorkers.length === 0) {
            logger.warn('No health worker contacts found for escalation forwarding');
            return { success: false, notifiedContacts: [] };
        }

        const formattedReport = formatEscalationReport(report);
        const notifiedContacts: string[] = [];

        // Send to filtered health workers (location-based or all as fallback)
        for (const worker of healthWorkers) {
            try {
                // Clean phone number: remove +, spaces, and any non-digit characters
                const cleanPhone = worker.phone.replace(/[^\d]/g, '');
                const chatId = `${cleanPhone}@c.us`;
                await sendMessageFn(chatId, formattedReport);
                notifiedContacts.push(worker.name || worker.phone);

                logger.info('Escalation forwarded to health worker', {
                    workerPhone: worker.phone,
                    workerName: worker.name,
                    workerDistrict: worker.district,
                    workerHospital: worker.hospital,
                    userId: report.userId,
                    isLocationMatch
                });
            } catch (error) {
                logger.error('Failed to forward escalation to worker', error as Error, {
                    workerPhone: worker.phone
                });
            }
        }

        // Also update the escalation record in database
        await updateEscalationWithForwarding(report.userId, notifiedContacts);

        logger.info('Escalation forwarding complete', {
            userId: report.userId,
            district: report.district,
            hospital: report.hospital,
            isLocationMatch,
            notifiedCount: notifiedContacts.length
        });

        return {
            success: notifiedContacts.length > 0,
            notifiedContacts
        };
    } catch (error) {
        logger.error('Error forwarding escalation', error as Error);
        return { success: false, notifiedContacts: [] };
    }
}

/**
 * Update escalation record with forwarding info
 */
async function updateEscalationWithForwarding(userId: string, notifiedContacts: string[]): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // Find the most recent pending escalation for this user
        const { data: escalation, error: fetchError } = await supabase
            .from('escalations')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (fetchError || !escalation) {
            logger.debug('No pending escalation found to update', { userId });
            return;
        }

        // Update with forwarding info
        const { error: updateError } = await supabase
            .from('escalations')
            .update({
                status: 'assigned', // 'forwarded' is not a valid status in DB, using 'assigned' instead
                admin_notes: `Forwarded to health workers: ${notifiedContacts.join(', ')}`,
                updated_at: new Date().toISOString()
            })
            .eq('id', escalation.id);

        if (updateError) {
            logger.error('Failed to update escalation with forwarding info', updateError);
        }
    } catch (error) {
        logger.error('Error updating escalation with forwarding', error as Error);
    }
}

/**
 * Get user info for escalation report
 */
export async function getUserInfoForEscalation(userId: string): Promise<{ phone: string; name?: string } | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('users')
            .select('phone, name')
            .eq('id', userId)
            .single();

        if (error) {
            logger.error('Failed to get user info for escalation', error);
            return null;
        }

        // Ensure phone is always a string (in case it's stored as BIGINT)
        return {
            phone: String(data.phone),
            name: data.name
        };
    } catch (error) {
        logger.error('Error getting user info', error as Error);
        return null;
    }
}

/**
 * Store escalation in database and return escalation ID
 */
export async function createEscalationRecord(
    userId: string,
    reason: string,
    urgencyLevel: 'emergency' | 'urgent' | 'normal',
    latestMessage: string,
    conversationSummary?: string
): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const priority = urgencyLevel === 'emergency' ? 'urgent' :
            urgencyLevel === 'urgent' ? 'high' : 'normal';

        const { data, error } = await supabase
            .from('escalations')
            .insert({
                user_id: userId,
                reason: reason,
                conversation_summary: conversationSummary,
                trigger_message: latestMessage,
                trigger_type: 'user_request',
                priority: priority,
                status: 'pending'
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to create escalation record', error);
            return null;
        }

        logger.info('Escalation record created', {
            escalationId: data.id,
            userId,
            urgencyLevel
        });

        return data.id;
    } catch (error) {
        logger.error('Error creating escalation record', error as Error);
        return null;
    }
}

/**
 * Get confirmation message for user after escalation
 */
export function getEscalationConfirmationMessage(urgencyLevel: 'emergency' | 'urgent' | 'normal'): string {
    const messages = {
        emergency: `🚨 EMERGENCY ESCALATED

Your case has been flagged as an emergency and sent to our health workers immediately. Someone will contact you very soon.

In the meantime, if this is a life-threatening emergency, please also go to the nearest health facility or call emergency services.

---
🇸🇱 Na Krio:
Yu kes dɔn go na ɛlt wɔka dɛm. Dɛn go kɔl yu kwik kwik. If i siryɔs bad, go na ɔspitul naw naw!`,

        urgent: `⚠️ CASE ESCALATED

Your case has been escalated to a health worker. Someone will contact you shortly on this number.

Please keep your phone nearby.

---
🇸🇱 Na Krio:
Yu kes dɔn go na ɛlt wɔka. Dɛn go kɔl yu sun sun. Kip yu fon klos tu yu.`,

        normal: `✅ REQUEST RECEIVED

Your request has been forwarded to a health worker. Someone will contact you soon.

Thank you for your patience.

---
🇸🇱 Na Krio:
Yu rikwest dɔn go na ɛlt wɔka. Dɛn go kɔl yu. Tenki fɔ pesɛns.`
    };

    return messages[urgencyLevel];
}

/**
 * Get polite decline message (first escalation attempt)
 */
export function getPoliteDeclineMessage(): string {
    return `I understand you'd like to speak to someone. Before I connect you, let me try to help you directly.

Could you tell me more about what you need? I can assist with:
• Health questions and symptom guidance
• Finding health facilities near you
• Information about diseases and prevention
• Current health alerts

If you still prefer to speak to a human health worker, just let me know and I'll connect you right away.

---
🇸🇱 Na Krio:
A ɔndastand se yu want tok to pɔsin. Mek a tray ɛp yu fɔs.

Tɛl mi wetin yu nid? A go fit ɛp yu wit:
• Ɛlt kwɛshɔn dɛm
• Fɛn klinik klos tu yu
• Infɔmeshɔn abawt sik

If yu stil want tok to ɛlt wɔka, jɔs tɛl mi ɛn a go kɔnɛkt yu.`;
}
