import { Tool } from './tool-registry';
import axios from 'axios';
import { logger } from '../../utils/logger';

/**
 * Web Search Tool
 * Searches the internet for current information using Google News RSS
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

                let result = '';

                // Try Google News RSS first (best for current news)
                try {
                    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(params.query)}&hl=en&gl=US&ceid=US:en`;

                    const newsResponse = await axios.get(googleNewsUrl, {
                        timeout: 10000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
                        },
                    });

                    // Parse RSS - simple regex parsing since we don't want to add xml2js dependency
                    const items = newsResponse.data.match(/<item>([\s\S]*?)<\/item>/g);

                    if (items && items.length > 0) {
                        const newsItems: string[] = [];

                        for (let i = 0; i < Math.min(4, items.length); i++) {
                            const titleMatch = items[i].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
                            const title = titleMatch ? titleMatch[1] : items[i].match(/<title>(.*?)<\/title>/)?.[1];

                            const pubDateMatch = items[i].match(/<pubDate>(.*?)<\/pubDate>/);
                            const pubDate = pubDateMatch ? pubDateMatch[1] : '';

                            if (title) {
                                const formattedDate = pubDate ? ` (${new Date(pubDate).toLocaleDateString()})` : '';
                                newsItems.push(`• ${title}${formattedDate}`);
                            }
                        }

                        if (newsItems.length > 0) {
                            result = `Recent News:\n${newsItems.join('\n')}\n\n`;
                        }
                    }
                } catch (newsError) {
                    logger.debug('Google News search failed', { error: (newsError as Error).message });
                }

                // If news search didn't work, try DuckDuckGo
                if (!result.trim()) {
                    try {
                        const ddgResponse = await axios.get('https://api.duckduckgo.com/', {
                            params: {
                                q: params.query,
                                format: 'json',
                                no_html: 1,
                                skip_disambig: 1,
                            },
                            timeout: 8000,
                        });

                        const ddgData = ddgResponse.data;

                        if (ddgData.Abstract) {
                            result += `${ddgData.Abstract}\n\n`;
                        }

                        if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
                            const topics = ddgData.RelatedTopics
                                .filter((topic: any) => topic.Text)
                                .slice(0, 3)
                                .map((topic: any) => `• ${topic.Text}`)
                                .join('\n');

                            if (topics) {
                                result += `Related Information:\n${topics}\n\n`;
                            }
                        }
                    } catch (ddgError) {
                        logger.debug('DuckDuckGo search failed', { error: (ddgError as Error).message });
                    }
                }

                // If still no results
                if (!result.trim()) {
                    result = `I searched for "${params.query}" but couldn't find specific current information. For the most up-to-date news and information, I recommend checking trusted news sources like BBC, Reuters, or local news outlets directly.`;
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
                return `I was unable to search for current information about "${params.query}" at this time. For the latest updates, please check news websites or official sources directly.`;
            }
        },
    };
};
