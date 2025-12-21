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
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                return process.env.PUPPETEER_EXECUTABLE_PATH;
            }

            // Detect based on OS
            const platform = os.platform();
            if (platform === 'linux') {
                // Linux/Docker (Render, Railway, etc.)
                return '/usr/bin/chromium';
            } else if (platform === 'darwin') {
                // macOS
                return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            } else if (platform === 'win32') {
                // Windows
                return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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

        await this.client.sendMessage(chatId, message);
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

        // Create media from buffer - WhatsApp prefers opus/ogg but accepts wav
        const media = new MessageMedia(
            'audio/wav',
            audioBuffer.toString('base64'),
            'voice_response.wav'
        );

        await this.client.sendMessage(chatId, media, {
            sendAudioAsVoice: true,
        });

        logger.debug('Voice message sent', { chatId, audioSize: audioBuffer.length });
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
     * Destroy the client
     */
    async destroy(): Promise<void> {
        logger.info('Destroying WhatsApp client');
        await this.client.destroy();
        this.state.isReady = false;
    }
}
