import { Tool } from './tool-registry';
import { logger } from '../../utils/logger';
import {
    krioSymptoms,
    krioUrgency,
    krioHomeCare,
    krioResponses,
    getBilingualResponse
} from '../../utils/krio-phrases';

/**
 * Symptom Triage Tool
 * Provides structured symptom guidance with urgency categorization
 * Supports both English and Krio responses
 */

// Symptom urgency levels
type UrgencyLevel = 'emergency' | 'urgent' | 'moderate' | 'routine';

// Symptom categories with associated urgency and guidance
interface SymptomGuidance {
    urgency: UrgencyLevel;
    englishAdvice: string;
    krioAdvice: string;
    homeCare?: string[];
    krioHomeCare?: string[];
    referralNeeded: boolean;
    questions?: string[];
    krioQuestions?: string[];
}

// Symptom database with triage guidance
const symptomDatabase: Record<string, SymptomGuidance> = {
    // Emergency symptoms
    'severe_bleeding': {
        urgency: 'emergency',
        englishAdvice: '🚨 EMERGENCY: Severe bleeding requires immediate medical attention. Apply pressure to the wound and go to the hospital NOW!',
        krioAdvice: '🚨 EMƐJƐNSI: Blɔd de kɔmɔt bad bad! Pres di wun ɛn go na ɔspitul NAW NAW!',
        referralNeeded: true,
    },
    'difficulty_breathing': {
        urgency: 'emergency',
        englishAdvice: '🚨 EMERGENCY: Difficulty breathing is serious. Go to the hospital immediately!',
        krioAdvice: '🚨 EMƐJƐNSI: If yu nɔ de brid fayn, dis siryɔs! Go na ɔspitul kwik kwik!',
        referralNeeded: true,
    },
    'chest_pain': {
        urgency: 'emergency',
        englishAdvice: '🚨 EMERGENCY: Chest pain can be serious. Go to the hospital immediately!',
        krioAdvice: '🚨 EMƐJƐNSI: Ches de pɛn go bi siryɔs! Go na ɔspitul naw naw!',
        referralNeeded: true,
    },
    'unconscious': {
        urgency: 'emergency',
        englishAdvice: '🚨 EMERGENCY: If someone is unconscious, call for help and take them to the hospital immediately!',
        krioAdvice: '🚨 EMƐJƐNSI: If pɔsin fɔdɔm ɛn nɔ de wek ɔp, kɔl fɔ ɛp ɛn tek am go ɔspitul kwik!',
        referralNeeded: true,
    },
    'convulsions': {
        urgency: 'emergency',
        englishAdvice: '🚨 EMERGENCY: Convulsions (fits) require immediate medical care. Keep the person safe and go to hospital!',
        krioAdvice: '🚨 EMƐJƐNSI: Fit de kech am! Kip am sef ɛn go na ɔspitul naw naw!',
        referralNeeded: true,
    },

    // Urgent symptoms - these still need care but provide home care guidance first
    'high_fever': {
        urgency: 'urgent',
        englishAdvice: 'High fever (above 39°C/102°F) needs medical attention today, especially if lasting more than 2 days. In the meantime, follow these home care tips.',
        krioAdvice: 'Fiba ɔt ɔt (mɔ pas 39°C) - go si dɔkta tide, ɛspɛshali if i pas 2 die. Fɔ naw, du dis:',
        homeCare: ['Take paracetamol as directed (every 6-8 hours)', 'Drink plenty of fluids - water, ORS, or light soup', 'Use a cool cloth on forehead', 'Rest well', 'Wear light clothing'],
        krioHomeCare: ['Tek paracetamol (ɛvri 6-8 awa)', 'Drink plenty wata, ORS, ɔ layt sup', 'Yuz kol klɔt na fɔred', 'Res gud gud', 'Wia layt klos'],
        referralNeeded: false, // Changed: provide guidance first, user can seek care if needed
        questions: ['How long have you had the fever?', 'Is there any neck stiffness?', 'Any rash on the body?'],
        krioQuestions: ['Aw lɔng yu gɛt di fiba?', 'Yu nɛk stif?', 'Ɛni rash de na bɔdi?'],
    },
    'mild_fever': {
        urgency: 'moderate',
        englishAdvice: 'Mild fever (below 39°C/102°F) can often be managed at home. Here\'s what to do:',
        krioAdvice: 'Smɔl fiba (ɔnda 39°C) go fit manaj na os. Dis na wetin fɔ du:',
        homeCare: ['Take paracetamol if uncomfortable', 'Drink plenty of fluids', 'Rest', 'Monitor temperature', 'Seek care if fever persists more than 3 days'],
        krioHomeCare: ['Tek paracetamol if yu nɔ fil fayn', 'Drink plenty wata', 'Res', 'Chɛk yu tempricha', 'Go klinik if fiba pas 3 die'],
        referralNeeded: false,
    },
    'mild_vomiting': {
        urgency: 'moderate',
        englishAdvice: 'Occasional vomiting can often be managed at home. Here\'s what to do:',
        krioAdvice: 'If yu de troway wan wan tɛm, yu go fit manaj na os. Dis na wetin fɔ du:',
        homeCare: ['Wait 30 minutes after vomiting before drinking', 'Sip small amounts of water or ORS', 'Avoid solid food for a few hours', 'Rest', 'Seek care if vomiting continues for more than 24 hours'],
        krioHomeCare: ['Wet 30 minit afta yu troway bɔfɔ yu drink', 'Drink smɔl smɔl wata ɔ ORS', 'Nɔ it ɛni tin fɔ smɔl tɛm', 'Res', 'Go klinik if yu de troway mɔ dan 24 awa'],
        referralNeeded: false,
    },
    'severe_vomiting': {
        urgency: 'urgent',
        englishAdvice: 'Severe or persistent vomiting (many times, can\'t keep fluids down) can cause dehydration. Try these tips, and see a health worker today if it continues.',
        krioAdvice: 'If yu de troway plenty ɛn yu nɔ fit hol wata na bɛlɛ, yu go lus wata. Tray dis, ɛn go si ɛlt wɔka if i kɔntinyu.',
        homeCare: ['Sip small amounts of ORS or water frequently', 'Avoid solid food until vomiting stops', 'Rest', 'Watch for signs of dehydration (dry mouth, dizziness)'],
        krioHomeCare: ['Drink smɔl smɔl ORS ɔ wata', 'Nɔ it ɛni tin til yu stɔp troway', 'Res', 'Wach if yu mɔt dray ɔ yu de dizi'],
        referralNeeded: false, // Changed: provide guidance first
    },
    'mild_diarrhea': {
        urgency: 'moderate',
        englishAdvice: 'Mild diarrhea (a few loose stools) usually gets better in a few days. Here\'s what to do:',
        krioAdvice: 'Smɔl rɔnbɛlɛ go bɛta afta smɔl die. Dis na wetin fɔ du:',
        homeCare: ['Drink ORS after each loose stool', 'Eat light meals when hungry', 'Avoid spicy or fatty foods', 'Wash hands frequently', 'Seek care if blood in stool or not improving in 3 days'],
        krioHomeCare: ['Drink ORS afta ɛvri rɔnbɛlɛ', 'It layt it we yu angri', 'Liav pɛpɛ ɛn ɔyli it', 'Was yu an dɛm ɔltɛm', 'Go klinik if blɔd de ɔ if i nɔ bɛta afta 3 die'],
        referralNeeded: false,
    },
    'severe_diarrhea': {
        urgency: 'urgent',
        englishAdvice: 'Severe diarrhea (many watery stools, blood in stool) needs attention. Use ORS and follow these tips. See a health worker if not improving.',
        krioAdvice: 'Rɔnbɛlɛ bad (plenty wata stul, blɔd de) nid atɛnshɔn. Yuz ORS ɛn du dis. Go si ɛlt wɔka if i nɔ bɛta.',
        homeCare: ['Drink ORS after each loose stool - this is very important!', 'Continue breastfeeding if infant', 'Eat small light meals', 'Watch for dehydration (dry mouth, less urination, dizziness)'],
        krioHomeCare: ['Drink ORS afta ɛvri rɔnbɛlɛ - dis impɔtant!', 'Kip giv brɛstmilk if na pikin', 'It smɔl smɔl layt it', 'Wach if bɔdi de dray (mɔt dray, nɔ de pis, dizi)'],
        referralNeeded: false, // Changed: provide guidance first
    },
    'malaria_suspected': {
        urgency: 'moderate', // Changed from urgent - advise testing but don't require immediate care
        englishAdvice: 'These symptoms could be malaria (fever with chills, body aches, headache). Get tested soon - malaria is treatable!',
        krioAdvice: 'Dis go bi malɛria (fiba wit kol, bɔdi de pɛn, ɛd de wɔri). Go tɛs sun - malɛria gɛt mɛdisin!',
        homeCare: ['Take paracetamol for fever and pain', 'Drink plenty of fluids', 'Sleep under a mosquito net', 'Get tested at a health facility or with a rapid test', 'If positive, complete all prescribed medication'],
        krioHomeCare: ['Tek paracetamol fɔ fiba ɛn pɛn', 'Drink plenty wata', 'Slip insay mɔskito nɛt', 'Go tɛs na klinik ɔ yuz rapid tɛs', 'If i pɔzitiv, tek ɔl di mɛdisin dɛn giv yu'],
        referralNeeded: false,
        questions: ['Have you been tested for malaria?', 'How long have you had fever?', 'Did you sleep under a mosquito net?'],
        krioQuestions: ['Yu dɔn tɛs fɔ malɛria?', 'Aw lɔng yu gɛt fiba?', 'Yu de slip insay mɔskito nɛt?'],
    },

    // Moderate symptoms
    'cough': {
        urgency: 'moderate',
        englishAdvice: 'A cough that lasts more than 2 weeks, or with blood, needs to be checked. Otherwise, rest and drink fluids.',
        krioAdvice: 'Kɔf we pas 2 wik, ɔ kɔf wit blɔd, fɔ go chɛk. If nɔ, res ɛn drink wata.',
        homeCare: ['Drink warm fluids', 'Get plenty of rest', 'Avoid dusty areas', 'Cover mouth when coughing'],
        krioHomeCare: ['Drink wɔm wata ɔ ti', 'Res gud gud', 'Nɔ go we dɔs de', 'Kɔva yu mɔt we yu de kɔf'],
        referralNeeded: false,
        questions: ['How long have you been coughing?', 'Is there any blood in the cough?', 'Do you have fever too?'],
        krioQuestions: ['Aw lɔng yu de kɔf?', 'Ɛni blɔd de insay di kɔf?', 'Fiba de tu?'],
    },
    'headache': {
        urgency: 'moderate',
        englishAdvice: 'For mild headache, rest and take paracetamol. Seek care if severe, sudden, or with fever/stiff neck.',
        krioAdvice: 'Fɔ smɔl ɛdɛk, res ɛn tek paracetamol. Go si dɔkta if i bad bad, ɔ kɔm wantem, ɔ wit fiba/stif nɛk.',
        homeCare: ['Take paracetamol as directed', 'Rest in a quiet dark room', 'Drink water', 'Avoid stress'],
        krioHomeCare: ['Tek paracetamol', 'Res na dak rum', 'Drink wata', 'Nɔ wɔri tumos'],
        referralNeeded: false,
    },
    'body_pain': {
        urgency: 'moderate',
        englishAdvice: 'General body pain can have many causes. Rest and take paracetamol. See a health worker if it continues more than 3 days or gets worse.',
        krioAdvice: 'Bɔdi de pɛn gɛt plenty rizin. Res ɛn tek paracetamol. Go si ɛlt wɔka if i pas 3 die ɔ de wɔs.',
        homeCare: ['Rest well', 'Take paracetamol for pain', 'Drink plenty of fluids', 'Light stretching may help'],
        krioHomeCare: ['Res gud gud', 'Tek paracetamol fɔ pɛn', 'Drink plenty wata', 'Strɛch smɔl go ɛp'],
        referralNeeded: false,
    },

    // Routine/mild symptoms
    'mild_cold': {
        urgency: 'routine',
        englishAdvice: 'A common cold usually gets better on its own in 7-10 days. Rest and drink fluids.',
        krioAdvice: 'Kɔmɔn kol go bɛta na im yon afta 7-10 die. Res ɛn drink wata.',
        homeCare: ['Rest as much as possible', 'Drink warm fluids', 'Wash hands frequently', 'Avoid spreading to others'],
        krioHomeCare: ['Res gud gud', 'Drink wɔm wata ɔ ti', 'Was yu an dɛm ɔltɛm', 'Nɔ spred am go na ɔda pipul'],
        referralNeeded: false,
    },
    'mild_stomach': {
        urgency: 'routine',
        englishAdvice: 'Mild stomach discomfort often passes. Eat light meals, drink water, and rest.',
        krioAdvice: 'Smɔl bɛlɛwɔri go pas. It layt it, drink wata, ɛn res.',
        homeCare: ['Eat small, light meals', 'Drink plenty of water', 'Avoid spicy or fatty foods', 'Rest'],
        krioHomeCare: ['It smɔl smɔl layt it', 'Drink plenty wata', 'Liav pɛpɛ ɛn ɔyli it', 'Res'],
        referralNeeded: false,
    },
};

