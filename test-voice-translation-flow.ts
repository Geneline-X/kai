import { getVoiceService } from './src/services/voice-service';
import { logger } from './src/utils/logger';

/**
 * Test script to verify the voice translation flow:
 * 1. Simulate a Krio voice message transcription
 * 2. Translate it to English using Kay API
 * 3. Verify the translation works correctly
 */
async function testVoiceTranslationFlow() {
    console.log('=== Testing Voice Translation Flow ===\n');

    const voiceService = getVoiceService();

    // Sample Krio phrases that might come from voice transcription
    const krioSamples = [
        'A de fil bad bad, mi bodi de hot',
        'Mi pikin get fiva ɛn i de kɔf',
        'A nid dɔkta naw naw',
        'Usai a go fayn ɔspital?',
    ];

    let successCount = 0;
    let failCount = 0;

    for (const krioText of krioSamples) {
        console.log(`\n--- Testing Krio Text ---`);
        console.log(`Original (Krio): "${krioText}"`);

        try {
            const result = await voiceService.translateKrioToEnglish(krioText);

            if (result.success && result.translatedText) {
                console.log(`✅ Translation successful!`);
                console.log(`Translated (English): "${result.translatedText}"`);
                successCount++;
            } else {
                console.log(`❌ Translation failed: ${result.error || 'Unknown error'}`);
                failCount++;
            }
        } catch (error: any) {
            console.log(`❌ Translation error: ${error.message}`);
            failCount++;
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n=== Test Summary ===`);
    console.log(`Total tests: ${krioSamples.length}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Success rate: ${((successCount / krioSamples.length) * 100).toFixed(1)}%`);

    if (successCount === krioSamples.length) {
        console.log(`\n🎉 All translations successful! Voice translation flow is working correctly.`);
    } else if (successCount > 0) {
        console.log(`\n⚠️  Some translations failed. Check Kay API configuration and network connectivity.`);
    } else {
        console.log(`\n❌ All translations failed. Please verify Kay API key and endpoint configuration.`);
    }
}

testVoiceTranslationFlow().catch(console.error);
