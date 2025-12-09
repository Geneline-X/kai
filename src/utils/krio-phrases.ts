/**
 * Krio Health Phrases Utility
 * Common health-related phrases in Krio (Sierra Leone Creole)
 * Used for making health information accessible to local population
 */

// Common greetings and responses
export const krioGreetings = {
    hello: 'Kushe',
    howAreYou: 'Aw di bɔdi?',
    iAmFine: 'A de ol rayt',
    thankYou: 'Tenki ya',
    goodbye: 'A de go',
    welcome: 'Welkɔm',
    please: 'Duya',
    yes: 'Yɛs / Ee',
    no: 'Nɔ',
};

// Symptom descriptions in Krio
export const krioSymptoms = {
    fever: 'Fiba / Bɔdi ɔt',
    headache: 'Ɛd de wɔri mi / Ɛd de pɛn / Edek / A get edek',
    stomachPain: 'Bɛlɛ de wɔri mi / Bɛlɛ de pɛn / Bele de pen',
    vomiting: 'Troway / A de vɔmit / A de trowe',
    diarrhea: 'Rɔnbɛlɛ / Wata de kɔmɔt / Runbele',
    cough: 'Kɔf / A de kof',
    coldSymptoms: 'Kol kech mi / Kold kech mi',
    weakness: 'A fil wik / Nɔ gɛt pawa / A weak',
    dizziness: 'Ɛd de tɔn / A de dizi / Ed de ton',
    bodyPain: 'Bɔdi de pɛn / Bodi de pen / A get bodi pen',
    chestPain: 'Ches de pɛn / Chest de pen',
    difficultyBreathing: 'A nɔ de brid fayn / No de brid fine',
    rash: 'Skin de itch / Rash / Skin de scratch',
    swelling: 'Swɛl ɔp / Swel up / I swell',
    bleeding: 'Blɔd de kɔmɔt / Blood de komot',
    convulsions: 'Fit de kech am / Fit catch am',
};

// Common symptom variations (for fuzzy matching)
export const krioSymptomVariations: Record<string, string[]> = {
    headache: [
        'edek', 'edik', 'ɛdɛk', 'a get edek', 'agat edik', 'a gat edek',
        'ed de wori', 'ed de pen', 'ɛd de wɔri', 'ɛd de pɛn',
        'mi ed de wori', 'mi ed de pen', 'my head hurt',
        'head ache', 'headache', 'head pain'
    ],
    fever: [
        'fiba', 'fever', 'bodi ot', 'bɔdi ɔt', 'body hot',
        'a get fiba', 'a gat fiba', 'mi bodi ot', 'temperature'
    ],
    stomachPain: [
        'bele de wori', 'bɛlɛ de wɔri', 'bele de pen', 'bɛlɛ de pɛn',
        'belly pain', 'stomach pain', 'stomach ache', 'belly ache',
        'mi bele de wori', 'a get bele pen'
    ],
    vomiting: [
        'troway', 'trowe', 'a de troway', 'a de trowe',
        'vomit', 'vomiting', 'throwing up', 'a de vomit'
    ],
    diarrhea: [
        'ronbele', 'rɔnbɛlɛ', 'runbele', 'run belly',
        'wata de komot', 'loose stool', 'diarrhea', 'watery stool'
    ],
    cough: [
        'kof', 'kɔf', 'cough', 'coughing', 'a de kof', 'a de cough'
    ],
    bodyPain: [
        'bodi de pen', 'bɔdi de pɛn', 'body pain', 'body ache',
        'a get bodi pen', 'mi bodi de pen', 'aching', 'all over pain'
    ],
};

// Urgency indicators in Krio
export const krioUrgency = {
    emergency: 'Emɛjɛnsi! Go na ɔspitul naw naw!',
    urgent: 'Dis impɔtant - go si dɔkta tide',
    routine: 'Yu fɔ mɔnita dis. If i wɔs, go na klinik',
    seekCare: 'Go si dɔkta ɔ ɛlt wɔka',
    callHelp: 'Kɔl fɔ ɛp naw!',
    goToHospital: 'Go na ɔspitul kwik kwik',
    goToClinic: 'Go na klinik',
    stayHome: 'Res na os fɔ naw',
};

