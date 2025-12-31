import { config } from './src/config/env';
import { getVoiceService } from './src/services/voice-service';
import { logger } from './src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Diagnostic script to troubleshoot voice transcription issues
 * This will help identify why voice messages are failing
 */
async function diagnoseVoiceTranscription() {
    console.log('=== Voice Transcription Diagnostic ===\n');

    // 1. Check configuration
    console.log('--- Configuration Check ---');
    console.log(`KAY_HOST: ${config.kay.host}`);
    console.log(`KAY_API_KEY: ${config.kay.apiKey ? `${config.kay.apiKey.substring(0, 8)}...` : 'NOT SET'}`);
    console.log(`KAY_ALWAYS_TRANSLATE_VOICE: ${config.kay.alwaysTranslateVoice}`);
    console.log(`GENELINE_API_KEY (fallback): ${config.geneline.apiKey ? `${config.geneline.apiKey.substring(0, 8)}...` : 'NOT SET'}`);

    if (!config.kay.apiKey && !config.geneline.apiKey) {
        console.log('\n❌ ERROR: No API key configured!');
        console.log('Please set KAY_API_KEY in your .env file');
        console.log('Example: KAY_API_KEY=kay_your_api_key_here');
        return;
    }

    // 2. Test API connectivity
    console.log('\n--- API Connectivity Test ---');
    const voiceService = getVoiceService();

    try {
        const health = await voiceService.checkHealth();
        console.log(`Transcribe API: ${health.transcribe ? '✅ Available' : '❌ Unavailable'}`);
        console.log(`TTS API: ${health.tts ? '✅ Available' : '❌ Unavailable'}`);

        if (!health.transcribe) {
            console.log('\n⚠️  WARNING: Transcription API is not available!');
            console.log('This could be due to:');
            console.log('1. Invalid API key');
            console.log('2. Network connectivity issues');
            console.log('3. Kay API service is down');
        }
    } catch (error: any) {
        console.log(`❌ Health check failed: ${error.message}`);
    }

    // 3. Check for sample audio files
    console.log('\n--- Sample Audio Test ---');
    console.log('To test transcription with a real audio file:');
    console.log('1. Save a voice message as audio.ogg in the project root');
    console.log('2. Run this script again');

    const sampleAudioPath = path.join(process.cwd(), 'audio.ogg');
    if (fs.existsSync(sampleAudioPath)) {
        console.log('\n✅ Found audio.ogg file, testing transcription...');

        try {
            const audioBuffer = fs.readFileSync(sampleAudioPath);
            console.log(`Audio file size: ${audioBuffer.length} bytes`);

            const result = await voiceService.transcribeAudio(
                audioBuffer,
                'audio/ogg',
                'audio.ogg'
            );

            if (result.success && result.text) {
                console.log('\n✅ Transcription successful!');
                console.log(`Transcribed text: "${result.text}"`);
            } else {
                console.log('\n❌ Transcription failed');
                console.log(`Error: ${result.error || 'Unknown error'}`);
            }
        } catch (error: any) {
            console.log(`\n❌ Error testing audio file: ${error.message}`);
        }
    } else {
        console.log(`\n⚠️  No sample audio file found at: ${sampleAudioPath}`);
    }

    // 4. Common issues and solutions
    console.log('\n--- Common Issues & Solutions ---');
    console.log('');
    console.log('Issue: "couldn\'t understand it" message');
    console.log('Causes:');
    console.log('  1. KAY_API_KEY not set in .env file');
    console.log('  2. API key is invalid or expired');
    console.log('  3. Audio format not supported by Kay API');
    console.log('  4. Network connectivity issues');
    console.log('');
    console.log('Solutions:');
    console.log('  1. Add KAY_API_KEY to your .env file on Render');
    console.log('  2. Verify the API key is correct');
    console.log('  3. Check Kay API documentation for supported formats');
    console.log('  4. Test API connectivity from your server');
    console.log('');
    console.log('To fix on Render:');
    console.log('  1. Go to your service dashboard');
    console.log('  2. Navigate to Environment section');
    console.log('  3. Add: KAY_API_KEY = <your-kay-api-key>');
    console.log('  4. Redeploy the service');
}

diagnoseVoiceTranscription().catch(console.error);
