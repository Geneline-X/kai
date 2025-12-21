import winston from 'winston';
import { config } from '../config/env';

/**
 * Safe JSON serializer that handles circular references and Error objects
 */
function safeJsonStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        // Handle Error objects specially
        if (value instanceof Error) {
            return {
                message: value.message,
                stack: value.stack,
                name: value.name,
            };
        }

        // Handle circular references
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }

        return value;
    }, 2);
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    config.nodeEnv === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let msg = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                    msg += ` ${safeJsonStringify(meta)}`;
                }
                return msg;
            })
        )
);

export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        new winston.transports.Console(),
    ],
});

// Helper functions for structured logging
export const logEvent = {
    incomingMessage: (chatId: string, messageId: string, hasMedia: boolean) => {
        logger.info('Incoming message', {
            event: 'incoming_message',
            chatId,
            messageId,
            hasMedia,
        });
    },

    aiRequestSent: (chatId: string, messageId: string, requestId?: string) => {
        logger.info('AI request sent', {
            event: 'ai_request_sent',
            chatId,
            messageId,
            requestId,
        });
    },

    aiResponseReceived: (chatId: string, messageId: string, responseLength: number) => {
        logger.info('AI response received', {
            event: 'ai_response_received',
            chatId,
            messageId,
            responseLength,
        });
    },

    whatsappSent: (chatId: string, messageId: string) => {
        logger.info('WhatsApp message sent', {
            event: 'whatsapp_sent',
            chatId,
            messageId,
        });
    },

    error: (message: string, error: Error, context?: Record<string, any>) => {
        logger.error(message, {
            event: 'error',
            error: error.message,
            stack: error.stack,
            ...context,
        });
    },
};
