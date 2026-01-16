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
    SYMPTOM_CHECK: { name: 'Symptom Check', keywords: ['fever', 'headache', 'pain', 'cough', 'sick', 'sik', 'fiba', 'belly', 'vomit', 'diarrhea', 'rash', 'itch', 'swelling', 'bleeding', 'tired', 'weak', 'body pain', 'joint pain', 'red eyes', 'dizzy', 'pale', 'yellow skin', 'yellow eyes', 'jaundice', 'blood in urine', 'blood in stool', 'constipation', 'cold', 'flu', 'sneeze', 'trembling'] },

    // Specific diseases
    MALARIA_QUERY: { name: 'Malaria Query', keywords: ['malaria', 'mosquito', 'antimalarial', 'act', 'coartem'] },
    CHOLERA_QUERY: { name: 'Cholera Query', keywords: ['cholera', 'watery stool', 'ors', 'dehydration'] },
    TYPHOID_QUERY: { name: 'Typhoid Query', keywords: ['typhoid', 'widal'] },
    COVID_QUERY: { name: 'COVID Query', keywords: ['covid', 'corona', 'coronavirus', 'vaccine', 'vaccination'] },
    TB_QUERY: { name: 'TB Query', keywords: ['tuberculosis', 'tb', 'dots', 'cough more than 2 weeks', 'night sweat', 'weight loss', 'chest pain'] },
    VHF_QUERY: { name: 'VHF Query', keywords: ['ebola', 'lassa fever', 'marburg', 'bleeding from nose', 'bleeding from gums', 'hemorrhagic'] },

    // Maternal/Child health
    PREGNANCY_QUERY: { name: 'Pregnancy Query', keywords: ['pregnant', 'pregnancy', 'antenatal', 'baby', 'pikin', 'bele', 'labor', 'delivery', 'breastfeed', 'birth control', 'contraception', 'family planning', 'miscarriage', 'complication', 'bleeding in pregnancy', 'morning sickness', 'folic acid', 'iron tablet'] },
    CHILD_HEALTH: { name: 'Child Health', keywords: ['child', 'pikin', 'baby', 'infant', 'immunization', 'vaccination', 'growth', 'feeding', 'under five', 'measles', 'polio', 'pentavalent'] },

    // Facility and services
    FACILITY_QUERY: { name: 'Facility Query', keywords: ['hospital', 'clinic', 'health center', 'ospitul', 'where', 'location', 'address', 'open', 'hours'] },

    // Medication
    MEDICATION_QUERY: { name: 'Medication Query', keywords: ['medicine', 'drug', 'tablet', 'pill', 'dose', 'paracetamol', 'antibiotic', 'intake', 'overdose', 'side effect', 'damage', 'harm', 'excessive', 'capsule', 'syrup', 'injection', 'treatment'] },

    // Prevention and education
    PREVENTION_QUERY: { name: 'Prevention Query', keywords: ['prevent', 'protection', 'avoid', 'how to', 'what is', 'explain', 'educate'] },

    // Emergency
    EMERGENCY: { name: 'Emergency', keywords: ['emergency', 'urgent', 'help', 'dying', 'unconscious', 'bleeding', 'accident', 'poison', 'cannot breathe'] },

    // Escalation
    ESCALATION_REQUEST: { name: 'Escalation Request', keywords: ['escalate', 'human', 'nurse', 'doctor', 'person', 'talk to', 'speak to'] },

    // Health alerts
    HEALTH_ALERT_QUERY: { name: 'Health Alert Query', keywords: ['outbreak', 'alert', 'news', 'campaign', 'what happening'] },

    // General health
    GENERAL_HEALTH: { name: 'General Health', keywords: ['health', 'healthy', 'wellness', 'nutrition', 'diet', 'exercise', 'water', 'hygiene', 'fitness', 'lifestyle'] },

    // Chronic Conditions (NCDs)
    NCD_QUERY: { name: 'NCD Query', keywords: ['diabetes', 'sugar', 'hypertension', 'blood pressure', 'high bp', 'heart', 'stroke', 'cancer', 'sickle cell', 'asthma'] },

    // Sensitive TOPICS
    MENTAL_HEALTH: { name: 'Mental Health', keywords: ['mental', 'depression', 'anxiety', 'stress', 'suicide', 'suicidal', 'trauma', 'grief', 'sad', 'cannot sleep', 'worry', 'madness', 'psychology'] },
    SGBV_QUERY: { name: 'SGBV Query', keywords: ['rape', 'sexual assault', 'domestic violence', 'abuse', 'beating', 'violence', 'hurt by partner', 'forced sex', 'harassment'] },
    STI_HIV_QUERY: { name: 'STI/HIV Query', keywords: ['sti', 'std', 'hiv', 'aids', 'syphilis', 'gonorrhea', 'discharge', 'sore on private part', 'burning sensation', 'safe sex', 'condom'] },
    SEXUAL_ANATOMY: { name: 'Sexual Anatomy', keywords: ['penis', 'vagina', 'anatomy', 'size', 'growth', 'development', 'body change', 'puberty', 'erection'] },

    // WASH and Environment
    WASH_QUERY: { name: 'WASH Query', keywords: ['water', 'sanitation', 'toilet', 'hygiene', 'latrine', 'garbage', 'waste', 'dirty water', 'handwash', 'soap', 'chlorine', 'clean wata'] },

    // Nutrition
    NUTRITION_QUERY: { name: 'Nutrition Query', keywords: ['malnutrition', 'stunting', 'underweight', 'vitamin', 'protein', 'balanced diet', 'breastfeeding', 'kwashiorkor', 'marasmus'] },

    // First Aid & Injuries
    FIRST_AID: { name: 'First Aid', keywords: ['first aid', 'burn', 'wound', 'injury', 'snake bite', 'dog bite', 'cut', 'bleed', 'accident', 'fracture', 'broken bone'] },
    ZOONOTIC_QUERY: { name: 'Zoonotic Query', keywords: ['rabies', 'monkeypox', 'animal bite', 'bat', 'rat', 'bushmeat'] },

    // Sensory & Others
    SENSORY_QUERY: { name: 'Sensory Query', keywords: ['eye', 'blind', 'ear', 'deaf', 'cataract', 'glaucoma', 'ear discharge', 'hearing', 'vision'] },
    DENTAL_QUERY: { name: 'Dental Query', keywords: ['tooth', 'teeth', 'gum', 'dentist', 'toothache', 'mouth sore'] },
    SKIN_QUERY: { name: 'Skin Query', keywords: ['skin', 'scabies', 'krawl-krawl', 'fungal', 'ringworm', 'eczema', 'sores'] },

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
