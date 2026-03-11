import { Client, LocalAuth } from 'whatsapp-web.js';
import { config } from './config/env';
import { logger } from './utils/logger';

async function test() {
    console.log('Starting WhatsApp Client Diagnostic...');

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: config.whatsapp.clientId,
            dataPath: './.wwebjs_auth',
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox'],
        },
        webVersionCache: {
            type: 'local',
        }
    });

    client.on('qr', (qr) => {
        console.log('QR Code received. Diagnostic needs authenticated session to test media.');
    });

    client.on('ready', async () => {
        console.log('Client is ready!');
        console.log('Attempting to find a message with media to test download...');

        try {
            const chats = await client.getChats();
            for (const chat of chats) {
                const messages = await chat.fetchMessages({ limit: 10 });
                for (const msg of messages) {
                    if (msg.hasMedia) {
                        console.log(`Found media message in chat ${chat.name} (type: ${msg.type})`);
                        console.log('Attempting download...');
                        try {
                            const media = await msg.downloadMedia();
                            if (media) {
                                console.log('✅ Media download SUCCESSFUL!');
                                process.exit(0);
                            } else {
                                console.log('❌ Media download returned null.');
                            }
                        } catch (err: any) {
                            console.log(`❌ Media download FAILED: ${err.message}`);
                        }
                    }
                }
            }
            console.log('No media messages found in recent history to test.');
            process.exit(0);
        } catch (err: any) {
            console.error('Error during diagnostic:', err);
            process.exit(1);
        }
    });

    console.log('Initializing client...');
    await client.initialize();
}

test().catch(err => {
    console.error('Fatal error in diagnostic:', err);
    process.exit(1);
});