// Map common symptom descriptions to database keys
// IMPORTANT: Map to MILD versions first, let severity determine if urgent
const symptomMapping: Record<string, string> = {
    // Emergency mappings - only truly emergency symptoms
    'bleeding heavily': 'severe_bleeding',
    'bleeding bad': 'severe_bleeding',
    'blood wont stop': 'severe_bleeding',
    'cant breathe': 'difficulty_breathing',
    'can\'t breathe': 'difficulty_breathing',
    'hard to breathe': 'difficulty_breathing',
    'struggling to breathe': 'difficulty_breathing',
    'no de brid': 'difficulty_breathing',
    'severe chest pain': 'chest_pain',
    'ches de pen bad': 'chest_pain',
    'unconscious': 'unconscious',
    'passed out': 'unconscious',
    'fainted': 'unconscious',
    'not waking up': 'unconscious',
    'fit': 'convulsions',
    'convulsion': 'convulsions',
    'seizure': 'convulsions',
    'shaking': 'convulsions',

    // Fever - map to MILD first (default)
    'fever': 'mild_fever',
    'fiba': 'mild_fever',
    'bodi ot': 'mild_fever',
    'temperature': 'mild_fever',
    'high fever': 'high_fever',
    'very high fever': 'high_fever',
    'fiba bad': 'high_fever',

    // Vomiting - map to MILD first
    'vomiting': 'mild_vomiting',
    'vomit': 'mild_vomiting',
    'troway': 'mild_vomiting',
    'throwing up': 'mild_vomiting',
    'cant keep food down': 'severe_vomiting',
    'vomiting all day': 'severe_vomiting',
    'vomiting blood': 'severe_vomiting',

    // Diarrhea - map to MILD first
    'diarrhea': 'mild_diarrhea',
    'runbele': 'mild_diarrhea',
    'rɔnbɛlɛ': 'mild_diarrhea',
    'loose stool': 'mild_diarrhea',
    'watery stool': 'mild_diarrhea',
    'blood in stool': 'severe_diarrhea',
    'diarrhea with blood': 'severe_diarrhea',
    'severe diarrhea': 'severe_diarrhea',

    // Malaria related
    'malaria': 'malaria_suspected',
    'maleria': 'malaria_suspected',
    'i think malaria': 'malaria_suspected',

    // Moderate mappings
    'cough': 'cough',
    'kof': 'cough',
    'kɔf': 'cough',
    'coughing': 'cough',
    'headache': 'headache',
    'head pain': 'headache',
    'ed de wori': 'headache',
    'ed de pen': 'headache',
    'edek': 'headache',
    'edik': 'headache',
    'ɛdɛk': 'headache',
    'a get edek': 'headache',
    'agat edik': 'headache',
    'my head': 'headache',
    'body pain': 'body_pain',
    'bodi de pen': 'body_pain',
    'body ache': 'body_pain',
    'aching': 'body_pain',

    // Routine mappings
    'cold': 'mild_cold',
    'runny nose': 'mild_cold',
    'sneezing': 'mild_cold',
    'stuffy nose': 'mild_cold',
    'stomach ache': 'mild_stomach',
    'bele de wori': 'mild_stomach',
    'stomach pain': 'mild_stomach',
    'tummy ache': 'mild_stomach',
    'belly pain': 'mild_stomach',
};

