import axios from 'axios';
import { config } from './src/config/env';

async function listVoices() {
    const apiKey = config.voiceResponse.googleApiKey;
    if (!apiKey) {
        console.error('No API key found');
        return;
    }

    const url = `https://texttospeech.googleapis.com/v1beta1/voices?key=${apiKey}`;

    try {
        const response = await axios.get(url);
        const voices = response.data.voices;

        const locales = new Set();
        voices.forEach((v: any) => v.languageCodes.forEach((c: string) => locales.add(c)));

        console.log('v1beta1 English locales:');
        Array.from(locales).filter((c: any) => c.startsWith('en-')).sort().forEach(c => console.log(`- ${c}`));

    } catch (error: any) {
        console.error('Error fetching voices:', error.response?.data || error.message);
    }
}

listVoices();
