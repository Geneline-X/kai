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
        this.apiHost = config.kay?.host || 'https://kay.geneline-x.net';
        this.apiKey = config.kay?.apiKey || config.geneline.apiKey; // Fallback to geneline key if Kay key not set
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
        try {
            logger.info('Transcribing audio', {
                mimeType,
                bufferSize: audioBuffer.length,
                apiHost: this.apiHost,
            });

            const formData = new FormData();
            formData.append('file', audioBuffer, {
                filename,
                contentType: mimeType,
            });

            const response = await axios.post(
                `${this.apiHost}/api/v1/transcribe`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        'X-API-Key': this.apiKey,
                    },
                    timeout: 60000, // 60 second timeout for transcription
                }
            );

            // Log the full response to understand the structure
            logger.info('Transcription API response', {
                status: response.status,
                responseData: JSON.stringify(response.data),
                responseKeys: response.data ? Object.keys(response.data) : [],
            });

            // Kay API can return different response structures
            // Try multiple field names to extract the transcribed text
            let transcribedText = '';

            if (response.data) {
                // Try different possible field names
                transcribedText =
                    response.data.krio_text ||
                    response.data.text ||
                    response.data.transcription ||
                    response.data.result ||
                    response.data.transcript ||
                    response.data.output ||
                    response.data.kri_text ||  // Alternative spelling
                    response.data.transcribed_text ||
                    '';

                // If response.data is a string itself
                if (!transcribedText && typeof response.data === 'string') {
                    transcribedText = response.data;
                }

                // If response.data has a nested structure
                if (!transcribedText && response.data.data) {
                    transcribedText = response.data.data.text || response.data.data.krio_text || '';
                }
            }

            if (transcribedText && transcribedText.trim().length > 0) {
                logger.info('Transcription completed', {
                    success: true,
                    textLength: transcribedText.length,
                    preview: transcribedText.substring(0, 100),
                });

                return {
                    success: true,
                    text: transcribedText.trim(),
                };
            } else {
                logger.warn('Transcription returned empty text', {
                    responseData: JSON.stringify(response.data),
                    responseKeys: response.data ? Object.keys(response.data) : [],
                    checkedFields: ['krio_text', 'text', 'transcription', 'result', 'transcript', 'output'],
                });
                return {
                    success: false,
                    error: 'Transcription returned empty text. Response: ' + JSON.stringify(response.data),
                };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message;
            logger.error('Transcription failed', {
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
     * Convert text to speech using Krio TTS
     * @param text - The text to synthesize (should be in Krio)
     * @param speakerId - Optional speaker ID (0-9)
     */
    async synthesizeSpeech(
        text: string,
        speakerId: number = 0
    ): Promise<TTSResult> {
        try {
            logger.info('Synthesizing speech', {
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

            logger.info('Speech synthesis completed', {
                success: true,
                audioSize: audioBuffer.length,
            });

            return {
                success: true,
                audioBuffer,
            };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.message;
            logger.error('TTS synthesis failed', {
                error: errorMessage,
                stack: error.stack,
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