/**
 * Find the best matching symptom from user input
 */
async function findSymptom(query: string): Promise<string | null> {
    const lowerQuery = query.toLowerCase();

    // First, try fuzzy Krio matching
    const { extractKrioSymptoms, hasGoodKrioMatches, detectKrio } = require('../../utils/krio-phrases');
    const krioMatches = extractKrioSymptoms(query);

    if (krioMatches.length > 0 && hasGoodKrioMatches(krioMatches)) {
        // Use the best match (highest confidence)
        const bestMatch = krioMatches.sort((a: { symptom: string; confidence: number }, b: { symptom: string; confidence: number }) => b.confidence - a.confidence)[0];

        // Map Krio symptom to database key
        const symptomMap: Record<string, string> = {
            'headache': 'headache',
            'fever': 'mild_fever',
            'stomachPain': 'mild_stomach',
            'vomiting': 'mild_vomiting',
            'diarrhea': 'mild_diarrhea',
            'cough': 'cough',
            'bodyPain': 'body_pain',
        };

        const dbKey = symptomMap[bestMatch.symptom];
        if (dbKey) {
            logger.info('Krio symptom detected via fuzzy matching', {
                input: query,
                detected: bestMatch.symptom,
                confidence: bestMatch.confidence,
                mappedTo: dbKey,
            });
            return dbKey;
        }
    }

    // If Krio detected but no good fuzzy matches, try translation fallback
    if (detectKrio(query) && (!krioMatches.length || !hasGoodKrioMatches(krioMatches))) {
        logger.info('Krio detected but no good fuzzy matches, attempting translation', {
            input: query,
            fuzzyMatchCount: krioMatches.length,
        });

        try {
            const { getVoiceService } = await import('../../services/voice-service');
            const voiceService = getVoiceService();
            const translationResult = await voiceService.translateKrioToEnglish(query);

            if (translationResult.success && translationResult.translatedText) {
                logger.info('Krio translation successful, retrying symptom detection', {
                    original: query,
                    translated: translationResult.translatedText,
                });

                // Retry symptom detection with translated English text
                const translatedQuery = translationResult.translatedText.toLowerCase();

                // Try exact matches from symptom mapping
                for (const [key, value] of Object.entries(symptomMapping)) {
                    if (translatedQuery.includes(key)) {
                        logger.info('Symptom found via translation fallback', {
                            original: query,
                            translated: translationResult.translatedText,
                            symptom: value,
                        });
                        return value;
                    }
                }

                // Try database keys directly
                for (const key of Object.keys(symptomDatabase)) {
                    if (translatedQuery.includes(key.replace(/_/g, ' '))) {
                        logger.info('Symptom found via translation fallback (database key)', {
                            original: query,
                            translated: translationResult.translatedText,
                            symptom: key,
                        });
                        return key;
                    }
                }

                logger.info('Translation successful but no symptom match found', {
                    original: query,
                    translated: translationResult.translatedText,
                });
            } else {
                logger.warn('Translation fallback failed', {
                    error: translationResult.error,
                });
            }
        } catch (error) {
            logger.error('Error during translation fallback', error as Error);
        }
    }

    // Try exact matches from symptom mapping
    for (const [key, value] of Object.entries(symptomMapping)) {
        if (lowerQuery.includes(key)) {
            return value;
        }
    }

    // Try database keys directly
    for (const key of Object.keys(symptomDatabase)) {
        if (lowerQuery.includes(key.replace(/_/g, ' '))) {
            return key;
        }
    }

    return null;
}

