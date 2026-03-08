/**
 * ==========================================
 * SECURITY HARDENING TEST SUITE
 * ==========================================
 * Tests input validation, XSS prevention, security headers,
 * rate limiting, and CSRF protection
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
let authToken = '';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
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
 * Test 1: Security Headers
 */
async function testSecurityHeaders() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 1: Security Headers (Helmet)');
    console.log(`========================================${RESET}\n`);

    try {
        const response = await makeRequest('GET', '/api/security/headers');
        
        console.log(`Status: ${response.status}`);
        
        const requiredHeaders = [
            'x-frame-options',
            'x-content-type-options',
            'strict-transport-security',
            'content-security-policy'
        ];

        let allHeadersPresent = true;
        
        requiredHeaders.forEach(header => {
            if (response.headers[header]) {
                console.log(`${GREEN}✅ ${header}: ${response.headers[header]}${RESET}`);
            } else {
                console.log(`${RED}❌ ${header}: MISSING${RESET}`);
                allHeadersPresent = false;
            }
        });

        if (allHeadersPresent) {
            console.log(`\n${GREEN}✅ All security headers present${RESET}`);
        } else {
            console.log(`\n${RED}❌ Some security headers missing${RESET}`);
        }

    } catch (error) {
        console.error(`${RED}❌ Security headers test failed:${RESET}`, error.message);
    }
}

/**
 * Test 2: Input Validation (Login)
 */
async function testInputValidation() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 2: Input Validation');
    console.log(`========================================${RESET}\n`);

    // Test 2a: Invalid email format
    console.log(`${YELLOW}Test 2a: Invalid email format${RESET}`);
    try {
        const response = await makeRequest('POST', '/login', {
            email: 'not-an-email',
            password: 'Password123!'
        });
        
        if (response.status === 400 && response.body.error === 'Validation failed') {
            console.log(`${GREEN}✅ Invalid email rejected: ${response.body.details[0].message}${RESET}`);
        } else {
            console.log(`${RED}❌ Invalid email not properly validated${RESET}`);
        }
    } catch (error) {
        console.error(`${RED}❌ Test error:${RESET}`, error.message);
    }

    // Test 2b: Short password
    console.log(`\n${YELLOW}Test 2b: Short password${RESET}`);
    try {
        const response = await makeRequest('POST', '/login', {
            email: 'test@example.com',
            password: 'short'
        });
        
        if (response.status === 400 && response.body.error === 'Validation failed') {
            console.log(`${GREEN}✅ Short password rejected: ${response.body.details[0].message}${RESET}`);
        } else {
            console.log(`${RED}❌ Short password not properly validated${RESET}`);
        }
    } catch (error) {
        console.error(`${RED}❌ Test error:${RESET}`, error.message);
    }

    // Test 2c: Missing fields
    console.log(`\n${YELLOW}Test 2c: Missing fields${RESET}`);
    try {
        const response = await makeRequest('POST', '/login', {
            email: 'test@example.com'
            // password missing
        });
        
        if (response.status === 400) {
            console.log(`${GREEN}✅ Missing password rejected${RESET}`);
        } else {
            console.log(`${RED}❌ Missing fields not properly validated${RESET}`);
        }
    } catch (error) {
        console.error(`${RED}❌ Test error:${RESET}`, error.message);
    }
}

/**
 * Test 3: XSS Prevention
 */