// Home care instructions in Krio
export const krioHomeCare = {
    drinkWater: 'Drink plenty wata',
    rest: 'Res gud gud',
    eatWell: 'It gud gud',
    takeParacetamol: 'Tek paracetamol fɔ fiba/pɛn',
    useORS: 'Yuz ORS (Oral Rehydration Salt) fɔ rɔnbɛlɛ',
    sleepUnderNet: 'Slip insay mɔskito nɛt',
    washHands: 'Was yu an dɛm wit sop ɛn wata',
    keepClean: 'Kip insay klin',
    avoidCrowds: 'Nɔ go we plenty pipul de',
    wearMask: 'Yuz mask',
    isolate: 'Stap insay fɔ naw, nɔ miksin wit ɔda pipul',
    monitorSymptoms: 'Wach yu bɔdi - if i wɔs, go ospitul',
};

// Common disease names in Krio
export const krioDiseases = {
    malaria: 'Malɛria / Fiba',
    cholera: 'Kɔlɛra',
    typhoid: 'Tayfɔyd',
    ebola: 'Ibola',
    lassaFever: 'Lasa Fiba',
    covid19: 'Korona Vayrus / COVID',
    measles: 'Mizul',
    diarrhea: 'Rɔnbɛlɛ',
    pneumonia: 'Nimonia',
    tuberculosis: 'TB / Jɔs',
    hiv: 'HIV/AIDS',
    yellowFever: 'Yɛlo Fiba',
};

// Health alert templates in Krio
export const krioAlertTemplates = {
    outbreak: (disease: string, area: string) =>
        `⚠️ ƐLT ALAT: ${disease} de spred na ${area}. Duya tek kia!`,
    vaccination: (vaccine: string, location: string) =>
        `💉 VAKSIN KAMPƐN: ${vaccine} vaksin de avilɛbul na ${location}. Go tek yu vaksin!`,
    prevention: (disease: string, advice: string) =>
        `🛡️ PRIVƐNSHƆN TIP: Fɔ stɔp ${disease}: ${advice}`,
    general: (message: string) =>
        `📢 ƐLT INFƆMƐSHƆN: ${message}`,
    emergency: (message: string) =>
        `🚨 EMƐJƐNSI ALAT: ${message}`,
};

// Response templates for bilingual support
export const krioResponses = {
    greeting: 'Kushe! A de yah fɔ ɛp yu wit yu ɛlt kwɛshɔn dɛm. Wetin a go du fɔ yu tide?',
    askSymptoms: 'Tɛl mi wetin de wɔri yu. Wetin yu de fil?',
    askDuration: 'Aw lɔng dis de gɔ ɔn?',
    askSeverity: 'I bad bad ɔ smɔl smɔl?',
    understandSymptom: 'A ɔndastand. Lɛ mi ɛp yu.',
    goToHospitalNow: '⚠️ Dis siryɔs! Go na ɔspitul naw naw!',
    seekCareToday: 'Duya go si dɔkta ɔ ɛlt wɔka tide.',
    homeCareAdvice: 'Yu go bi fayn wit om kia fɔ naw. Dis na wetin yu fɔ du:',
    monitorAndReturn: 'If i wɔs ɔ nɔ bɛta afta 2-3 die, go na klinik.',
    escalatingToHuman: 'A de kɔnɛkt yu tu wan ɛlt wɔka we go ɛp yu bɛta.',
    thankYouMessage: 'Tenki fɔ tɔk tu wi. Tek kia ya!',
    anythingElse: 'Ɛni ɔda tin a go du fɔ ɛp yu?',
};

// Duration terms in Krio
export const krioDuration = {
    today: 'tudɛ',
    yesterday: 'yɛstɛdɛ',
    fewDays: 'smɔl die',
    oneWeek: 'wan wik',
    twoWeeks: 'tu wik',
    oneMonth: 'wan mɔnt',
    longTime: 'lɔng tɛm',
};

// Severity terms in Krio
export const krioSeverity = {
    mild: 'smɔl smɔl / nɔ tu bad',
    moderate: 'i de / na mid',
    severe: 'bad bad / siryɔs',
    veryBad: 'bad bad bad',
    gettingWorse: 'i de wɔs',
    gettingBetter: 'i de bɛta smɔl smɔl',
    noChange: 'i sem sem',
};

