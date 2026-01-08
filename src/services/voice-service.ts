import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface TranscriptionResult {
    success: boolean;
    text?: string;
    error?: string;
}

export interface TTSResult {
    success: boolean;
    audioBuffer?: Buffer;
    error?: string;
}

/**
 * VoiceService handles ASR (speech-to-text) and TTS (text-to-speech)
 * using the Kay Geneline-X API endpoints.
 */
export class VoiceService {
    private readonly apiHost: string;
    private readonly apiKey: string;

    constructor() {
        // Remove trailing slash from host to prevent double slashes in URLs
        const rawHost = config.kay?.host || 'https://kay.geneline-x.net';
        this.apiHost = rawHost.endsWith('/') ? rawHost.slice(0, -1) : rawHost;
        this.apiKey = config.kay?.apiKey || config.geneline.apiKey; // Fallback to geneline key if Kay key not set

        logger.info('VoiceService initialized', {
            apiHost: this.apiHost,
            hasApiKey: !!this.apiKey,
        });
    }

    /**
     * Transcribe audio to text using Krio ASR
     * @param audioBuffer - The audio file buffer
     * @param mimeType - MIME type of the audio (e.g., 'audio/ogg', 'audio/opus')
     * @param filename - Optional filename for the upload
     */
    async transcribeAudio(
        audioBuffer: Buffer,
        mimeType: string,
        filename: string = 'audio.ogg'
    ): Promise<TranscriptionResult> {
        const transcribeUrl = `${this.apiHost}/api/v1/transcribe`;

        logger.info('Transcribing audio', {
            mimeType,
            bufferSize: audioBuffer.length,
            apiHost: this.apiHost,
            transcribeUrl,
            filename,
        });

        // Try native fetch first (Node.js 18+ FormData)
        try {
            const nativeFormData = new globalThis.FormData();
            const blob = new Blob([audioBuffer], { type: mimeType });
            nativeFormData.append('file', blob, filename);

            logger.info('Trying native fetch transcription');

            const fetchResponse = await fetch(transcribeUrl, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiKey,
                },
                body: nativeFormData,
            });

            // Check for frp proxy 404 error
            if (fetchResponse.status === 404) {
                const responseText = await fetchResponse.text();
                if (responseText.includes('frp') || responseText.includes('Not Found')) {
                    logger.error('Kay API frp proxy is blocking transcription requests', {
                        status: 404,
                        response: responseText.substring(0, 200),
                    });
                    return {
                        success: false,
                        error: 'Voice transcription is temporarily unavailable. Please send a text message instead.',
                    };
                }
            }

