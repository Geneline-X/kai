/**
 * Health Alerts Utility
 * Manages public health alerts for Sierra Leone
 * Supports both English and Krio
 */

import { logger } from './logger';
import { getSupabaseClient } from '../config/supabase';
import { formatHealthAlertKrio } from './krio-phrases';

// Alert severity levels
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

// Alert types
export type AlertType =
    | 'outbreak'
    | 'vaccination_campaign'
    | 'prevention_tip'
    | 'facility_update'
    | 'emergency'
    | 'general';

// Health alert structure
export interface HealthAlert {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    titleKrio: string;
    message: string;
    messageKrio: string;
    disease?: string;
    affectedAreas?: string[];
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
    source?: string;
    actionRequired?: string;
    actionRequiredKrio?: string;
}

// In-memory alert storage (fallback if database unavailable)
// These can be updated from the admin dashboard
let activeAlerts: HealthAlert[] = [
    // Default alerts - can be updated via admin
    {
        id: 'default-malaria-1',
        type: 'prevention_tip',
        severity: 'medium',
        title: '🦟 Malaria Prevention Reminder',
        titleKrio: '🦟 Malɛria Privɛnshɔn',
        message: 'Rainy season increases malaria risk. Sleep under treated mosquito nets, use repellent, and seek testing if you have fever.',
        messageKrio: 'Rɛn sisin de mek malɛria plɛnti. Slip insay mɔskito nɛt, yuz mɔskito mɛdisin na skin, ɛn go tɛs if fiba kɛch yu.',
        disease: 'Malaria',
        isActive: true,
        startDate: new Date(),
        actionRequired: 'Sleep under mosquito nets every night',
        actionRequiredKrio: 'Slip insay mɔskito nɛt ɛvri nɛt',
    },
    {
        id: 'default-handwashing-1',
        type: 'prevention_tip',
        severity: 'low',
        title: '🧼 Hand Hygiene Reminder',
        titleKrio: '🧼 Was Yu An Dɛm',
        message: 'Wash your hands frequently with soap and water to prevent disease spread. Wash before eating, after using the toilet, and after touching public surfaces.',
        messageKrio: 'Was yu an dɛm ɔltɛm wit sop ɛn wata fɔ stɔp sik fɔ spred. Was bɔfɔ yu it, afta yu yuz tɔylɛt, ɛn afta yu tɔch sɔntin na pɔblik ples.',
        isActive: true,
        startDate: new Date(),
        actionRequired: 'Wash hands with soap for at least 20 seconds',
        actionRequiredKrio: 'Was yu an dɛm wit sop fɔ 20 sɛkɔn ɔ mɔ',
    },
    {
        id: 'default-vaccine-1',
        type: 'vaccination_campaign',
        severity: 'medium',
        title: '💉 Child Vaccination Reminder',
        titleKrio: '💉 Pikin Vaksin',
        message: 'Ensure your children are up to date on all vaccinations. Free vaccines are available at government health facilities.',
        messageKrio: 'Mek shɔ yu pikin dɛm gɛt ɔl dɛn vaksin. Fri vaksin de na gɔvmɛnt ɛlt fasɛliti dɛm.',
        isActive: true,
        startDate: new Date(),
        actionRequired: 'Visit your nearest health facility for vaccination',
        actionRequiredKrio: 'Go na di ɛlt fasɛliti klos tu yu fɔ vaksin',
    },
];

/**
 * Get all active health alerts
 */
export async function getActiveAlerts(): Promise<HealthAlert[]> {
    try {
        // Try to get alerts from database first
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('health_alerts')
            .select('*')
            .eq('is_active', true)
            .order('severity', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) {
            logger.warn('Failed to fetch alerts from database, using in-memory alerts', { error });
            return activeAlerts.filter(a => a.isActive);
        }

        if (data && data.length > 0) {
            return data.map(dbAlert => ({
                id: dbAlert.id,
                type: dbAlert.type as AlertType,
                severity: dbAlert.severity as AlertSeverity,
                title: dbAlert.title,
                titleKrio: dbAlert.title_krio || dbAlert.title,
                message: dbAlert.message,
                messageKrio: dbAlert.message_krio || dbAlert.message,
                disease: dbAlert.disease,
                affectedAreas: dbAlert.affected_areas,
                startDate: new Date(dbAlert.start_date),
                endDate: dbAlert.end_date ? new Date(dbAlert.end_date) : undefined,
                isActive: dbAlert.is_active,
                source: dbAlert.source,
                actionRequired: dbAlert.action_required,
                actionRequiredKrio: dbAlert.action_required_krio,
            }));
        }

        // Fallback to in-memory alerts
        return activeAlerts.filter(a => a.isActive);

    } catch (error) {
        logger.error('Error fetching health alerts', error as Error);
        return activeAlerts.filter(a => a.isActive);
    }
}