/**
 * Detect if a message is likely in Krio
 * Uses common Krio words and patterns
 */
export function detectKrio(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Common Krio words and patterns
    const krioIndicators = [
        'kushe', 'aw di bodi', 'tenki', 'duya', 'wetin',
        'de wori', 'de pen', 'na ospitul', 'go ospitul',
        'mi bodi', 'fiba', 'a de', 'yu de', 'wi de',
        'na ya', 'naw naw', 'lef am', 'noh', 'dɛn',
        'pikin', 'uman', 'opin', 'sik', 'bad bad',
        'smol smol', 'plenty', 'komot', 'go kam',
        'di bodi', 'ed de', 'bele', 'kof', 'wata',
        'lek', 'mek', 'foh', 'fo', 'ya', 'dey',
    ];

    // Check for Krio indicators
    const matchCount = krioIndicators.filter(indicator =>
        lowerMessage.includes(indicator)
    ).length;

    // If 2+ Krio words found, likely Krio
    return matchCount >= 2;
}

/**
 * Get a bilingual response (English + Krio)
 */
export function getBilingualResponse(english: string, krio: string): string {
    return `${english}\n\n🇸🇱 Na Krio: ${krio}`;
}

/**
 * Format a health alert in Krio
 */
export function formatHealthAlertKrio(
    type: 'outbreak' | 'vaccination' | 'prevention' | 'general' | 'emergency',
    params: { disease?: string; area?: string; vaccine?: string; location?: string; advice?: string; message?: string }
): string {
    switch (type) {
        case 'outbreak':
            return krioAlertTemplates.outbreak(params.disease || '', params.area || '');
        case 'vaccination':
            return krioAlertTemplates.vaccination(params.vaccine || '', params.location || '');
        case 'prevention':
            return krioAlertTemplates.prevention(params.disease || '', params.advice || '');
        case 'emergency':
            return krioAlertTemplates.emergency(params.message || '');
        default:
            return krioAlertTemplates.general(params.message || '');
    }
}

/**
 * Calculate simple string similarity (Levenshtein-like)
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1.0;

    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Calculate Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const maxLen = Math.max(s1.length, s2.length);
    const distance = matrix[s2.length][s1.length];
    return 1 - (distance / maxLen);
}

/**
 * Find matching symptom from Krio text using fuzzy matching
 * Returns the symptom key and confidence score
 */
export function findKrioSymptom(text: string): { symptom: string; confidence: number } | null {
    const lowerText = text.toLowerCase().trim();
    let bestMatch: { symptom: string; confidence: number } | null = null;

    // Check each symptom variation
    for (const [symptom, variations] of Object.entries(krioSymptomVariations)) {
        for (const variation of variations) {
            const similarity = calculateSimilarity(lowerText, variation);

            // If we find a good match (>= 0.7 similarity)
            if (similarity >= 0.7) {
                if (!bestMatch || similarity > bestMatch.confidence) {
                    bestMatch = { symptom, confidence: similarity };
                }
            }
        }
    }

    return bestMatch;
}

/**
 * Extract symptoms from a message using fuzzy matching
 * Returns array of detected symptoms with confidence scores
 */
export function extractKrioSymptoms(message: string): Array<{ symptom: string; confidence: number }> {
    const detectedSymptoms: Array<{ symptom: string; confidence: number }> = [];
    const words = message.toLowerCase().split(/\s+/);

    // Try matching the full message first
    const fullMatch = findKrioSymptom(message);
    if (fullMatch && fullMatch.confidence >= 0.7) {
        detectedSymptoms.push(fullMatch);
        return detectedSymptoms;
    }

    // Try matching phrases (2-4 words)
    for (let len = 4; len >= 2; len--) {
        for (let i = 0; i <= words.length - len; i++) {
            const phrase = words.slice(i, i + len).join(' ');
            const match = findKrioSymptom(phrase);

            if (match && match.confidence >= 0.7) {
                // Check if we already have this symptom
                const existing = detectedSymptoms.find(s => s.symptom === match.symptom);
                if (!existing || match.confidence > existing.confidence) {
                    if (existing) {
                        existing.confidence = match.confidence;
                    } else {
                        detectedSymptoms.push(match);
                    }
                }
            }
        }
    }

    return detectedSymptoms;
}
