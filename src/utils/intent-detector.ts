/**
 * Intent Detection System for Kai Health Assistant
 * Classifies user messages into health-related intents and tracks them
 */

import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';

// Health-specific intent definitions
export const HEALTH_INTENTS = {
    // Greeting and general
    GREETING: { name: 'Greeting', keywords: ['hello', 'hi', 'hey', 'kushe', 'aw di bodi', 'good morning', 'good afternoon', 'good evening'] },

    // Symptom-related
    SYMPTOM_CHECK: { name: 'Symptom Check', keywords: ['fever', 'headache', 'pain', 'cough', 'sick', 'sik', 'fiba', 'belly', 'vomit', 'diarrhea', 'rash', 'itch', 'swelling', 'bleeding', 'tired', 'weak'] },

    // Specific diseases
    MALARIA_QUERY: { name: 'Malaria Query', keywords: ['malaria', 'mosquito', 'antimalarial', 'act', 'coartem'] },
    CHOLERA_QUERY: { name: 'Cholera Query', keywords: ['cholera', 'watery stool', 'ors', 'dehydration'] },
    TYPHOID_QUERY: { name: 'Typhoid Query', keywords: ['typhoid', 'widal'] },
    COVID_QUERY: { name: 'COVID Query', keywords: ['covid', 'corona', 'coronavirus', 'vaccine', 'vaccination'] },

    // Maternal/Child health
    PREGNANCY_QUERY: { name: 'Pregnancy Query', keywords: ['pregnant', 'pregnancy', 'antenatal', 'baby', 'pikin', 'bele', 'labor', 'delivery', 'breastfeed'] },
    CHILD_HEALTH: { name: 'Child Health', keywords: ['child', 'pikin', 'baby', 'infant', 'immunization', 'vaccination', 'growth', 'feeding'] },

    // Facility and services
    FACILITY_QUERY: { name: 'Facility Query', keywords: ['hospital', 'clinic', 'health center', 'ospitul', 'where', 'location', 'address', 'open', 'hours'] },

    // Medication
    MEDICATION_QUERY: { name: 'Medication Query', keywords: ['medicine', 'drug', 'tablet', 'pill', 'dose', 'paracetamol', 'antibiotic'] },

    // Prevention and education
    PREVENTION_QUERY: { name: 'Prevention Query', keywords: ['prevent', 'protection', 'avoid', 'how to', 'what is', 'explain', 'educate'] },

    // Emergency
    EMERGENCY: { name: 'Emergency', keywords: ['emergency', 'urgent', 'help', 'dying', 'unconscious', 'bleeding', 'accident', 'poison', 'cannot breathe'] },

    // Escalation
    ESCALATION_REQUEST: { name: 'Escalation Request', keywords: ['escalate', 'human', 'nurse', 'doctor', 'person', 'talk to', 'speak to'] },

    // Health alerts
    HEALTH_ALERT_QUERY: { name: 'Health Alert Query', keywords: ['outbreak', 'alert', 'news', 'campaign', 'what happening'] },

    // General health
    GENERAL_HEALTH: { name: 'General Health', keywords: ['health', 'healthy', 'wellness', 'nutrition', 'diet', 'exercise', 'water', 'hygiene'] },

    // Fallback
    UNKNOWN: { name: 'Unknown', keywords: [] }
};

/**
 * Detect intent from user message
 */
export function detectIntent(message: string): { intent: string; confidence: number; matchedKeywords: string[] } {
    const lowerMessage = message.toLowerCase();

    let bestMatch = { intent: 'Unknown', confidence: 0, matchedKeywords: [] as string[] };

    for (const [intentKey, intentData] of Object.entries(HEALTH_INTENTS)) {
        if (intentKey === 'UNKNOWN') continue;

        const matchedKeywords = intentData.keywords.filter(keyword =>
            lowerMessage.includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
            // Calculate confidence based on keyword matches
            const confidence = Math.min(matchedKeywords.length / 2, 1); // Max confidence at 2+ matches

            if (confidence > bestMatch.confidence ||
                (confidence === bestMatch.confidence && matchedKeywords.length > bestMatch.matchedKeywords.length)) {
                bestMatch = {
                    intent: intentData.name,
                    confidence,
                    matchedKeywords
                };
            }
        }
    }

    // If no match found, return Unknown
    if (bestMatch.confidence === 0) {
        bestMatch = { intent: 'Unknown', confidence: 0.1, matchedKeywords: [] };
    }

    return bestMatch;
}

/**
 * Track intent in database (increment qa_count for the intent)
 */
export async function trackIntent(intentName: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        // First check if intent exists
        const { data: existing } = await supabase
            .from('intents')
            .select('id, qa_count')
            .eq('name', intentName)
            .single();

        if (existing) {
            // Increment qa_count
            await supabase
                .from('intents')
                .update({ qa_count: (existing.qa_count || 0) + 1 })
                .eq('id', existing.id);
        } else {
            // Create new intent
            await supabase
                .from('intents')
                .insert({
                    name: intentName,
                    description: `Auto-detected intent: ${intentName}`,
                    qa_count: 1
                });
        }

        logger.debug('Intent tracked', { intentName });
    } catch (error) {
        logger.error('Failed to track intent', error as Error, { intentName });
    }
}

/**
 * Update message with detected intent
 */
export async function updateMessageIntent(messageId: string, intent: string): Promise<void> {
    try {
        const supabase = getSupabaseClient();

        await supabase
            .from('messages')
            .update({ intent })
            .eq('id', messageId);

        logger.debug('Message intent updated', { messageId, intent });
    } catch (error) {
        logger.error('Failed to update message intent', error as Error, { messageId });
    }
}

/**
 * Detect and track intent for a message
 */
export async function detectAndTrackIntent(message: string, messageId?: string): Promise<{ intent: string; confidence: number }> {
    const result = detectIntent(message);

    // Track the intent in background
    trackIntent(result.intent).catch(() => { });

    // Update message if messageId provided
    if (messageId) {
        updateMessageIntent(messageId, result.intent).catch(() => { });
    }

    logger.info('Intent detected', {
        intent: result.intent,
        confidence: result.confidence,
        matchedKeywords: result.matchedKeywords.join(', ')
    });

    return {
        intent: result.intent,
        confidence: result.confidence
    };
}
