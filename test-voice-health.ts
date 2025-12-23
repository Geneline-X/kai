
import { getVoiceService } from './src/services/voice-service';
import { logger } from './src/utils/logger';
import { config } from './src/config/env';
import axios from 'axios';

async function testVoiceHealth() {
    console.log('🎤 Testing Voice Service Health...\n');

    try {
        const voiceService = getVoiceService();
        console.log('Voice Service instantiated.');

        // Debug Config
        const key = config.kay.apiKey;
        const host = config.kay.host;
        console.log(`\nConfiguration: `);
        console.log(`- Host: ${host} `);
        console.log(`- API Key: ${key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : 'MISSING'} `);

        console.log('\nChecking health...');

        // Manual check for detailed errors
        try {
            console.log('Testing Transcribe Endpoint...');
            await axios.get(`${host}/api/v1/health`, { timeout: 5000 });
            console.log('- Transcription (ASR): ✅ Online');
        } catch (error: any) {
            console.log(`- Transcription (ASR): ❌ Offline (${error.message})`);
            if (error.response) {
                console.log(`  Status: ${error.response.status}`);
                console.log(`  Data: ${JSON.stringify(error.response.data)}`);
            }
        }

        try {
            console.log('Testing TTS Endpoint...');
            await axios.get(`${host}/api/v1/tts/health`, {
                headers: { 'X-API-Key': key },
                timeout: 5000,
            });
            console.log('- Text-to-Speech (TTS): ✅ Online');
        } catch (error: any) {
            console.log(`- Text-to-Speech (TTS): ❌ Offline (${error.message})`);
            if (error.response) {
                console.log(`  Status: ${error.response.status}`);
                console.log(`  Data: ${JSON.stringify(error.response.data)}`);
            }
        }

    } catch (error) {
        console.error('❌ Error testing voice service:', error);
    }
}

testVoiceHealth().catch(console.error);
