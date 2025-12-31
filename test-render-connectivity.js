/**
 * Test Kay API connectivity from Render
 * Run this on Render shell: node test-render-connectivity.js
 */

const https = require('https');

const KAY_HOST = process.env.KAY_HOST || 'https://kay.geneline-x.net';
const KAY_API_KEY = process.env.KAY_API_KEY;

console.log('=== Testing Kay API Connectivity from Render ===\n');
console.log(`KAY_HOST: ${KAY_HOST}`);
console.log(`KAY_API_KEY: ${KAY_API_KEY ? `${KAY_API_KEY.substring(0, 8)}...` : 'NOT SET'}\n`);

// Parse the URL
const url = new URL(`${KAY_HOST}/api/v1/transcribe`);

console.log(`Testing endpoint: ${url.href}\n`);

const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
        'X-API-Key': KAY_API_KEY || 'test-key',
        'Content-Type': 'application/json',
    },
    timeout: 10000,
};

const req = https.request(options, (res) => {
    console.log(`✅ Connected to server`);
    console.log(`HTTP Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`\nResponse Body:`);
        console.log(data);

        if (res.statusCode === 404) {
            console.log('\n❌ ERROR: 404 Not Found');
            console.log('The endpoint does not exist or is not accessible from Render.');
            console.log('\nPossible causes:');
            console.log('1. KAY_HOST is incorrect');
            console.log('2. DNS resolution issue');
            console.log('3. Firewall blocking Render servers');
            console.log('4. Kay API is down or moved');
        } else if (res.statusCode === 403) {
            console.log('\n✅ Endpoint exists! (403 = invalid/missing API key)');
            console.log('The connection works, but the API key might be invalid.');
        } else if (res.statusCode === 400) {
            console.log('\n✅ Endpoint exists! (400 = missing file in request)');
            console.log('The connection works perfectly!');
        } else {
            console.log(`\nℹ️  Unexpected status code: ${res.statusCode}`);
        }
    });
});

req.on('error', (error) => {
    console.log(`\n❌ Connection Error:`);
    console.log(error.message);
    console.log('\nThis could mean:');
    console.log('1. DNS cannot resolve kay.geneline-x.net');
    console.log('2. Network connectivity issue from Render');
    console.log('3. Firewall blocking the connection');
});

req.on('timeout', () => {
    console.log('\n❌ Request Timeout');
    console.log('The server is not responding within 10 seconds.');
    req.destroy();
});

req.end();
