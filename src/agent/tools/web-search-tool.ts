import { Tool } from './tool-registry';
import axios from 'axios';
import { logger } from '../../utils/logger';

/**
 * Web Search Tool
 * Searches the internet for current information
 */
export const createWebSearchTool = (): Tool => {
    return {
        name: 'search_web',
        description: 'Search the internet for current information, news, recent events, or real-time data. Use this when users ask about current events, recent news, weather, or anything requiring up-to-date information.',
        parameters: [
            {
                name: 'query',
                type: 'string',
                description: 'The search query to find current information on the internet',
                required: true,
            },
        ],
        execute: async (params: { query: string }): Promise<string> => {
            try {
                if (!params.query || typeof params.query !== 'string') {
                    return 'Error: Query parameter is required and must be a string';
                }

                logger.info('Executing web search', {
                    query: params.query,
                });

                // Using DuckDuckGo Instant Answer API (free, no API key needed)
                const response = await axios.get('https://api.duckduckgo.com/', {
                    params: {
                        q: params.query,
                        format: 'json',
                        no_html: 1,
                        skip_disambig: 1,
                    },
                    timeout: 10000,
                });

                const data = response.data;

                // Build response from DuckDuckGo data
                let result = '';

                // Abstract (main answer)
                if (data.Abstract) {
                    result += `${data.Abstract}\n\n`;
                }

                // Related topics
                if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                    const topics = data.RelatedTopics
                        .filter((topic: any) => topic.Text)
                        .slice(0, 3)
                        .map((topic: any) => `• ${topic.Text}`)
                        .join('\n');

                    if (topics) {
                        result += `Related Information:\n${topics}\n\n`;
                    }
                }

                // If no results, try a different approach
                if (!result.trim()) {
                    // Fallback: Use a simple web scraping approach or return a helpful message
                    result = `I searched for "${params.query}" but couldn't find specific instant answers. This might be a topic that requires browsing recent news or specialized sources. You may want to check news websites or official sources for the most current information.`;
                }

                logger.info('Web search completed', {
                    query: params.query,
                    resultLength: result.length,
                });

                return result.trim();

            } catch (error) {
                logger.error('Web search failed', error as Error, {
                    query: params.query,
                });
                return `Error searching the web: ${(error as Error).message}. The information might not be available through web search at this time.`;
            }
        },
    };
};
