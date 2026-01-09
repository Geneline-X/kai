import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export interface HealthFacility {
    FID: number;
    district: string;
    community: string;
    facility: string;
    fac_name: string;
    type: string;
    ownership: string;
    functional: string;
    lat: number;
    long: number;
    source: string;
    source_geo: string;
    dhis2_id: string;
    geo_date: number;
    comments: string;
    x: number;
    y: number;
}

export interface FacilitySearchResult {
    facility: HealthFacility;
    distance: number; // in kilometers
}

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

/**
 * LocationService handles health facility location searches
 * Uses Haversine formula for accurate GPS distance calculations
 */
export class LocationService {
    private facilities: HealthFacility[] = [];
    private loaded: boolean = false;

    constructor() {
        this.loadFacilities();
    }

    /**
     * Load health facilities from locations.json
     */
    private loadFacilities(): void {
        try {
            const locationsPath = join(__dirname, '../../locations.json');
            const data = readFileSync(locationsPath, 'utf-8');
            this.facilities = JSON.parse(data);

            logger.info('Health facilities loaded', {
                count: this.facilities.length,
            });

            this.loaded = true;
        } catch (error) {
            logger.error('Failed to load health facilities', error as Error);
            this.facilities = [];
            this.loaded = false;
        }
    }

    /**
     * Convert degrees to radians
     */
    private toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @param lat1 - Latitude of first point
     * @param lon1 - Longitude of first point
     * @param lat2 - Latitude of second point
     * @param lon2 - Longitude of second point
     * @returns Distance in kilometers
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in kilometers

        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Find nearest health facilities to given coordinates
     * @param location - User's GPS coordinates
     * @param maxResults - Maximum number of results to return (default: 5)
     * @param facilityType - Optional filter by facility type
     * @returns Array of facilities sorted by distance
     */
    findNearestFacilities(
        location: LocationCoordinates,
        maxResults: number = 5,
        facilityType?: string
    ): FacilitySearchResult[] {
        if (!this.loaded || this.facilities.length === 0) {
            logger.warn('Facilities not loaded, attempting reload');
            this.loadFacilities();

            if (!this.loaded) {
                return [];
            }
        }

        // Filter by facility type if specified
        let facilitiesToSearch = this.facilities;
        if (facilityType) {
            const searchType = facilityType.toUpperCase();
            facilitiesToSearch = this.facilities.filter(
                f => f.type.toUpperCase() === searchType || f.facility.toUpperCase().includes(searchType)
            );
        }

        // Filter only functional facilities
        facilitiesToSearch = facilitiesToSearch.filter(
            f => f.functional === 'Functional'
        );

        // Calculate distances and sort
        const results: FacilitySearchResult[] = facilitiesToSearch.map(facility => ({
            facility,
            distance: this.calculateDistance(
                location.latitude,
                location.longitude,
                facility.lat,
                facility.long
            ),
        }));

        // Sort by distance and return top N
        results.sort((a, b) => a.distance - b.distance);

        return results.slice(0, maxResults);
    }

