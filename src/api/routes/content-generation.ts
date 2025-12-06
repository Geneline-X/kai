import { Router, Request, Response } from 'express';
import { WhatsAppClient } from '../../whatsapp/client';
import { AIContentGenerator } from '../../services/ai-content-generator';
import { logger } from '../../utils/logger';
import { getSupabaseClient } from '../../config/supabase';

export function createContentGenerationRouter(whatsappClient: WhatsAppClient): Router {
    const router = Router();
    const aiGenerator = new AIContentGenerator();

    /**
     * POST /api/admin/generate-topic
     * Trigger AI health topic generation
     */
    router.post('/generate-topic', async (req: Request, res: Response) => {
        try {
            const { category, seasonalFocus } = req.body;

            logger.info('Admin triggered AI topic generation', { category, seasonalFocus });

            const result = await aiGenerator.generateAndSave({
                category,
                seasonalFocus
            });

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate topic'
                });
            }

            return res.json({
                success: true,
                topicId: result.topicId,
                topic: result.topic
            });
        } catch (error) {
            logger.error('Error in generate-topic endpoint', error as Error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });

    /**
     * GET /api/admin/pending-topics
     * Get topics pending review
     */
    router.get('/pending-topics', async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('health_topics')
                .select('*')
                .eq('status', 'pending_review')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            res.json({
                success: true,
                topics: data || []
            });
        } catch (error) {
            logger.error('Error getting pending topics', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending topics'
            });
        }
    });

    /**
     * POST /api/admin/approve-topic/:id
     * Approve and publish a topic
     */
    router.post('/approve-topic/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { reviewedBy } = req.body;

            const supabase = getSupabaseClient();

            const { data, error } = await supabase.rpc('approve_health_topic', {
                p_topic_id: id,
                p_reviewed_by: reviewedBy || 'admin'
            });

            if (error) {
                throw error;
            }

            logger.info('Topic approved', { topicId: id, reviewedBy });

            res.json({
                success: true,
                topic: data
            });
        } catch (error) {
            logger.error('Error approving topic', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to approve topic'
            });
        }
    });

    /**
     * POST /api/admin/reject-topic/:id
     * Reject a topic
     */
    router.post('/reject-topic/:id', async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { reviewedBy, reason } = req.body;

            const supabase = getSupabaseClient();

            const { data, error } = await supabase.rpc('reject_health_topic', {
                p_topic_id: id,
                p_reviewed_by: reviewedBy || 'admin',
                p_rejection_reason: reason
            });

            if (error) {
                throw error;
            }

            logger.info('Topic rejected', { topicId: id, reviewedBy, reason });

            res.json({
                success: true,
                topic: data
            });
        } catch (error) {
            logger.error('Error rejecting topic', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to reject topic'
            });
        }
    });

    /**
     * PUT /api/admin/settings/auto-publish
     * Update auto-publish settings
     */
    router.put('/settings/auto-publish', async (req: Request, res: Response) => {
        try {
            const { enabled, frequency } = req.body;

            const supabase = getSupabaseClient();

            const { data, error } = await supabase.rpc('update_system_setting', {
                p_setting_key: 'health_topics_auto_publish',
                p_setting_value: { enabled, frequency, last_generated: null },
                p_updated_by: 'admin'
            });

            if (error) {
                throw error;
            }

            logger.info('Auto-publish settings updated', { enabled, frequency });

            res.json({
                success: true,
                settings: data
            });
        } catch (error) {
            logger.error('Error updating auto-publish settings', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to update settings'
            });
        }
    });

    /**
     * GET /api/admin/settings
     * Get all system settings
     */
    router.get('/settings', async (req: Request, res: Response) => {
        try {
            const supabase = getSupabaseClient();

            const { data, error } = await supabase
                .from('system_settings')
                .select('*');

            if (error) {
                throw error;
            }

            // Convert to key-value object
            const settings: Record<string, any> = {};
            data?.forEach(setting => {
                settings[setting.setting_key] = setting.setting_value;
            });

            res.json({
                success: true,
                settings
            });
        } catch (error) {
            logger.error('Error getting settings', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to get settings'
            });
        }
    });

    /**
     * POST /api/admin/trigger-broadcast
     * Trigger immediate broadcast of a health topic
     */
    router.post('/trigger-broadcast', async (req: Request, res: Response): Promise<void> => {
        try {
            const supabase = getSupabaseClient();

            // Get active health topics (prioritize by priority, select from top 5)
            const { data: topics, error: topicsError } = await supabase
                .from('health_topics')
                .select('*')
                .eq('is_active', true)
                .in('status', ['published', 'approved'])
                .order('priority', { ascending: false })
                .limit(5);

            if (topicsError) {
                logger.error('Error fetching health topics', topicsError);
                throw topicsError;
            }

            if (!topics || topics.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No active health topics available for broadcast'
                });
                return;
            }

            // Select a random topic from top 5 to add variety
            const topic = topics[Math.floor(Math.random() * topics.length)];

            // Format the broadcast message
            const message = formatHealthTopicMessage(topic);

            // Get all active users
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('phone')
                .eq('status', 'active');

            if (usersError) {
                logger.error('Error fetching users', usersError);
                throw usersError;
            }

            if (!users || users.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'No active users found'
                });
                return;
            }

            // Create broadcast record
            const { data: broadcast, error: broadcastError } = await supabase
                .from('automated_broadcasts')
                .insert({
                    topic_id: topic.id,
                    scheduled_at: new Date().toISOString(),
                    sent_at: new Date().toISOString(),
                    target_count: users.length,
                    status: 'sent'
                })
                .select()
                .single();

            if (broadcastError) {
                logger.error('Error creating broadcast record', broadcastError);
                throw broadcastError;
            }

            // Send messages to all active users via WhatsApp
            let deliveredCount = 0;
            for (const user of users) {
                try {
                    const chatId = `${user.phone}@c.us`;
                    await whatsappClient.sendMessage(chatId, message);
                    deliveredCount++;
                    logger.debug('Broadcast message sent', { phone: user.phone, topicTitle: topic.title });
                } catch (error) {
                    logger.error('Failed to send broadcast to user', error as Error, { phone: user.phone });
                }
            }

            // Update broadcast with delivery count
            await supabase
                .from('automated_broadcasts')
                .update({ delivered_count: deliveredCount })
                .eq('id', broadcast.id);

            // Update topic's times_sent counter
            await supabase
                .from('health_topics')
                .update({ times_sent: (topic.times_sent || 0) + 1 })
                .eq('id', topic.id);

            logger.info('Health topic broadcast completed', {
                topicId: topic.id,
                topicTitle: topic.title,
                targetCount: users.length,
                deliveredCount,
                broadcastId: broadcast.id
            });

            res.json({
                success: true,
                broadcast: {
                    id: broadcast.id,
                    topic: topic.title,
                    targetCount: users.length,
                    deliveredCount,
                    message: message
                }
            });
        } catch (error) {
            logger.error('Error triggering broadcast', error as Error);
            res.status(500).json({
                success: false,
                error: 'Failed to trigger broadcast'
            });
        }
    });

    /**
     * Helper function to format health topic as broadcast message
     */
    function formatHealthTopicMessage(topic: any): string {
        let message = `${topic.icon_emoji} *${topic.title}*\n\n`;
        message += `${topic.short_message}\n\n`;

        if (topic.prevention_tips && topic.prevention_tips.length > 0) {
            message += `*Prevention Tips:*\n`;
            topic.prevention_tips.forEach((tip: string, index: number) => {
                message += `${index + 1}. ${tip}\n`;
            });
            message += `\n`;
        }

        message += `_Reply with "MORE" to learn more about ${topic.title}_`;

        return message;
    }

    return router;
}
