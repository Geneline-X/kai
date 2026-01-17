import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import qrCodeTerminal from 'qrcode-terminal';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface WhatsAppClientState {
    isReady: boolean;
    qrCode?: string; // base64 PNG
    clientInfo?: {
        pushname: string;
        platform: string;
    };
}

export class WhatsAppClient extends EventEmitter {
    private client: Client;
    private state: WhatsAppClientState = {
        isReady: false,
    };

    constructor() {
        super();

        // Detect Chrome/Chromium path based on environment
        const getChromePath = (): string => {
            // Use environment variable if set (highest priority)
            const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
            if (envPath && fs.existsSync(envPath)) {
                return envPath;
            } else if (envPath) {
                logger.warn(`Chromium path from environment does not exist: ${envPath}. Falling back to OS defaults.`);
            }

            // Detect based on OS
            const platform = os.platform();
            if (platform === 'linux') {
                // Linux/Docker (Render, Railway, etc.)
                const linuxPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
                for (const p of linuxPaths) {
                    if (fs.existsSync(p)) return p;
                }
                return '/usr/bin/chromium'; // Fallback
            } else if (platform === 'darwin') {
                // macOS
                const macPaths = [
                    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                    '/Applications/Chromium.app/Contents/MacOS/Chromium'
                ];
                for (const p of macPaths) {
                    if (fs.existsSync(p)) return p;
                }
                return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; // Fallback
            } else if (platform === 'win32') {
                // Windows
                const winPaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
                ];
                for (const p of winPaths) {
                    if (fs.existsSync(p)) return p;
                }
                return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; // Fallback
            }

            // Fallback
            return '/usr/bin/chromium';
        };

