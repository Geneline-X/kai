/**
 * Test transcription with base64 encoded audio (alternative to multipart)
 */

const https = require('https');

const KAY_HOST = process.env.KAY_HOST || 'https://kay.geneline-x.net';
const KAY_API_KEY = process.env.KAY_API_KEY;

console.log('=== Testing Transcription with Base64 Encoding ===\n');

// Create test audio buffer
const testAudioBuffer = Buffer.from('test audio data');
const base64Audio = testAudioBuffer.toString('base64');

const url = new URL(`${KAY_HOST}/api/v1/transcribe`);

// Try JSON payload with base64
const payload = JSON.stringify({
    audio: base64Audio,
    format: 'ogg',
});

const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-API-Key': KAY_API_KEY,
    },
};

console.log(`Endpoint: ${url.href}`);
console.log(`Payload type: JSON with base64 audio\n`);

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Response: ${data}\n`);

        if (res.statusCode === 404) {
            console.log('❌ Still 404 with JSON payload');
        } else if (res.statusCode === 400) {
            console.log('✅ Endpoint accepts JSON (400 = invalid audio data)');
        } else if (res.statusCode === 200) {
            console.log('✅ Success! (though audio is invalid)');
        } else {
            console.log(`Status: ${res.statusCode}`);
        }
    });
});

req.on('error', (error) => {
    console.log(`Error: ${error.message}`);
});

req.write(payload);
req.end();