            if (fetchResponse.ok) {
                const data = await fetchResponse.json();
                const text = this.extractTranscriptionText(data);
                if (text) {
                    logger.info('Transcription successful via native fetch', { textLength: text.length });
                    return { success: true, text };
                }
            }
        } catch (fetchError: any) {
            logger.warn('Native fetch transcription failed', { error: fetchError.message });
        }

        // Fallback to axios with form-data
        try {
            const formData = new FormData();
            formData.append('file', audioBuffer, {
                filename,
                contentType: mimeType,
            });

            logger.info('Trying axios transcription');

            const response = await axios.post(
                transcribeUrl,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'X-API-Key': this.apiKey,
                    },
                    timeout: 60000,
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity,
                    validateStatus: () => true, // Don't throw on non-2xx
                }
            );

            // Check for frp proxy 404 error
            if (response.status === 404) {
                const responseText = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data);
                if (responseText.includes('frp') || responseText.includes('Not Found')) {
                    logger.error('Kay API frp proxy is blocking transcription requests via axios', {
                        status: 404,
                    });
                    return {
                        success: false,
                        error: 'Voice transcription is temporarily unavailable. Please send a text message instead.',
                    };
                }
            }

            if (response.status >= 200 && response.status < 300) {
                logger.info('Transcription API response', {
                    status: response.status,
                    responseData: JSON.stringify(response.data),
                });

                const transcribedText = this.extractTranscriptionText(response.data);

                if (transcribedText) {
                    logger.info('Transcription completed', {
                        success: true,
                        textLength: transcribedText.length,
                        preview: transcribedText.substring(0, 100),
                    });
                    return { success: true, text: transcribedText };
                }
            }

            // Non-success response
            const errorMessage = response.data?.error || `HTTP ${response.status}`;
            logger.error('Transcription API error', {
                status: response.status,
                error: errorMessage,
            });
            return { success: false, error: errorMessage };

        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message;

            // Check if this is a 404 frp error
            if (error.response?.status === 404) {
                const responseText = typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data);
                if (responseText.includes('frp') || responseText.includes('Not Found')) {
                    logger.error('Kay API frp proxy error detected', { status: 404 });
                    return {
                        success: false,
                        error: 'Voice transcription is temporarily unavailable. Please send a text message instead.',
                    };
                }
            }

            logger.error('Transcription failed', {
                error: errorMessage,
                stack: error.stack,
                status: error.response?.status,
            });

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Extract transcription text from various response formats
     */
    private extractTranscriptionText(data: any): string {
        if (!data) return '';

        let text =
            data.krio_text ||
            data.text ||
            data.transcription ||
            data.result ||
            data.transcript ||
            data.output ||
            data.kri_text ||
            data.transcribed_text ||
            '';

        if (!text && typeof data === 'string') {
            text = data;
        }

        if (!text && data.data) {
            text = data.data.text || data.data.krio_text || '';
        }

        return text.trim();
    }

    /**
     * Convert text to speech using configured provider (Kay or Google)
     * @param text - The text to synthesize
     * @param speakerId - Optional speaker ID (for Kay)
     */
    async synthesizeSpeech(
        text: string,
        speakerId?: number
    ): Promise<TTSResult> {
        const provider = config.voiceResponse.provider;
        const enabled = config.voiceResponse.enabled;

        if (!enabled) {
            return { success: false, error: 'Voice responses are disabled' };
        }

        if (provider === 'google') {
            return this.synthesizeSpeechWithGoogle(text);
        } else {
            return this.synthesizeSpeechWithKay(text, speakerId ?? config.voiceResponse.speakerId);
        }
    }

    /**
     * Convert text to speech using Krio TTS (Kay API)
     */
    async synthesizeSpeechWithKay(
        text: string,
        speakerId: number = 0
    ): Promise<TTSResult> {
        try {
            logger.info('Synthesizing speech via Kay', {
                textLength: text.length,
                speakerId,
            });

            const response = await axios.post(
                `${this.apiHost}/api/v1/tts/audio`,
                {
                    text,
                    speaker_id: speakerId,
                    do_sample: true,
                    temperature: 0.5,
                    top_p: 0.7,
                    max_new_tokens: 1024,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.apiKey,
                    },
                    responseType: 'arraybuffer', // Get binary audio data
                    timeout: 60000, // 60 second timeout for TTS
                }
            );

            const audioBuffer = Buffer.from(response.data);

            logger.info('Kay speech synthesis completed', {
                success: true,
                audioSize: audioBuffer.length,
            });

            return {
                success: true,
                audioBuffer,
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message;
            logger.error('Kay TTS synthesis failed', {
                error: errorMessage,
                status: error.response?.status,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Convert text to speech using Google Cloud TTS
     */
    async synthesizeSpeechWithGoogle(
        text: string
    ): Promise<TTSResult> {
        try {
            const apiKey = config.voiceResponse.googleApiKey;
            if (!apiKey) {
                return { success: false, error: 'Google TTS API Key is not configured' };
            }

            // Remove markdown formatting like * (used for bolding) for cleaner speech
            const cleanText = text.replace(/\*/g, '');

            logger.info('Synthesizing speech via Google', {
                textLength: cleanText.length,
                voice: config.voiceResponse.googleVoiceName,
            });

            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

            // Convert plain text to SSML for more natural speech
            // 1. Escape special characters
            const escapedText = cleanText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            // 2. Add natural pauses after sentences and commas
            const ssmlText = `<speak>
                <prosody rate="0.95">
                    ${escapedText
                    .replace(/\. /g, '. <break time="400ms"/> ')
                    .replace(/\? /g, '? <break time="400ms"/> ')
                    .replace(/! /g, '! <break time="400ms"/> ')
                    .replace(/, /g, ', <break time="200ms"/> ')}
                </prosody>
            </speak>`;

            const response = await axios.post(
                url,
                {
                    input: { ssml: ssmlText },
                    voice: {
                        languageCode: config.voiceResponse.googleLanguageCode,
                        name: config.voiceResponse.googleVoiceName,
                    },
                    audioConfig: {
                        audioEncoding: 'OGG_OPUS',
                        speakingRate: 0.95, // Slightly slower is more natural for health info
                    },
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000,
                }
            );

            if (response.data && response.data.audioContent) {
                const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
                logger.info('Google speech synthesis completed', {
                    success: true,
                    audioSize: audioBuffer.length,
                });

                return {
                    success: true,
                    audioBuffer,
                };
            } else {
                return { success: false, error: 'No audio content returned from Google' };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || error.message;
            logger.error('Google TTS synthesis failed', {
                error: errorMessage,
                status: error.response?.status,
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Translate Krio text to English using Kay API
     * @param krioText - The Krio text to translate
     * @returns Translation result with success status and translated text
     */
    async translateKrioToEnglish(
        krioText: string
    ): Promise<{ success: boolean; translatedText?: string; error?: string }> {
        try {
            logger.info('Translating Krio to English', {
                textLength: krioText.length,
                preview: krioText.substring(0, 100),
            });

            const response = await axios.post(
                `${this.apiHost}/api/v1/translate`,
                {
                    text: krioText,
                    source_lang: 'kri',
                    target_lang: 'en',
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.apiKey,
                    },
                    timeout: 30000, // 30 second timeout for translation
                }
            );

            // Extract translated text from response
            const translatedText =
                response.data?.translated_text ||
                response.data?.translation ||
                response.data?.english_text ||
                response.data?.text ||
                (typeof response.data === 'string' ? response.data : '');

            if (translatedText && translatedText.trim().length > 0) {
                logger.info('Translation completed', {
                    success: true,
                    originalLength: krioText.length,
                    translatedLength: translatedText.length,
                    preview: translatedText.substring(0, 100),
                });

                return {
                    success: true,
                    translatedText,
                };
            } else {
                logger.warn('Translation returned empty text', {
                    responseData: JSON.stringify(response.data),
                });
                return {
                    success: false,
                    error: 'Translation returned empty text',
                };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message;
            logger.error('Translation failed', {
                error: errorMessage,
                stack: error.stack,
                status: error.response?.status,
                responseData: error.response?.data ? JSON.stringify(error.response.data) : 'N/A',
            });

            return {
                success: false,
                error: errorMessage,
            };
        }
    }

    /**
     * Check if the voice services are healthy
     */
    async checkHealth(): Promise<{ transcribe: boolean; tts: boolean }> {
        const results = { transcribe: false, tts: false };

        try {
            const healthResponse = await axios.get(
                `${this.apiHost}/api/v1/health`,
                { timeout: 5000 }
            );
            results.transcribe = healthResponse.status === 200;
        } catch {
            results.transcribe = false;
        }

        try {
            const ttsHealthResponse = await axios.get(
                `${this.apiHost}/api/v1/tts/health`,
                {
                    headers: { 'X-API-Key': this.apiKey },
                    timeout: 5000,
                }
            );
            results.tts = ttsHealthResponse.status === 200;
        } catch {
            results.tts = false;
        }

        return results;
    }
}

// Singleton instance
let voiceServiceInstance: VoiceService | null = null;

export function getVoiceService(): VoiceService {
    if (!voiceServiceInstance) {
        voiceServiceInstance = new VoiceService();
    }
    return voiceServiceInstance;
}