/**
 * Get alerts by type
 */
export async function getAlertsByType(type: AlertType): Promise<HealthAlert[]> {
    const alerts = await getActiveAlerts();
    return alerts.filter(a => a.type === type);
}

/**
 * Get alerts by severity
 */
export async function getAlertsBySeverity(severity: AlertSeverity): Promise<HealthAlert[]> {
    const alerts = await getActiveAlerts();
    return alerts.filter(a => a.severity === severity);
}

/**
 * Get alerts for a specific area
 */
export async function getAlertsForArea(area: string): Promise<HealthAlert[]> {
    const alerts = await getActiveAlerts();
    return alerts.filter(a =>
        !a.affectedAreas ||
        a.affectedAreas.length === 0 ||
        a.affectedAreas.some(aa => aa.toLowerCase().includes(area.toLowerCase()))
    );
}

/**
 * Format alert for display (bilingual)
 */
export function formatAlertBilingual(alert: HealthAlert): string {
    const severityEmoji = {
        critical: '🚨',
        high: '⚠️',
        medium: '🔶',
        low: '🔔',
    };

    let response = '';

    // English version
    response += `${severityEmoji[alert.severity]} **${alert.title}**\n`;
    response += `${alert.message}\n`;
    if (alert.actionRequired) {
        response += `\n👉 **Action:** ${alert.actionRequired}\n`;
    }
    if (alert.affectedAreas && alert.affectedAreas.length > 0) {
        response += `📍 Areas: ${alert.affectedAreas.join(', ')}\n`;
    }

    // Krio version
    response += `\n---\n🇸🇱 **Na Krio:**\n`;
    response += `${severityEmoji[alert.severity]} **${alert.titleKrio}**\n`;
    response += `${alert.messageKrio}\n`;
    if (alert.actionRequiredKrio) {
        response += `\n👉 **Wetin fɔ du:** ${alert.actionRequiredKrio}\n`;
    }

    return response;
}

/**
 * Format multiple alerts for display
 */
export function formatAlertsList(alerts: HealthAlert[], language: 'english' | 'krio' = 'english'): string {
    if (alerts.length === 0) {
        return language === 'krio'
            ? '✅ Nɔ ɛlt alat de naw. Ɛvritin luk gud!'
            : '✅ No active health alerts at this time. Stay healthy!';
    }

    const severityEmoji = {
        critical: '🚨',
        high: '⚠️',
        medium: '🔶',
        low: '🔔',
    };

    let response = language === 'krio'
        ? `📢 **Kɔrɛnt Ɛlt Alat Dɛm (${alerts.length})**\n\n`
        : `📢 **Current Health Alerts (${alerts.length})**\n\n`;

    alerts.forEach((alert, index) => {
        const title = language === 'krio' ? alert.titleKrio : alert.title;
        const message = language === 'krio' ? alert.messageKrio : alert.message;
        const action = language === 'krio' ? alert.actionRequiredKrio : alert.actionRequired;

        response += `${index + 1}. ${severityEmoji[alert.severity]} **${title}**\n`;
        response += `   ${message}\n`;
        if (action) {
            response += language === 'krio'
                ? `   👉 Wetin fɔ du: ${action}\n`
                : `   👉 Action: ${action}\n`;
        }
        response += '\n';
    });

    return response;
}

/**
 * Add a new alert (for admin use)
 */
export async function addAlert(alert: Omit<HealthAlert, 'id'>): Promise<string | null> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('health_alerts')
            .insert({
                type: alert.type,
                severity: alert.severity,
                title: alert.title,
                title_krio: alert.titleKrio,
                message: alert.message,
                message_krio: alert.messageKrio,
                disease: alert.disease,
                affected_areas: alert.affectedAreas,
                start_date: alert.startDate.toISOString(),
                end_date: alert.endDate?.toISOString(),
                is_active: alert.isActive,
                source: alert.source,
                action_required: alert.actionRequired,
                action_required_krio: alert.actionRequiredKrio,
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to add health alert', error);

            // Add to in-memory as fallback
            const newAlert = {
                ...alert,
                id: `local-${Date.now()}`,
            };
            activeAlerts.push(newAlert);
            return newAlert.id;
        }

        logger.info('Health alert added', { alertId: data.id });
        return data.id;

    } catch (error) {
        logger.error('Error adding health alert', error as Error);
        return null;
    }
}

/**
 * Update in-memory alerts (for quick updates without database)
 */
export function updateInMemoryAlerts(alerts: HealthAlert[]): void {
    activeAlerts = alerts;
    logger.info('In-memory alerts updated', { count: alerts.length });
}

/**
 * Get critical/emergency alerts only
 */
export async function getCriticalAlerts(): Promise<HealthAlert[]> {
    const alerts = await getActiveAlerts();
    return alerts.filter(a => a.severity === 'critical' || a.type === 'emergency');
}