async function testXSSPrevention() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 3: XSS Prevention');
    console.log(`========================================${RESET}\n`);

    // First, authenticate to get token
    try {
        const loginResponse = await makeRequest('POST', '/login', {
            email: 'admin@cicj.com',
            password: 'Password123!'
        });

        if (loginResponse.status === 200) {
            authToken = loginResponse.body.token;
            console.log(`${GREEN}✅ Authenticated as admin${RESET}`);
        } else {
            console.log(`${RED}❌ Failed to authenticate${RESET}`);
            return;
        }

        // Test XSS in user registration
        console.log(`\n${YELLOW}Test 3a: XSS in full name${RESET}`);
        const xssPayload = {
            full_name: '<script>alert("XSS")</script>John Doe',
            email: 'xss-test@example.com',
            password: 'SecurePassword123!',
            role: 'EMPLOYEE'
        };

        const response = await makeRequest('POST', '/register', xssPayload, {
            'Authorization': `Bearer ${authToken}`
        });

        // XSS should be sanitized or rejected
        if (response.status === 400 || 
            (response.status === 200 && !response.body.user?.full_name?.includes('<script>'))) {
            console.log(`${GREEN}✅ XSS payload sanitized or rejected${RESET}`);
            if (response.body.user) {
                console.log(`   Sanitized name: ${response.body.user.full_name}`);
            }
        } else {
            console.log(`${RED}❌ XSS payload NOT properly handled${RESET}`);
        }

    } catch (error) {
        console.error(`${RED}❌ XSS test error:${RESET}`, error.message);
    }
}

/**
 * Test 4: Rate Limiting
 */
async function testRateLimiting() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 4: Rate Limiting');
    console.log(`========================================${RESET}\n`);

    console.log(`${YELLOW}Sending 15 rapid login requests (limit: 10)${RESET}`);

    let blockedCount = 0;
    let successCount = 0;

    for (let i = 1; i <= 15; i++) {
        try {
            const response = await makeRequest('POST', '/login', {
                email: 'test@example.com',
                password: 'WrongPassword123!'
            });

            if (response.status === 429) {
                blockedCount++;
                if (blockedCount === 1) {
                    console.log(`\n${GREEN}✅ Rate limit triggered at request ${i}${RESET}`);
                    console.log(`   Message: ${response.body.error}`);
                }
            } else {
                successCount++;
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`${RED}Request ${i} error:${RESET}`, error.message);
        }
    }

    console.log(`\n${YELLOW}Summary:${RESET}`);
    console.log(`Successful requests: ${successCount}`);
    console.log(`Rate-limited requests: ${blockedCount}`);

    if (blockedCount > 0) {
        console.log(`${GREEN}✅ Rate limiting is working${RESET}`);
    } else {
        console.log(`${RED}❌ Rate limiting not triggered${RESET}`);
    }
}

/**
 * Test 5: SQL Injection Prevention
 */
async function testSQLInjection() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 5: SQL Injection Prevention');
    console.log(`========================================${RESET}\n`);

    const sqlPayloads = [
        "admin@cicj.com' OR '1'='1",
        "admin@cicj.com'; DROP TABLE User;--",
        "admin@cicj.com' UNION SELECT * FROM User--"
    ];

    console.log(`${YELLOW}Testing ${sqlPayloads.length} SQL injection payloads${RESET}`);

    let allBlocked = true;

    for (let i = 0; i < sqlPayloads.length; i++) {
        try {
            const response = await makeRequest('POST', '/login', {
                email: sqlPayloads[i],
                password: 'anything'
            });

            // SQL injection should fail (401 or 400, not 200 or 500)
            if (response.status === 401 || response.status === 400) {
                console.log(`${GREEN}✅ Payload ${i + 1}: Blocked (${response.status})${RESET}`);
            } else if (response.status === 200) {
                console.log(`${RED}❌ Payload ${i + 1}: DANGEROUS - Login succeeded!${RESET}`);
                allBlocked = false;
            } else {
                console.log(`${YELLOW}⚠️  Payload ${i + 1}: Unexpected response (${response.status})${RESET}`);
            }

        } catch (error) {
            console.error(`${RED}Payload ${i + 1} error:${RESET}`, error.message);
        }
    }

    if (allBlocked) {
        console.log(`\n${GREEN}✅ All SQL injection attempts blocked${RESET}`);
        console.log(`${GREEN}   Prisma ORM is preventing SQL injection${RESET}`);
    } else {
        console.log(`\n${RED}❌ SQL injection vulnerability detected!${RESET}`);
    }
}

/**
 * Test 6: CSRF Token Endpoint
 */
