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
    headache: 'Ɛd de wɔri mi / Ɛd de pɛn',
    stomachPain: 'Bɛlɛ de wɔri mi / Bɛlɛ de pɛn',
    vomiting: 'Troway / A de vɔmit',
    diarrhea: 'Rɔnbɛlɛ / Wata de kɔmɔt',
    cough: 'Kɔf',
    coldSymptoms: 'Kol kech mi',
    weakness: 'A fil wik / Nɔ gɛt pawa',
    dizziness: 'Ɛd de tɔn / A de dizi',
    bodyPain: 'Bɔdi de pɛn',
    chestPain: 'Ches de pɛn',
    difficultyBreathing: 'A nɔ de brid fayn',
    rash: 'Skin de itch / Rash',
    swelling: 'Swɛl ɔp',
    bleeding: 'Blɔd de kɔmɔt',
    convulsions: 'Fit de kech am',
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
