/**
 * ==========================================
 * MFA (MULTI-FACTOR AUTHENTICATION) TEST SUITE
 * ==========================================
 * Tests email-based OTP system
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = 'admin@cicj.com';
const TEST_PASSWORD = 'Password123!';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

/**
 * Helper: Make HTTP request
 */
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedBody = body ? JSON.parse(body) : {};
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: parsedBody
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Helper: Prompt user for OTP (for manual testing)
 */
function promptForOTP() {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question(`\n${YELLOW}Enter the 6-digit OTP from your email (or terminal): ${RESET}`, (answer) => {
            readline.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Test 1: Login Flow - OTP Generation
 */
async function testLoginOTPGeneration() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 1: Login - OTP Generation');
    console.log(`========================================${RESET}\n`);

    try {
        const response = await makeRequest('POST', '/login', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.body, null, 2));

        if (response.status === 200 && response.body.mfaRequired) {
            console.log(`\n${GREEN}✅ MFA Required: ${response.body.mfaRequired}${RESET}`);
            console.log(`${GREEN}✅ Email: ${response.body.email}${RESET}`);
            console.log(`${GREEN}✅ Expires In: ${response.body.expiresIn} seconds${RESET}`);
            console.log(`${GREEN}✅ Hint: ${response.body.hint}${RESET}`);
            
            if (response.body.devMode) {
                console.log(`${YELLOW}⚠️  Dev Mode: Check terminal for OTP${RESET}`);
            }

            return { success: true, email: response.body.email };
        } else {
            console.log(`${RED}❌ MFA not triggered or unexpected response${RESET}`);
            return { success: false };
        }

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Test 2: OTP Verification - Valid OTP
 */
async function testOTPVerification(email, otp) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 2: OTP Verification - Valid Code');
    console.log(`========================================${RESET}\n`);

    try {
        const response = await makeRequest('POST', '/verify-otp', {
            email,
            otp
        });

        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.body, null, 2));

        if (response.status === 200 && response.body.token) {
            console.log(`\n${GREEN}✅ OTP Verified Successfully${RESET}`);
            console.log(`${GREEN}✅ JWT Token: ${response.body.token.substring(0, 30)}...${RESET}`);
            console.log(`${GREEN}✅ User: ${response.body.user.full_name} (${response.body.user.email})${RESET}`);
            console.log(`${GREEN}✅ Role: ${response.body.user.role}${RESET}`);

            return { success: true, token: response.body.token };
        } else {
            console.log(`${RED}❌ OTP verification failed${RESET}`);
            console.log(`${RED}   Error: ${response.body.error}${RESET}`);
            return { success: false };
        }

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Test 3: Invalid OTP
 */
async function testInvalidOTP(email) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 3: OTP Verification - Invalid Code');
    console.log(`========================================${RESET}\n`);

    try {
        const response = await makeRequest('POST', '/verify-otp', {
            email,
            otp: '000000' // Wrong OTP
        });

        console.log(`Status: ${response.status}`);

        if (response.status === 401) {
            console.log(`${GREEN}✅ Invalid OTP correctly rejected${RESET}`);
            console.log(`   Error: ${response.body.error}`);
            console.log(`   Code: ${response.body.code}`);
            console.log(`   Attempts Left: ${response.body.attemptsLeft}`);
            return { success: true };
        } else {
            console.log(`${RED}❌ Invalid OTP not properly rejected${RESET}`);
            return { success: false };
        }

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Test 4: Resend OTP
 */
async function testResendOTP(email) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 4: Resend OTP');
    console.log(`========================================${RESET}\n`);

    try {
        // First resend attempt (should work)
        const response1 = await makeRequest('POST', '/resend-otp', { email });

        console.log(`First Resend - Status: ${response1.status}`);

        if (response1.status === 200) {
            console.log(`${GREEN}✅ OTP resent successfully${RESET}`);
            console.log(`   Message: ${response1.body.message}`);
        } else {
            console.log(`${YELLOW}⚠️  First resend had issues: ${response1.body.error}${RESET}`);
        }

        // Immediate second resend (should be rate-limited)
        console.log(`\n${YELLOW}Testing rate limiting (immediate resend)...${RESET}`);
        const response2 = await makeRequest('POST', '/resend-otp', { email });

        console.log(`Second Resend - Status: ${response2.status}`);

        if (response2.status === 429) {
            console.log(`${GREEN}✅ Rate limiting working${RESET}`);
            console.log(`   Error: ${response2.body.error}`);
            console.log(`   Wait Time: ${response2.body.waitTime} seconds`);
            return { success: true };
        } else {
            console.log(`${RED}❌ Rate limiting not working${RESET}`);
            return { success: false };
        }

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Test 5: OTP Expiration
 */
async function testOTPExpiration(email) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 5: OTP Expiration (Manual Test)');
    console.log(`========================================${RESET}\n`);

    console.log(`${YELLOW}ℹ️  OTP expiration is set to 5 minutes${RESET}`);
    console.log(`${YELLOW}ℹ️  To test expiration, wait 5 minutes and try to verify OTP${RESET}`);
    console.log(`${YELLOW}ℹ️  Skipping automated expiration test (would take too long)${RESET}`);

    return { success: true, skipped: true };
}

/**
 * Test 6: Max Attempts Exceeded
 */
async function testMaxAttempts(email) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 6: Max Attempts Exceeded (3 attempts)');
    console.log(`========================================${RESET}\n`);

    try {
        // Generate new OTP first
        const loginResponse = await makeRequest('POST', '/login', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });

        if (loginResponse.status !== 200) {
            console.log(`${RED}❌ Failed to generate OTP${RESET}`);
            return { success: false };
        }

        // Wait to avoid rate limit from previous test
        console.log(`${YELLOW}Waiting 65 seconds to avoid rate limit...${RESET}`);
        await new Promise(resolve => setTimeout(resolve, 65000));

        // Try 3 wrong OTPs
        for (let i = 1; i <= 3; i++) {
            console.log(`\n${YELLOW}Attempt ${i}/3 with wrong OTP...${RESET}`);
            
            const response = await makeRequest('POST', '/verify-otp', {
                email,
                otp: `${i}${i}${i}${i}${i}${i}` // Wrong OTP
            });

            console.log(`Status: ${response.status}`);
            console.log(`Attempts Left: ${response.body.attemptsLeft}`);

            if (i === 3 && response.body.code === 'MAX_ATTEMPTS_EXCEEDED') {
                console.log(`\n${GREEN}✅ Max attempts limit enforced${RESET}`);
                console.log(`   Error: ${response.body.error}`);
                return { success: true };
            }
        }

        console.log(`${RED}❌ Max attempts limit not enforced${RESET}`);
        return { success: false };

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Test 7: OTP Status Endpoint (Dev Mode Only)
 */
async function testOTPStatus(email) {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 7: OTP Status Endpoint (Dev Mode)');
    console.log(`========================================${RESET}\n`);

    if (process.env.NODE_ENV === 'production') {
        console.log(`${YELLOW}⚠️  Skipped (production mode)${RESET}`);
        return { success: true, skipped: true };
    }

    try {
        const response = await makeRequest('GET', `/otp-status/${encodeURIComponent(email)}`);

        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(response.body, null, 2));

        if (response.status === 200) {
            console.log(`${GREEN}✅ OTP status retrieved${RESET}`);
            console.log(`   Exists: ${response.body.exists}`);
            
            if (response.body.exists) {
                console.log(`   Expires In: ${response.body.expiresIn} seconds`);
                console.log(`   Attempts: ${response.body.attempts}/${response.body.maxAttempts}`);
            }

            return { success: true };
        } else {
            console.log(`${RED}❌ Failed to get OTP status${RESET}`);
            return { success: false };
        }

    } catch (error) {
        console.error(`${RED}❌ Test failed:${RESET}`, error.message);
        return { success: false };
    }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
    console.log(`\n${MAGENTA}╔════════════════════════════════════════╗`);
    console.log(`║  MFA (MULTI-FACTOR AUTHENTICATION)     ║`);
    console.log(`║  EMAIL-BASED OTP TEST SUITE            ║`);
    console.log(`╚════════════════════════════════════════╝${RESET}\n`);

    console.log(`${YELLOW}⚠️  Ensure the server is running on ${BASE_URL}${RESET}`);
    console.log(`${YELLOW}⚠️  Test account: ${TEST_EMAIL}${RESET}\n`);

    const results = [];

    try {
        // Test 1: Generate OTP
        const test1 = await testLoginOTPGeneration();
        results.push({ test: 'Login OTP Generation', ...test1 });

        if (!test1.success) {
            console.log(`\n${RED}❌ Login flow failed. Stopping tests.${RESET}`);
            return;
        }

        // Prompt for OTP
        const otp = await promptForOTP();

        if (!otp || otp.length !== 6) {
            console.log(`${RED}❌ Invalid OTP format. Tests aborted.${RESET}`);
            return;
        }

        // Test 2: Verify valid OTP
        const test2 = await testOTPVerification(test1.email, otp);
        results.push({ test: 'Valid OTP Verification', ...test2 });

        // Wait before next test
        console.log(`\n${YELLOW}Waiting 5 seconds before next test...${RESET}`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Generate new OTP for subsequent tests
        await testLoginOTPGeneration();

        // Wait for rate limit
        console.log(`\n${YELLOW}Waiting 65 seconds to avoid rate limit...${RESET}`);
        await new Promise(resolve => setTimeout(resolve, 65000));

        // Test 3: Invalid OTP
        const test3 = await testInvalidOTP(test1.email);
        results.push({ test: 'Invalid OTP Rejection', ...test3 });

        // Test 4: Resend OTP
        const test4 = await testResendOTP(test1.email);
        results.push({ test: 'Resend OTP & Rate Limiting', ...test4 });

        // Test 5: Expiration (skipped)
        const test5 = await testOTPExpiration(test1.email);
        results.push({ test: 'OTP Expiration', ...test5 });

        // Test 6: Max attempts (optional - takes time)
        console.log(`\n${YELLOW}Test 6 (Max Attempts) requires 65 second wait. Skip? (y/n)${RESET}`);
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const skipTest6 = await new Promise((resolve) => {
            readline.question('', (answer) => {
                readline.close();
                resolve(answer.toLowerCase() === 'y');
            });
        });

        if (!skipTest6) {
            const test6 = await testMaxAttempts(test1.email);
            results.push({ test: 'Max Attempts Exceeded', ...test6 });
        } else {
            results.push({ test: 'Max Attempts Exceeded', success: true, skipped: true });
        }

        // Test 7: OTP Status
        const test7 = await testOTPStatus(test1.email);
        results.push({ test: 'OTP Status Endpoint', ...test7 });

        // Summary
        console.log(`\n${MAGENTA}╔════════════════════════════════════════╗`);
        console.log(`║  TEST SUMMARY                          ║`);
        console.log(`╚════════════════════════════════════════╝${RESET}\n`);

        results.forEach((result, index) => {
            const status = result.skipped ? `${YELLOW}⊘ SKIPPED${RESET}` :
                          result.success ? `${GREEN}✅ PASS${RESET}` :
                          `${RED}❌ FAIL${RESET}`;
            console.log(`${index + 1}. ${result.test}: ${status}`);
        });

        const passed = results.filter(r => r.success && !r.skipped).length;
        const failed = results.filter(r => !r.success && !r.skipped).length;
        const skipped = results.filter(r => r.skipped).length;

        console.log(`\n${BLUE}Results: ${passed} passed, ${failed} failed, ${skipped} skipped${RESET}`);

        if (failed === 0) {
            console.log(`\n${GREEN}🎉 All MFA tests passed!${RESET}\n`);
        } else {
            console.log(`\n${RED}❌ Some tests failed. Review output above.${RESET}\n`);
        }

    } catch (error) {
        console.error(`\n${RED}❌ Test suite error:${RESET}`, error);
    }
}

// Run tests
runAllTests();
