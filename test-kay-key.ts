
import axios from 'axios';
import { config } from './src/config/env';

async function testKayKey() {
    const host = config.kay.host || 'https://kay.geneline-x.net';
    const key = config.kay.apiKey;

    console.log(`Testing Kay API Key at ${host}`);
    console.log(`Key: ${key ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : 'MISSING'}`);

    try {
        console.log('\n--- Testing TTS Request ---');
        const response = await axios.post(
            `${host}/api/v1/tts/audio`,
            {
                text: "Hello",
                speaker_id: 0,
                do_sample: true,
                temperature: 0.5,
                top_p: 0.7,
                max_new_tokens: 1024,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': key,
                },
                responseType: 'arraybuffer',
                timeout: 30000,
            }
        );

        console.log(`✅ TTS Request Successful! Status: ${response.status}`);
        console.log(`Audio data received: ${response.data.byteLength} bytes`);
    } catch (error: any) {
        console.error(`❌ TTS Request Failed`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${error.response.data ? Buffer.from(error.response.data).toString() : 'null'}`);
        } else {
            console.error(`Message: ${error.message}`);
        }
    }

    try {
        console.log('\n--- Testing Transcribe Endpoint (with Key) ---');
        // Sending a POST without a file should return 400 if key is valid, or 401 if invalid
        const response = await axios.post(`${host}/api/v1/transcribe`, {}, {
            headers: { 'X-API-Key': key },
            timeout: 5000
        });
        console.log(`⚠️ Transcribe Endpoint returned ${response.status} (unexpected 200)`);
    } catch (error: any) {
        if (error.response) {
            if (error.response.status === 401 || error.response.status === 403) {
                console.log(`❌ kay_API_KEY is INVALID or INACTIVE (returned ${error.response.status})`);
            } else if (error.response.status === 400) {
                console.log(`✅ kay_API_KEY appears to be ACTIVE (returned 400 Bad Request, which typically means the key was accepted but the payload was incomplete)`);
            } else {
                console.log(`ℹ️ Transcribe Endpoint returned status ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`);
            }
        } else {
            console.error(`❌ Transcribe Endpoint check failed: ${error.message}`);
        }
    }

    try {
        console.log('\n--- Testing Transcribe Endpoint (with INVALID Key) ---');
        const response = await axios.post(`${host}/api/v1/transcribe`, {}, {
            headers: { 'X-API-Key': 'invalid_key' },
            timeout: 5000
        });
        console.log(`⚠️ Transcribe Endpoint returned ${response.status} (unexpected 200)`);
    } catch (error: any) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            console.log(`✅ Success: Transcribe endpoint validates the key (returned ${error.response.status} for invalid key).`);
        } else {
            console.log(`ℹ️ Transcribe Endpoint (INVALID Key) returned status ${error.response?.status || 'Error'}. Message: ${error.message}`);
        }
    }
}

testKayKey().catch(console.error);
