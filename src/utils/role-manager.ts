/**
 * Role Manager
 * Utilities for managing user roles and permissions
 */

import { getSupabaseClient } from '../config/supabase';
import { logger } from './logger';
import {
    UserRole,
    RoleAction,
    parseRole,
    canPerformAction as checkPermission,
    getEscalationTarget as getNextEscalationLevel,
    getRoleCapabilities,
    ROLE_DISPLAY_NAMES
} from '../types/role-types';

/**
 * Get user's current role from database
 * Checks special_contacts table for admin-assigned roles
 * Regular users default to SUPPORT role
 */
export async function getUserRole(userId: string): Promise<UserRole> {
    try {
        const supabase = getSupabaseClient();

        // Get user's phone number first
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('phone')
            .eq('id', userId)
            .single();

        if (userError || !userData) {
            logger.warn('Failed to get user, using default role', { userId, error: userError });
            return UserRole.SUPPORT;
        }

        // Check if user is in special_contacts (admin-assigned roles)
        if (userData.phone) {
            const { data: specialContact } = await supabase
                .from('special_contacts')
                .select('role')
                .eq('phone', userData.phone)
                .eq('status', 'active')
                .single();

            if (specialContact?.role) {
                logger.debug('Role found in special_contacts', { userId, phone: userData.phone, role: specialContact.role });
                return parseRole(specialContact.role, UserRole.SUPPORT);
            }
        }

        // Regular users get default SUPPORT role
        return UserRole.SUPPORT;
    } catch (error) {
        logger.error('Error getting user role', error as Error, { userId });
        return UserRole.SUPPORT;
    }
}

/**
 * Get user's role by phone number
 * Checks special_contacts table for admin-assigned roles
 * Regular users default to SUPPORT role
 */
export async function getUserRoleByPhone(phone: string): Promise<UserRole> {
    try {
        const supabase = getSupabaseClient();

        // Check if user is in special_contacts (admin-assigned roles)
        const { data: specialContact, error: specialError } = await supabase
            .from('special_contacts')
            .select('role')
            .eq('phone', phone)
            .eq('status', 'active')
            .single();

        if (!specialError && specialContact?.role) {
            logger.debug('Role found in special_contacts', { phone, role: specialContact.role });
            return parseRole(specialContact.role, UserRole.SUPPORT);
        }

        // Regular users get default SUPPORT role
        logger.debug('No special role found, using default SUPPORT', { phone });
        return UserRole.SUPPORT;
    } catch (error) {
        logger.error('Error getting user role by phone', error as Error, { phone });
        return UserRole.SUPPORT;
    }
}

/**
 * Set user's role in database
 * Note: Roles are managed via special_contacts table by admins
 * This function is kept for API compatibility but does not update users table
 */
export async function setUserRole(userId: string, role: UserRole): Promise<boolean> {
    // Roles are managed via special_contacts table by admins
    // To change a user's role, add them to special_contacts via the admin dashboard
    logger.warn('setUserRole called - roles should be managed via special_contacts in admin dashboard', { userId, role });
    return false;
}

/**
 * Check if a role can perform a specific action
 */
export function canPerformAction(role: UserRole, action: RoleAction): boolean {
    return checkPermission(role, action);
}

/**
 * Get the escalation target for a given role
 */
export function getEscalationTarget(currentRole: UserRole): UserRole | null {
    return getNextEscalationLevel(currentRole);
}

/**
 * Get all capabilities for a role
 */
export function getCapabilities(role: UserRole): RoleAction[] {
    return getRoleCapabilities(role);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
    return ROLE_DISPLAY_NAMES[role];
}

/**
 * Check if a user should be escalated based on their role and the required action
 */
export function shouldEscalateForAction(userRole: UserRole, requiredAction: RoleAction): boolean {
    return !canPerformAction(userRole, requiredAction);
}

/**
 * Get escalation message for a specific role
 */
export function getEscalationMessage(fromRole: UserRole, reason: string): string {
    const targetRole = getEscalationTarget(fromRole);

    if (!targetRole) {
        // Admin level - recommend facility referral for emergencies
        return `This situation may require immediate medical attention. Please visit the nearest health facility or call emergency services.`;
    }

    const targetRoleName = getRoleDisplayName(targetRole);

    switch (fromRole) {
        case UserRole.SUPPORT:
            return `This issue requires a health worker. I will escalate your request to a trained health staff member.`;

        case UserRole.HEALTH_WORKER:
            return `This question needs higher-level medical review. I will escalate this to a supervisor for further guidance.`;

        case UserRole.SUPERVISOR:
            return `This requires advanced clinical review. Escalating to an admin-level medical expert.`;

        default:
            return `This request will be escalated to a ${targetRoleName} for proper handling.`;
    }
}

/**
 * Get list of users with a specific role (for escalation routing)
 * Uses special_contacts table where roles are assigned
 */
export async function getUsersWithRole(role: UserRole): Promise<Array<{ id: string; phone: string; name?: string }>> {
    try {
        const supabase = getSupabaseClient();

        // Query special_contacts for users with the specified role
        const { data, error } = await supabase
            .from('special_contacts')
            .select('id, phone, name')
            .eq('role', role)
            .eq('status', 'active');

        if (error) {
            logger.error('Failed to get users with role', error, { role });
            return [];
        }

        return data || [];
    } catch (error) {
        logger.error('Error getting users with role', error as Error, { role });
        return [];
    }
}

/**
 * Initialize default role for a new user
 * Note: Roles are managed via special_contacts table, not users table
 * This function is a no-op but kept for API compatibility
 */
export async function initializeUserRole(userId: string, defaultRole: UserRole = UserRole.SUPPORT): Promise<void> {
    // Roles are managed via special_contacts table, not users table
    // Regular users automatically get SUPPORT role
    logger.debug('initializeUserRole called - roles are managed via special_contacts', { userId, defaultRole });
}

