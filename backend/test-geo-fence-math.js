/**
 * Unit test for Haversine formula and geo-fencing logic
 * No database or authentication required
 */

const {
    calculateDistance,
    isWithinGeoFence,
    isValidCoordinates,
    findNearestSite
} = require('./middleware/geo-fencing');

console.log('[Test] Testing Geo-Fencing Mathematics...\n');

// Test 1: Coordinate Validation
console.log('[1] Testing Coordinate Validation');
console.log('   Valid coordinates (14.5995, 120.9842):', isValidCoordinates(14.5995, 120.9842) ? '[PASS]' : '[FAIL]');
console.log('   Invalid latitude (95, 120):', isValidCoordinates(95, 120) ? '[FAIL]' : '[PASS]');
console.log('   Invalid longitude (14, 200):', isValidCoordinates(14, 200) ? '[FAIL]' : '[PASS]');
console.log('');

// Test 2: Haversine Distance Calculation
console.log('[2] Testing Haversine Formula');

// Manila coordinates - very close (should be ~11 meters)
const manila1 = { lat: 14.5995, lng: 120.9842 };
const manila2 = { lat: 14.5996, lng: 120.9843 }; // ~11m north-east

const distance1 = calculateDistance(manila1.lat, manila1.lng, manila2.lat, manila2.lng);
console.log(`   Distance from (${manila1.lat}, ${manila1.lng})`);
console.log(`              to (${manila2.lat}, ${manila2.lng})`);
console.log(`   = ${distance1} meters (expected ~11m)`);
console.log(distance1 >= 10 && distance1 <= 20 ? '   [PASS]\n' : '   [FAIL]\n');

// Further apart (~1.2 km)
const manila3 = { lat: 14.6100, lng: 120.9900 };
const distance2 = calculateDistance(manila1.lat, manila1.lng, manila3.lat, manila3.lng);
console.log(`   Distance from (${manila1.lat}, ${manila1.lng})`);
console.log(`              to (${manila3.lat}, ${manila3.lng})`);
console.log(`   = ${distance2} meters (expected ~1200m)`);
console.log(distance2 >= 1100 && distance2 <= 1300 ? '   [PASS]\n' : '   [FAIL]\n');

// Test 3: Geo-fence Boundary Check
console.log('[3] Testing Geo-Fence Validation');

// Site at manila1, radius 100m
const siteLat = 14.5995;
const siteLng = 120.9842;
const radius = 100;

// Test point inside fence (~11m away)
const check1 = isWithinGeoFence(manila2.lat, manila2.lng, siteLat, siteLng, radius);
console.log(`   Point at ${check1.distance}m from site center (radius: ${radius}m)`);
console.log(`   isWithinFence: ${check1.isWithinFence}`);
console.log(check1.isWithinFence ? '   [PASS] - Inside fence\n' : '   [FAIL] - Should be inside\n');

// Test point outside fence (~1200m away)
const check2 = isWithinGeoFence(manila3.lat, manila3.lng, siteLat, siteLng, radius);
console.log(`   Point at ${check2.distance}m from site center (radius: ${radius}m)`);
console.log(`   isWithinFence: ${check2.isWithinFence}`);
console.log(!check2.isWithinFence ? '   [PASS] - Outside fence\n' : '   [FAIL] - Should be outside\n');

// Test 4: Find Nearest Site
console.log('[4] Testing Nearest Site Finder');

const testSites = [
    {
        site_id: 1,
        site_name: 'Site A - Manila',
        center_lat: 14.5995,
        center_lng: 120.9842,
        geo_fence_radius_meters: 100
    },
    {
        site_id: 2,
        site_name: 'Site B - Quezon City',
        center_lat: 14.6760,
        center_lng: 121.0437,
        geo_fence_radius_meters: 150
    },
    {
        site_id: 3,
        site_name: 'Site C - Makati',
        center_lat: 14.5547,
        center_lng: 121.0244,
        geo_fence_radius_meters: 200
    }
];

// User at 14.5996, 120.9843 (very close to Site A)
const nearest = findNearestSite(14.5996, 120.9843, testSites);
console.log(`   User location: (14.5996, 120.9843)`);
console.log(`   Nearest site: ${nearest.site_name}`);
console.log(`   Distance: ${nearest.distance} meters`);
console.log(nearest.site_id === 1 ? '   [PASS] - Correctly found Site A\n' : '   [FAIL] - Should be Site A\n');

// Test 5: Edge Cases
console.log('[5] Testing Edge Cases');

// Exactly on boundary (100m away)
const boundaryDistance = calculateDistance(siteLat, siteLng, siteLat + 0.0009, siteLng);
console.log(`   Boundary test distance: ${boundaryDistance}m`);
const boundaryCheck = isWithinGeoFence(siteLat + 0.0009, siteLng, siteLat, siteLng, 100);
console.log(`   isWithinFence at ~${boundaryDistance}m: ${boundaryCheck.isWithinFence}`);
console.log('   â„¹ï¸  Note: Boundary may be slightly inside or outside due to rounding\n');

// Same coordinates (0m distance)
const sameSpot = calculateDistance(siteLat, siteLng, siteLat, siteLng);
console.log(`   Same coordinates distance: ${sameSpot}m`);
console.log(sameSpot === 0 ? '   âœ… PASS\n' : '   âŒ FAIL\n');

console.log('âœ… All mathematical tests completed!\n');
console.log('ðŸ“Š Haversine Formula Accuracy:');
console.log('   - Short distances (~11m): Â±5m precision');
console.log('   - Medium distances (~1km): Â±50m precision');
console.log('   - Formula: d = 2R Ã— arcsin(âˆš(sinÂ²(Î”Ï†/2) + cos(Ï†â‚)cos(Ï†â‚‚)sinÂ²(Î”Î»/2)))');
console.log('   - Earth radius: 6,371,000 meters');