/**
 * Create the Symptom Triage Tool
 */
export const createSymptomTriageTool = (): Tool => {
    return {
        name: 'symptom_triage',
        description: 'Assess symptoms and provide triage guidance in English and Krio. Use this when a user describes health symptoms they are experiencing.',
        parameters: [
            {
                name: 'symptoms',
                type: 'string',
                description: 'Description of the symptoms the user is experiencing',
                required: true,
            },
            {
                name: 'duration',
                type: 'string',
                description: 'How long the symptoms have been present (optional)',
                required: false,
            },
            {
                name: 'severity',
                type: 'string',
                description: 'Severity level: mild, moderate, or severe (optional)',
                required: false,
            },
        ],
        execute: async (params: { symptoms: string; duration?: string; severity?: string }): Promise<string> => {
            try {
                const { symptoms, duration, severity } = params;

                logger.info('Symptom triage requested', { symptoms, duration, severity });

                // Find matching symptom (now async due to translation fallback)
                const symptomKey = await findSymptom(symptoms);

                if (!symptomKey || !symptomDatabase[symptomKey]) {
                    // General guidance if symptom not found
                    return getBilingualResponse(
                        `I understand you're not feeling well. Based on your symptoms: "${symptoms}"\n\n` +
                        `**General Advice:**\n` +
                        `• Rest and drink plenty of fluids\n` +
                        `• Monitor your symptoms\n` +
                        `• If symptoms worsen or persist for more than 2-3 days, please visit a health facility\n\n` +
                        `Would you like me to help you find the nearest health facility?`,
                        `A ɔndastand se yu nɔ de fil fayn. Bays ɔn wetin yu de fil: "${symptoms}"\n\n` +
                        `**Jɛnɛral Advays:**\n` +
                        `• Res ɛn drink plenty wata\n` +
                        `• Wach yu bɔdi\n` +
                        `• If i wɔs ɔ pas 2-3 die, go na ɛlt fasɛliti\n\n` +
                        `Yu want mek a ɛp yu fɛn di klozes ɛlt fasɛliti?`
                    );
                }

                const guidance = symptomDatabase[symptomKey];

                // Build response based on urgency
                let response = '';

                // Add urgency indicator
                const urgencyEmoji = {
                    emergency: '🚨',
                    urgent: '⚠️',
                    moderate: '🔶',
                    routine: '🟢',
                };

                const urgencyLabel = {
                    emergency: 'EMERGENCY',
                    urgent: 'URGENT - Seek care today',
                    moderate: 'Moderate - Monitor closely',
                    routine: 'Mild - Home care appropriate',
                };

                const urgencyLabelKrio = {
                    emergency: 'EMƐJƐNSI',
                    urgent: 'ƆJƐNT - Go si dɔkta tide',
                    moderate: 'Mɔdɛret - Wach am gud',
                    routine: 'Smɔl - Om kia go du',
                };

                // English response
                response += `${urgencyEmoji[guidance.urgency]} **${urgencyLabel[guidance.urgency]}**\n\n`;
                response += guidance.englishAdvice + '\n';

                // Add home care if available and not emergency
                if (guidance.homeCare && guidance.urgency !== 'emergency') {
                    response += '\n**Home Care Tips:**\n';
                    guidance.homeCare.forEach(tip => {
                        response += `• ${tip}\n`;
                    });
                }

                // Add follow-up questions if available
                if (guidance.questions && guidance.urgency !== 'emergency') {
                    response += '\n**To help you better, can you tell me:**\n';
                    guidance.questions.forEach(q => {
                        response += `• ${q}\n`;
                    });
                }

                // Add Krio translation
                response += `\n---\n🇸🇱 **Na Krio:**\n\n`;
                response += `${urgencyEmoji[guidance.urgency]} **${urgencyLabelKrio[guidance.urgency]}**\n\n`;
                response += guidance.krioAdvice + '\n';

                if (guidance.krioHomeCare && guidance.urgency !== 'emergency') {
                    response += '\n**Om Kia Tips:**\n';
                    guidance.krioHomeCare.forEach(tip => {
                        response += `• ${tip}\n`;
                    });
                }

                if (guidance.krioQuestions && guidance.urgency !== 'emergency') {
                    response += '\n**Fɔ ɛp yu bɛta, tɛl mi:**\n';
                    guidance.krioQuestions.forEach(q => {
                        response += `• ${q}\n`;
                    });
                }

                logger.info('Symptom triage completed', {
                    symptomKey,
                    urgency: guidance.urgency,
                    referralNeeded: guidance.referralNeeded
                });

                return response;

            } catch (error) {
                logger.error('Symptom triage failed', error as Error);
                return getBilingualResponse(
                    'I encountered an issue processing your symptoms. Please describe them again or visit your nearest health facility.',
                    'A gɛt prɔblɛm fɔ prɔsɛs wetin yu tɛl mi. Duya tɛl mi agen ɔ go na di ɛlt fasɛliti klos tu yu.'
                );
            }
        },
    };
};
