/**
 * Alternative transcription test using native https module
 * This bypasses axios to see if that's causing the 404
 */

const https = require('https');
const FormData = require('form-data');
const fs = require('fs');

const KAY_HOST = process.env.KAY_HOST || 'https://kay.geneline-x.net';
const KAY_API_KEY = process.env.KAY_API_KEY;

console.log('=== Testing Transcription with Native HTTPS ===\n');
console.log(`KAY_HOST: ${KAY_HOST}`);
console.log(`KAY_API_KEY: ${KAY_API_KEY ? 'SET' : 'NOT SET'}\n`);

// Create a small test audio buffer (just dummy data for testing)
const testAudioBuffer = Buffer.from('test audio data');

const formData = new FormData();
formData.append('file', testAudioBuffer, {
    filename: 'test.ogg',
    contentType: 'audio/ogg',
});

const url = new URL(`${KAY_HOST}/api/v1/transcribe`);

console.log(`Endpoint: ${url.href}\n`);

const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        ...formData.getHeaders(),
        'X-API-Key': KAY_API_KEY,
    },
};

console.log('Request headers:', JSON.stringify(options.headers, null, 2));
console.log('\nSending request...\n');

const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`\nResponse:`);
        console.log(data);

        if (res.statusCode === 404) {
            console.log('\n❌ Still getting 404 with native https!');
            console.log('This means the issue is NOT with axios.');
        } else if (res.statusCode === 400) {
            console.log('\n✅ Got 400 (expected - invalid audio data)');
            console.log('The endpoint works with multipart form data!');
        } else {
            console.log(`\nGot status: ${res.statusCode}`);
        }
    });
});

req.on('error', (error) => {
    console.log(`\n❌ Error: ${error.message}`);
});

formData.pipe(req);
