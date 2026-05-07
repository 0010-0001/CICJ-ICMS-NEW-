/**
 * Test script for geo-fencing functionality
 * Tests construction site creation and attendance geo-fence validation
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
let AUTH_TOKEN = '';

// Test data
const ADMIN_LOGIN = {
    email: 'kpaysan.a12345472@umak.edu.ph',
    password: 'kian1234' // You may need to update this
};

// Manila - UMAK University coordinates (example)
const TEST_SITE = {
    site_name: 'CICJ Main Construction Site',
    site_address: 'Manila, Philippines',
    center_lat: 14.5995,  // UMAK approximate location
    center_lng: 120.9842,
    geo_fence_radius_meters: 100  // 100 meter radius
};

// Test coordinates
const COORDS_INSIDE = {
    location_lat: 14.5996,  // ~11 meters north (should PASS)
    location_lng: 120.9843,
    action: 'clock_in'
};

const COORDS_OUTSIDE = {
    location_lat: 14.6100,  // ~1.2 km north (should FAIL)
    location_lng: 120.9900,
    action: 'clock_in'
};

async function runTests() {
    console.log('[Test] Starting Geo-Fencing Tests...\n');

    try {
        // Step 1: Login as admin (with MFA OTP)
        console.log('[1] Logging in as admin...');
        const loginRes = await axios.post(`${BASE_URL}/login`, ADMIN_LOGIN);
        console.log('[Email] OTP sent to email. Please enter the OTP:');
        
        // For testing purposes, we'll simulate OTP input
        // In production, you'd prompt for OTP from user
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const otp = await new Promise(resolve => {
            readline.question('Enter OTP from email: ', answer => {
                readline.close();
                resolve(answer);
            });
        });

        // Step 2: Verify OTP to get JWT token
        const verifyRes = await axios.post(`${BASE_URL}/verify-otp`, {
            email: ADMIN_LOGIN.email,
            otp: otp.trim()
        });
        AUTH_TOKEN = verifyRes.data.token;
        console.log('[SUCCESS] Login successful\n');

        // Step 2: Create construction site
        console.log('[2] Creating construction site...');
        const siteRes = await axios.post(
            `${BASE_URL}/api/sites`,
            TEST_SITE,
            { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        console.log('[SUCCESS] Site created:', siteRes.data.site);
        console.log(`   [Location] ${TEST_SITE.center_lat}, ${TEST_SITE.center_lng}`);
        console.log(`   [Radius] ${TEST_SITE.geo_fence_radius_meters} meters\n`);

        // Step 3: Test location check endpoint
        console.log('3ï¸âƒ£ Testing location check endpoint...');
        
        // Test from inside
        console.log('   Testing coordinates INSIDE geo-fence...');
        const checkInside = await axios.post(
            `${BASE_URL}/api/sites/check-location`,
            COORDS_INSIDE,
            { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        console.log('   Result:', checkInside.data);
        console.log(checkInside.data.withinSite ? '   âœ… PASSED' : '   âŒ FAILED');
        console.log('');

        // Test from outside
        console.log('   Testing coordinates OUTSIDE geo-fence...');
        const checkOutside = await axios.post(
            `${BASE_URL}/api/sites/check-location`,
            COORDS_OUTSIDE,
            { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        console.log('   Result:', checkOutside.data);
        console.log(!checkOutside.data.withinSite ? '   âœ… PASSED' : '   âŒ FAILED');
        console.log('');

        // Step 4: Test actual attendance with geo-fence
        console.log('4ï¸âƒ£ Testing attendance with geo-fence validation...');
        
        // Test clock-in from inside (should succeed)
        console.log('   Attempting clock-in from INSIDE geo-fence...');
        try {
            const attendanceInside = await axios.post(
                `${BASE_URL}/api/attendance`,
                COORDS_INSIDE,
                { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
            );
            console.log('   âœ… PASSED - Clock-in allowed');
            console.log('   Attendance Log:', attendanceInside.data.log);
            console.log('');
        } catch (error) {
            console.log('   âŒ FAILED - Should have been allowed');
            console.log('   Error:', error.response?.data);
            console.log('');
        }

        // Test clock-in from outside (should fail)
        console.log('   Attempting clock-in from OUTSIDE geo-fence...');
        try {
            const attendanceOutside = await axios.post(
                `${BASE_URL}/api/attendance`,
                COORDS_OUTSIDE,
                { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
            );
            console.log('   âŒ FAILED - Should have been rejected');
            console.log('   Response:', attendanceOutside.data);
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('   âœ… PASSED - Correctly rejected with 403');
                console.log('   Error Details:', error.response.data);
            } else {
                console.log('   âŒ Unexpected error:', error.response?.data);
            }
        }

        console.log('\nâœ… All tests completed!');

    } catch (error) {
        console.error('\nâŒ Test failed:', error.response?.data || error.message);
    }
}

runTests();

