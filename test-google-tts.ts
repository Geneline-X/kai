import { getVoiceService } from './src/services/voice-service';
import { logger } from './src/utils/logger';
import { config } from './src/config/env';
import * as fs from 'fs';
import * as path from 'path';

async function testGoogleTTS() {
    console.log('🎤 Testing Google Cloud TTS Synthesis...\n');

    try {
        const voiceService = getVoiceService();

        // Ensure voice responses are enabled for testing
        (config.voiceResponse as any).enabled = true;
        (config.voiceResponse as any).provider = 'google';

        console.log('Configuration:');
        console.log(`- Provider: ${config.voiceResponse.provider}`);
        console.log(`- Voice: ${config.voiceResponse.googleVoiceName}`);
        console.log(`- Language: ${config.voiceResponse.googleLanguageCode}`);
        console.log(`- API Key: ${config.voiceResponse.googleApiKey ? 'PRESENT' : 'MISSING'}`);

        if (!config.voiceResponse.googleApiKey) {
            console.error('❌ Error: GOOGLE_TTS_API_KEY is not set in .env');
            return;
        }

        const testText = "Hello! This is a test response from your Geneline health assistant. I am now speaking using Google Cloud Text to Speech.";
        console.log(`\nSynthesizing: "${testText}"`);

        const result = await voiceService.synthesizeSpeech(testText);

        if (result.success && result.audioBuffer) {
            console.log('\n✅ Success! Audio buffer generated.');
            console.log(`- Buffer Size: ${result.audioBuffer.length} bytes`);

            const outputPath = path.join(__dirname, 'test-output.mp3');
            fs.writeFileSync(outputPath, result.audioBuffer);
            console.log(`- Saved to: ${outputPath}`);
            console.log('\nPlease play this file to verify the audio quality.');
        } else {
            console.error('\n❌ Synthesis Failed:');
            console.error(`- Error: ${result.error}`);
        }

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    }
}

testGoogleTTS().catch(console.error);
