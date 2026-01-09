
import { getLocationService } from './src/services/location-service';

async function debugSegbwema() {
    console.log('--- Debugging Segbwema Search ---');
    const locationService = getLocationService();

    const queries = ['Segbwema', 'segbwema', 'Kailahun District', 'Segbwema town', 'Segbwema park'];

    for (const q of queries) {
        console.log(`\nQuery: "${q}"`);
        const results = locationService.findFacilitiesByText(q);
        console.log(`Results: ${results.length}`);
        if (results.length > 0) {
            console.log(`Top match: ${results[0].facility.facility} in ${results[0].facility.district} (${results[0].facility.community})`);
        }
    }
}

debugSegbwema().catch(console.error);