        const chromePath = getChromePath();
        logger.info('Chrome executable path', { path: chromePath, platform: os.platform() });

        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: config.whatsapp.clientId,
                dataPath: './.wwebjs_auth', // Keep session data on persistent disk
            }),
            takeoverOnConflict: true,
            takeoverTimeoutMs: 0,
            puppeteer: {
                headless: true,
                executablePath: chromePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-breakpad',
                    '--disable-client-side-phishing-detection',
                    '--disable-component-update',
                    '--disable-default-apps',
                    '--disable-domain-reliability',
                    '--disable-features=AudioServiceOutOfProcess',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-renderer-backgrounding',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--no-zygote',
                    '--mute-audio',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--js-flags=--max-old-space-size=512',
                ],
                timeout: 120000, // 120 second timeout
            },
            // Use web version cache to avoid version mismatch issues
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/AmineSoukworker/WhatsApp-Web-Version/main/version.json',
            },
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // Add loading event to show progress
        this.client.on('loading_screen', (percent, message) => {
            logger.info(`Loading WhatsApp... ${percent}% - ${message}`);
        });

        this.client.on('qr', async (qr) => {
            logger.info('═══════════════════════════════════════════════════════');
            logger.info('QR CODE RECEIVED - Please scan with WhatsApp mobile app');
            logger.info('═══════════════════════════════════════════════════════');

            // Display in terminal
            qrCodeTerminal.generate(qr, { small: true });

            logger.info('═══════════════════════════════════════════════════════');
            logger.info('Waiting for QR code scan...');
            logger.info('═══════════════════════════════════════════════════════');

            // Generate base64 PNG for API
            try {
                const qrCodeDataUrl = await QRCode.toDataURL(qr);
                this.state.qrCode = qrCodeDataUrl;
                this.emit('qr', qrCodeDataUrl);
            } catch (error) {
                logger.error('Failed to generate QR code', error as Error);
            }
        });

        this.client.on('ready', () => {
            logger.info('═══════════════════════════════════════════════════════');
            logger.info('✓ WhatsApp client is READY');
            logger.info('═══════════════════════════════════════════════════════');
            this.state.isReady = true;
            this.state.qrCode = undefined;

            const info = this.client.info;
            if (info) {
                this.state.clientInfo = {
                    pushname: info.pushname,
                    platform: info.platform,
                };
                logger.info(`Connected as: ${info.pushname} (${info.platform})`);
            }

            this.emit('ready');
        });

        this.client.on('authenticated', () => {
            logger.info('✓ WhatsApp client authenticated successfully');
            this.emit('authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            logger.error('✗ WhatsApp authentication failed', new Error(msg));
            this.emit('auth_failure', msg);
        });

        this.client.on('disconnected', (reason) => {
            logger.warn('WhatsApp client disconnected', { reason });
            this.state.isReady = false;
            this.emit('disconnected', reason);
        });

        this.client.on('message', (message) => {
            logger.info('📩 Message received', {
                from: message.from,
                body: message.body?.substring(0, 50),
                type: message.type,
                isStatus: message.isStatus,
                fromMe: message.fromMe,
            });
            this.emit('message', message);
        });

        // Also listen for message_create which catches all messages including outgoing
        this.client.on('message_create', (message) => {
            if (!message.fromMe) {
                logger.debug('📨 Message create event (incoming)', {
                    from: message.from,
                    body: message.body?.substring(0, 30),
                });
            }
        });
    }

    /**
     * Initialize and start the WhatsApp client
     */
    async initialize(): Promise<void> {
        try {
            logger.info('Initializing WhatsApp client...');

            // Kill any zombie Chromium processes to prevent profile lock
            try {
                logger.info('Cleaning up any zombie Chromium processes...');
                const platform = os.platform();

                if (platform === 'linux') {
                    // Linux: use pkill
                    execSync('pkill -f chromium || true', { stdio: 'ignore' });
                    execSync('pkill -f chrome || true', { stdio: 'ignore' });
                } else if (platform === 'darwin') {
                    // macOS: use pkill or killall
                    try {
                        execSync('pkill -f chromium || true', { stdio: 'ignore' });
                        execSync('pkill -f "Google Chrome" || true', { stdio: 'ignore' });
                    } catch {
                        execSync('killall "Google Chrome" 2>/dev/null || true', { stdio: 'ignore' });
                    }
                } else if (platform === 'win32') {
                    // Windows: use taskkill
                    execSync('taskkill /F /IM chrome.exe /T 2>nul || exit 0', { stdio: 'ignore' });
                }
            } catch (e) {
                // Ignore errors - process cleanup is best-effort
                logger.debug('Process cleanup completed (some commands may have failed)');
            }

            // Delete Chromium lock files to prevent profile lock error
            // These lock files persist on the disk and block new instances
            const sessionDir = path.join(process.cwd(), '.wwebjs_auth');
            if (fs.existsSync(sessionDir)) {
                logger.info('Cleaning up Chromium lock files...');
                const cleanupLockFiles = (dir: string) => {
                    try {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                cleanupLockFiles(fullPath);
                            } else if (
                                entry.name === 'SingletonLock' ||
                                entry.name === 'SingletonCookie' ||
                                entry.name === 'SingletonSocket'
                            ) {
                                fs.unlinkSync(fullPath);
                                logger.info(`Deleted lock file: ${fullPath}`);
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                };
                cleanupLockFiles(sessionDir);
            }

            await this.client.initialize();
        } catch (error: any) {
            // Log the error but don't crash the application
            logger.error('WhatsApp client initialization error', error);

            // Check if it's a Puppeteer context error (non-fatal)
            if (error.message?.includes('Execution context was destroyed')) {
                logger.warn('Puppeteer context error detected - this is usually non-fatal, continuing...');
                // The client may still initialize successfully
                return;
            }

            // For other errors, emit an event but don't throw
            this.emit('initialization_error', error);
            logger.warn('WhatsApp client initialization encountered an error, but the bot will continue running');
        }
    }

    /**
     * Get the current client state
     */
    getState(): WhatsAppClientState {
        return { ...this.state };
    }

    /**
     * Get the underlying whatsapp-web.js client
     */
    getClient(): Client {
        return this.client;
    }

    /**
     * Send a text message to a chat
     */
    async sendMessage(chatId: string, message: string): Promise<void> {
        if (!this.state.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        await this.client.sendMessage(chatId, message, { sendSeen: false });
        logger.debug('Message sent', { chatId, messageLength: message.length });
    }

    /**
     * Send a voice message to a chat
     * @param chatId - The chat ID to send to
     * @param audioBuffer - WAV audio buffer to send as voice message
     */
    async sendVoiceMessage(chatId: string, audioBuffer: Buffer): Promise<void> {
        if (!this.state.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        const { MessageMedia } = await import('whatsapp-web.js');

        const provider = config.voiceResponse.provider;
        const mimeType = provider === 'google' ? 'audio/ogg; codecs=opus' : 'audio/wav';
        const filename = provider === 'google' ? 'voice_response.ogg' : 'voice_response.wav';

        const media = new MessageMedia(
            mimeType,
            audioBuffer.toString('base64'),
            filename
        );


        try {
            await this.client.sendMessage(chatId, media, {
                sendAudioAsVoice: true,
                sendSeen: false,
            });
            logger.info('Voice message successfully handed off to WhatsApp', { chatId, audioSize: audioBuffer.length });
        } catch (error: any) {
            logger.error('CRITICAL: WhatsApp failed to send voice message', {
                chatId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }

    }

    /**
     * Send typing indicator to a chat
     */
    async sendTyping(chatId: string): Promise<void> {
        if (!this.state.isReady) {
            return;
        }

        const chat = await this.client.getChatById(chatId);
        await chat.sendStateTyping();
    }

    /**
     * Clear typing indicator
     */
    async clearTyping(chatId: string): Promise<void> {
        if (!this.state.isReady) {
            return;
        }

        const chat = await this.client.getChatById(chatId);
        await chat.clearState();
    }

    /**
     * Logout and clear session
     */
    async logout(): Promise<void> {
        logger.info('Logging out WhatsApp client');
        await this.client.logout();
        this.state.isReady = false;
        this.state.qrCode = undefined;
        this.state.clientInfo = undefined;
    }

    /**
     * Resolve a contact's real phone number and name
     * Handles WhatsApp Lids (Linked IDs) by attempting to resolve them
     */
    async resolveContact(chatId: string): Promise<{ phone: string; name?: string; isLid: boolean }> {
        const contactId = chatId.includes('@') ? chatId : `${chatId}@c.us`;
        // Check for @lid or long numeric IDs (usually 15+ digits)
        const isLid = contactId.includes('@lid') || /^\d{15,}@/.test(contactId);

        try {
            const contact = await this.client.getContactById(contactId);
            let phone = contact.number || contactId.split('@')[0];
            let name = contact.pushname || contact.name || undefined;

            // If it's a Lid, try to resolve the real phone number
            // Note: getContactLidAndPhone might not be available in all versions
            if (isLid && (this.client as any).getContactLidAndPhone) {
                try {
                    const resolved = await (this.client as any).getContactLidAndPhone(contactId);
                    if (resolved && resolved.phone) {
                        logger.info('Resolved Lid to phone number', { lid: contactId, phone: resolved.phone });
                        phone = resolved.phone;
                        // Try to get contact info again with the real phone number for better name resolution
                        const realContact = await this.client.getContactById(`${phone}@c.us`);
                        name = realContact.pushname || realContact.name || name;
                    }
                } catch (resolveError) {
                    logger.debug('Failed to resolve Lid via getContactLidAndPhone', {
                        lid: contactId,
                        error: (resolveError as Error).message
                    });
                }
            }

            if (!phone) {
                logger.warn('resolveContact: Phone resolution returned empty value, falling back to chatId split', { chatId });
                phone = contactId.split('@')[0];
            }

            return { phone, name, isLid };
        } catch (error: any) {
            const errorMessage = error.message || '';
            const isInternalError = errorMessage.includes('getIsMyContact is not a function') ||
                errorMessage.includes('Evaluation failed');

            if (isInternalError) {
                logger.warn('WhatsApp library internal error while getting contact info - using fallback', {
                    chatId: contactId,
                    isLid
                });
            } else {
                logger.error('Error resolving contact', {
                    chatId: contactId,
                    error: errorMessage
                });
            }

            return {
                phone: contactId.split('@')[0],
                isLid
            };
        }
    }

    /**
     * Destroy the client
     */
    async destroy(): Promise<void> {
        logger.info('Destroying WhatsApp client');
        await this.client.destroy();
        this.state.isReady = false;
    }
}
