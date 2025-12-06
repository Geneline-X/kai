import { Tool } from './tool-registry';
import { logger } from '../../utils/logger';
import {
    getActiveAlerts,
    getAlertsByType,
    getCriticalAlerts,
    getAlertsForArea,
    formatAlertsList,
    formatAlertBilingual,
    AlertType
} from '../../utils/health-alerts';
import { detectKrio } from '../../utils/krio-phrases';

/**
 * Health Alerts Tool
 * Provides current public health alerts in English and Krio
 */
export const createHealthAlertsTool = (): Tool => {
    return {
        name: 'get_health_alerts',
        description: 'Get current public health alerts for Sierra Leone including disease outbreaks, vaccination campaigns, and prevention tips. Returns alerts in both English and Krio.',
        parameters: [
            {
                name: 'type',
                type: 'string',
                description: 'Filter by alert type: outbreak, vaccination_campaign, prevention_tip, emergency, general, or "all" for all types',
                required: false,
            },
            {
                name: 'area',
                type: 'string',
                description: 'Filter by affected area/district (e.g., "Freetown", "Bo", "Kenema")',
                required: false,
            },
            {
                name: 'userMessage',
                type: 'string',
                description: 'The original user message to detect language preference',
                required: false,
            },
        ],
        execute: async (params: { type?: string; area?: string; userMessage?: string }): Promise<string> => {
            try {
                const { type, area, userMessage } = params;

                logger.info('Health alerts requested', { type, area });

                // Detect if user is speaking Krio
                const isKrio = userMessage ? detectKrio(userMessage) : false;

                let alerts;

                // Get alerts based on filters
                if (type && type.toLowerCase() !== 'all') {
                    alerts = await getAlertsByType(type as AlertType);
                } else if (area) {
                    alerts = await getAlertsForArea(area);
                } else {
                    alerts = await getActiveAlerts();
                }

                if (alerts.length === 0) {
                    const noAlertsMsg = isKrio
                        ? '✅ Nɔ ɛlt alat de fɔ di filta we yu sɛlɛkt. Dis gud nyus!\n\n' +
                        'Yu want mek a chɛk fɔ ɔda alat dɛm?'
                        : '✅ No health alerts found for your criteria. This is good news!\n\n' +
                        'Would you like me to check for other types of alerts?';

                    return noAlertsMsg;
                }

                // Format response - show both languages for accessibility
                let response = '';

                // English version
                response += formatAlertsList(alerts, 'english');

                // Krio version
                response += '\n---\n';
                response += '🇸🇱 **Na Krio:**\n\n';
                response += formatAlertsList(alerts, 'krio');

                // Add helpful footer
                response += '\n---\n';
                response += isKrio
                    ? '💡 **Tip:** Fɔ mɔ diteyl ɔn ɛni alat, aks mi abɔt di spɛsifik diziz ɔ tɔpik.'
                    : '💡 **Tip:** For more details on any alert, ask me about the specific disease or topic.';

                logger.info('Health alerts returned', {
                    count: alerts.length,
                    type,
                    area,
                    detectedKrio: isKrio
                });

                return response;

            } catch (error) {
                logger.error('Health alerts tool failed', error as Error);
                return 'I encountered an issue fetching health alerts. Please try again.\n\n' +
                    '🇸🇱 Na Krio: A gɛt prɔblɛm fɔ gɛt di ɛlt alat dɛm. Duya tray agen.';
            }
        },
    };
};

/**
 * Create a tool specifically for emergency/critical alerts
 */
export const createEmergencyAlertsTool = (): Tool => {
    return {
        name: 'get_emergency_alerts',
        description: 'Get critical and emergency health alerts only. Use this for urgent health situations.',
        parameters: [],
        execute: async (): Promise<string> => {
            try {
                const criticalAlerts = await getCriticalAlerts();

                if (criticalAlerts.length === 0) {
                    return '✅ **Good News!** No critical health emergencies at this time.\n\n' +
                        '🇸🇱 Na Krio: ✅ **Gud Nyus!** Nɔ kritikɔl ɛlt emɛjɛnsi de naw.';
                }

                let response = '🚨 **CRITICAL HEALTH ALERTS** 🚨\n\n';

                criticalAlerts.forEach(alert => {
                    response += formatAlertBilingual(alert);
                    response += '\n';
                });

                response += '\n⚠️ Please take these alerts seriously and follow the recommended actions.\n';
                response += '🇸🇱 ⚠️ Duya tek dis alat dɛm siryɔs ɛn fɔlɔ wetin dɛn se fɔ du.';

                return response;

            } catch (error) {
                logger.error('Emergency alerts tool failed', error as Error);
                return 'Unable to fetch emergency alerts. If you have an emergency, please go to your nearest health facility.\n\n' +
                    '🇸🇱 A nɔ ebul gɛt di emɛjɛnsi alat dɛm. If yu gɛt emɛjɛnsi, go na di ɛlt fasɛliti klos tu yu.';
            }
        },
    };
};
