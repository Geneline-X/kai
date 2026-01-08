
import { getLocationService } from './src/services/location-service';
import { createFindFacilityTool } from './src/agent/tools/find-facility-tool';

async function testKenemaSearch() {
    console.log('🔍 Testing Location Search Accuracy...');

    const tool = createFindFacilityTool();

    // Test case: Text-based search for Kenema
    console.log('\n--- Test 1: Text Search for "Kenema" ---');
    const result1 = await tool.execute({
        query: "Kenema",
        latitude: 7.35, // Intentionally bad coords (Pujehun)
        longitude: -11.72
    });
    console.log(result1);

    // Test case: Text-based search for Hanga
    console.log('\n--- Test 2: Text Search for "Hanga" ---');
    const result2 = await tool.execute({
        query: "Hanga",
        latitude: 7.35,
        longitude: -11.72
    });
    console.log(result2);
}

testKenemaSearch().catch(console.error);
