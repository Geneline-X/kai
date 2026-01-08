import { Tool } from './tool-registry';
import { getLocationService, LocationCoordinates } from '../../services/location-service';
import { logger } from '../../utils/logger';

/**
 * Tool for finding nearby health facilities based on GPS coordinates
 */
export const createFindFacilityTool = (): Tool => {
    return {
        name: 'find_health_facility',
        description: `Find nearby health facilities in Sierra Leone based on GPS coordinates. 
Use this when user shares their location or asks to find nearby hospitals, clinics, or health centers.
Returns the nearest facilities with distances and directions.`,
        parameters: [
            {
                name: 'latitude',
                type: 'number',
                description: 'GPS latitude coordinate (e.g., 8.4657 for Freetown)',
                required: false,
            },
            {
                name: 'longitude',
                type: 'number',
                description: 'GPS longitude coordinate (e.g., -13.2317 for Freetown)',
                required: false,
            },
            {
                name: 'query',
                type: 'string',
                description: 'Optional: Search by name of town, road, district, or facility (e.g., "Kenema", "Hanga Road")',
                required: false,
            },
            {
                name: 'facilityType',
                type: 'string',
                description: 'Optional: Filter by facility type (HOSPITAL, CHC, MCHP, CHP)',
                required: false,
            },
            {
                name: 'maxResults',
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                required: false,
            },
        ],
        execute: async (params: {
            latitude?: number;
            longitude?: number;
            query?: string;
            facilityType?: string;
            maxResults?: number;
        }): Promise<string> => {
            try {
                const { latitude, longitude, query, facilityType, maxResults = 5 } = params;

                logger.info('Finding health facilities', {
                    latitude,
                    longitude,
                    query,
                    facilityType,
                    maxResults,
                });

                const locationService = getLocationService();
                let results: any[] = [];
                let userLocation: LocationCoordinates | undefined;

                // 1. Try text-based search if query is provided
                if (query) {
                    results = locationService.findFacilitiesByText(query, maxResults);
                    logger.info('Text-based facility search results', { count: results.length, query });
                }

                // 2. If no text results or no query, try coordinate-based search
                if (results.length === 0 && latitude !== undefined && longitude !== undefined) {
                    userLocation = { latitude, longitude };

                    // Check if location is within Sierra Leone
                    if (!locationService.isInSierraLeone(userLocation)) {
                        return `⚠️ The location you provided (${latitude}, ${longitude}) appears to be outside Sierra Leone.\n\n` +
                            `This service only covers health facilities within Sierra Leone. ` +
                            `Please share a location within Sierra Leone or contact us for assistance.`;
                    }

                    results = locationService.findNearestFacilities(
                        userLocation,
                        maxResults,
                        facilityType
                    );
                }

                if (results.length === 0) {
                    let message = '❌ No health facilities found';
                    if (query) message += ` for "${query}"`;
                    message += '.';

                    if (facilityType) {
                        message += `\n\nThere are no ${facilityType} facilities nearby. ` +
                            `Would you like me to search for other types of health facilities?`;
                    } else {
                        message += '\n\nThis may be a remote area or a missing location name. Please try:\n' +
                            '1. Sharing your GPS location via WhatsApp\n' +
                            '2. Providing a more specific town or district name\n' +
                            '3. Contacting us for assistance';
                    }

                    return message;
                }

                // Format and return results
                const formattedResults = locationService.formatSearchResults(results, userLocation || { latitude: 0, longitude: 0 });

                logger.info('Health facilities found', {
                    count: results.length,
                    nearest: results[0].facility.facility,
                    distance: results[0].distance.toFixed(1),
                });

                return formattedResults;

            } catch (error) {
                logger.error('Error finding health facilities', error as Error);

                return '❌ I encountered an error while searching for health facilities. ' +
                    'Please try again or contact us for assistance.';
            }
        },
    };
};