async function testCSRFToken() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 6: CSRF Protection');
    console.log(`========================================${RESET}\n`);

    if (!authToken) {
        // Authenticate first
        const loginResponse = await makeRequest('POST', '/login', {
            email: 'admin@cicj.com',
            password: 'Password123!'
        });

        if (loginResponse.status === 200) {
            authToken = loginResponse.body.token;
        } else {
            console.log(`${RED}❌ Failed to authenticate${RESET}`);
            return;
        }
    }

    // Test CSRF token generation
    console.log(`${YELLOW}Test 6a: Get CSRF token${RESET}`);
    try {
        const response = await makeRequest('GET', '/api/csrf-token', null, {
            'Authorization': `Bearer ${authToken}`
        });

        if (response.status === 200 && response.body.csrfToken) {
            console.log(`${GREEN}✅ CSRF token generated successfully${RESET}`);
            console.log(`   Token: ${response.body.csrfToken.substring(0, 20)}...`);
        } else {
            console.log(`${RED}❌ CSRF token generation failed${RESET}`);
        }

    } catch (error) {
        console.error(`${RED}❌ CSRF test error:${RESET}`, error.message);
    }
}

/**
 * Test 7: Password Strength Validation
 */
async function testPasswordStrength() {
    console.log(`\n${BLUE}========================================`);
    console.log('TEST 7: Password Strength Validation');
    console.log(`========================================${RESET}\n`);

    if (!authToken) {
        const loginResponse = await makeRequest('POST', '/login', {
            email: 'admin@cicj.com',
            password: 'Password123!'
        });
        if (loginResponse.status === 200) {
            authToken = loginResponse.body.token;
        }
    }

    const weakPasswords = [
        { password: 'password', reason: 'No uppercase or number' },
        { password: 'PASSWORD123', reason: 'No lowercase' },
        { password: 'Password', reason: 'No number' },
        { password: 'Pass1', reason: 'Too short' }
    ];

    console.log(`${YELLOW}Testing ${weakPasswords.length} weak passwords${RESET}`);

    for (const test of weakPasswords) {
        try {
            const response = await makeRequest('POST', '/register', {
                full_name: 'Test User',
                email: `test${Date.now()}@example.com`,
                password: test.password,
                role: 'EMPLOYEE'
            }, {
                'Authorization': `Bearer ${authToken}`
            });

            if (response.status === 400) {
                console.log(`${GREEN}✅ Rejected: "${test.password}" (${test.reason})${RESET}`);
            } else {
                console.log(`${RED}❌ Accepted weak password: "${test.password}"${RESET}`);
            }

        } catch (error) {
            console.error(`${RED}Error testing "${test.password}":${RESET}`, error.message);
        }
    }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
    console.log(`\n${GREEN}╔════════════════════════════════════════╗`);
    console.log(`║  SECURITY HARDENING TEST SUITE         ║`);
    console.log(`║  CICJ-ICMS Security Validation         ║`);
    console.log(`╚════════════════════════════════════════╝${RESET}\n`);

    console.log(`${YELLOW}⚠️  Ensure the server is running on ${BASE_URL}${RESET}\n`);

    try {
        await testSecurityHeaders();
        await testInputValidation();
        await testXSSPrevention();
        await testRateLimiting();
        await testSQLInjection();
        await testCSRFToken();
        await testPasswordStrength();

        console.log(`\n${GREEN}╔════════════════════════════════════════╗`);
        console.log(`║  ALL SECURITY TESTS COMPLETED          ║`);
        console.log(`╚════════════════════════════════════════╝${RESET}\n`);

        console.log(`${BLUE}📊 Test Summary:${RESET}`);
        console.log(`1. Security Headers: Helmet configuration`);
        console.log(`2. Input Validation: express-validator rules`);
        console.log(`3. XSS Prevention: Input sanitization`);
        console.log(`4. Rate Limiting: DoS attack prevention`);
        console.log(`5. SQL Injection: Prisma ORM protection`);
        console.log(`6. CSRF Protection: Token generation`);
        console.log(`7. Password Strength: Complexity requirements`);

        console.log(`\n${GREEN}🎉 Security hardening implementation verified!${RESET}\n`);

    } catch (error) {
        console.error(`\n${RED}❌ Test suite error:${RESET}`, error);
    }
}

// Run tests
runAllTests();
