import { getSupabaseClient } from './src/config/supabase';

async function analyzeMessages() {
    try {
        const supabase = getSupabaseClient();
        console.log('--- Message Database Analysis ---');

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error fetching messages:', error);
            return;
        }

        console.log(`Analyzing ${messages.length} recent messages...`);

        const nullUserIds = messages.filter(m => m.user_id === null).length;
        const nullContent = messages.filter(m => m.content === null || m.content === '').length;
        const senderStats: Record<string, number> = {};

        messages.forEach(m => {
            senderStats[m.sender] = (senderStats[m.sender] || 0) + 1;
        });

        console.log('Sender distribution:', senderStats);
        console.log('Null User IDs:', nullUserIds);
        console.log('Null Content:', nullContent);

    } catch (error) {
        console.error('Failed:', error);
    }
}

analyzeMessages();