    /**
     * Find health facilities by text query (name, district, or community)
     * @param query - The search query string
     * @param maxResults - Maximum number of results to return (default: 5)
     * @returns Array of matching facilities
     */
    findFacilitiesByText(query: string, maxResults: number = 5): FacilitySearchResult[] {
        if (!this.loaded || this.facilities.length === 0) {
            this.loadFacilities();
            if (!this.loaded) return [];
        }

        const rawSearch = query.toLowerCase().trim();
        if (!rawSearch) return [];

        // 1. Clean the search term - remove common fillers to extract keywords
        const stopWords = ['district', 'town', 'city', 'village', 'road', 'street', 'community', 'facility', 'health', 'center', 'hospital'];
        let cleanQuery = rawSearch;
        stopWords.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            cleanQuery = cleanQuery.replace(regex, '');
        });

        const keywords = cleanQuery.split(/[\s,]+/).filter(k => k.length >= 3);

        // If we stripped everything too aggressively, use the raw words but filter short ones
        if (keywords.length === 0) {
            keywords.push(...rawSearch.split(/[\s,]+/).filter(k => k.length >= 3));
        }

        // 2. Filter facilities
        const matches = this.facilities
            .filter(f => f.functional === 'Functional')
            .filter(f => {
                const name = f.facility.toLowerCase();
                const dist = f.district.toLowerCase();
                const comm = f.community.toLowerCase();

                // Check if ANY keyword matches ANY field
                return keywords.some(k =>
                    name.includes(k) ||
                    dist.includes(k) ||
                    comm.includes(k) ||
                    k.includes(name) ||
                    k.includes(dist) ||
                    k.includes(comm)
                );
            });

        // 3. Score and sort matches
        const scoredMatches = matches.map(f => {
            const name = f.facility.toLowerCase();
            const dist = f.district.toLowerCase();
            const comm = f.community.toLowerCase();

            let score = 0;

            keywords.forEach(k => {
                // Exact matches get extreme priority
                if (name === k) score += 50;
                if (dist === k) score += 30;
                if (comm === k) score += 20;

                // Substring matches
                if (name.includes(k)) score += 10;
                if (dist.includes(k)) score += 8;
                if (comm.includes(k)) score += 6;

                // Reverse substring for short field names
                if (k.includes(name) && name.length > 3) score += 5;
                if (k.includes(dist) && dist.length > 3) score += 5;
            });

            return { facility: f, score };
        });

        scoredMatches.sort((a, b) => b.score - a.score);

        return scoredMatches.slice(0, maxResults).map(m => ({
            facility: m.facility,
            distance: 0
        }));
    }

    /**
     * Format facility information for WhatsApp message
     * @param result - Facility search result
     * @param index - Index in the list (for numbering)
     * @returns Formatted string
     */
    formatFacilityInfo(result: FacilitySearchResult, index: number): string {
        const { facility, distance } = result;

        // Create Google Maps link
        const mapsLink = `https://maps.google.com/?q=${facility.lat},${facility.long}`;

        // Format facility type
        const typeEmoji = this.getFacilityTypeEmoji(facility.type);

        const distanceLine = distance > 0
            ? `   📏 Distance: ${distance.toFixed(1)} km`
            : `   🔍 Found via location name`;

        return [
            `${index}. **${facility.facility}** ${typeEmoji}`,
            distanceLine,
            `   📍 ${facility.district} District, ${facility.community}`,
            `   🗺️ [Get Directions](${mapsLink})`,
        ].join('\n');
    }

    /**
     * Get emoji for facility type
     */
    private getFacilityTypeEmoji(type: string): string {
        const typeUpper = type.toUpperCase();

        if (typeUpper === 'HOSPITAL') return '🏥';
        if (typeUpper === 'CHC') return '🏥'; // Community Health Center
        if (typeUpper === 'MCHP') return '⚕️'; // Maternal Child Health Post
        if (typeUpper === 'CHP') return '⚕️'; // Community Health Post

        return '🏥';
    }

    /**
     * Format complete search results for WhatsApp
     * @param results - Array of facility search results
     * @param location - User's location
     * @returns Formatted message
     */
    formatSearchResults(results: FacilitySearchResult[], location: LocationCoordinates): string {
        if (results.length === 0) {
            return '❌ No health facilities found near your location. Please try a different area or contact us for assistance.';
        }

        const header = `📍 **Found ${results.length} health facilities near you:**\n\n`;
        const facilities = results.map((result, index) =>
            this.formatFacilityInfo(result, index + 1)
        ).join('\n\n');

        const footer = '\n\n💡 Tap "Get Directions" to open in Google Maps.';

        return header + facilities + footer;
    }

    /**
     * Get all available facility types
     */
    getFacilityTypes(): string[] {
        if (!this.loaded) {
            return [];
        }

        const types = new Set(this.facilities.map(f => f.type));
        return Array.from(types).sort();
    }

    /**
     * Get all districts
     */
    getDistricts(): string[] {
        if (!this.loaded) {
            return [];
        }

        const districts = new Set(this.facilities.map(f => f.district));
        return Array.from(districts).sort();
    }

    /**
     * Check if coordinates are within Sierra Leone bounds (approximate)
     */
    isInSierraLeone(location: LocationCoordinates): boolean {
        // Sierra Leone approximate bounds
        const bounds = {
            minLat: 6.9,
            maxLat: 10.0,
            minLon: -13.3,
            maxLon: -10.3,
        };

        return (
            location.latitude >= bounds.minLat &&
            location.latitude <= bounds.maxLat &&
            location.longitude >= bounds.minLon &&
            location.longitude <= bounds.maxLon
        );
    }
}

// Singleton instance
let locationServiceInstance: LocationService | null = null;

export function getLocationService(): LocationService {
    if (!locationServiceInstance) {
        locationServiceInstance = new LocationService();
    }
    return locationServiceInstance;
}
