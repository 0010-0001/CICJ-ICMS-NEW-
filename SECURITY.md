# 🔒 Security Hardening Documentation

## Overview
This document describes the comprehensive security measures implemented in the CICJ-SH-COMS (CICJ Secure Hybrid Construction Management System).

---

## 🛡️ Security Features Implemented

### 1. Input Validation (Frontend & Backend)

#### Frontend Validation (`js/validation.js`)
- **Email Validation**: RFC-compliant email format validation
- **Password Strength**: Minimum 8 characters, requires uppercase, lowercase, and number
- **Name Validation**: Alphanumeric with spaces, hyphens, and periods only
- **Phone Validation**: International phone format support
- **XSS Detection**: Blocks `<script>`, `<iframe>`, `javascript:`, event handlers
- **SQL Injection Detection**: Blocks SQL keywords and patterns
- **Real-time Validation**: Validates fields on blur events
- **Visual Feedback**: Error messages displayed inline

#### Backend Validation (`backend/middleware/security.js`)
Uses `express-validator` library for robust server-side validation:

**User Registration Validation:**
```javascript
- full_name: 2-100 characters, letters/spaces/hyphens/periods only
- email: Valid email format, normalized, max 255 characters
- password: 8-128 characters, uppercase + lowercase + number required
- contact_number: Phone format validation (optional)
- role: Must be ADMIN or EMPLOYEE
```

**Login Validation:**
```javascript
- email: Valid email format
- password: Required, 8-128 characters
```

**Equipment Validation:**
```javascript
- name: 2-100 characters, alphanumeric
- quantity: Positive integer (0-100,000)
- condition: Excellent, Good, Fair, Poor, Broken
- status: Available, In Use, Maintenance, Retired
```

**File Upload Validation:**
```javascript
- file_name: Valid filename characters only
- file_size: Max 100MB
- file_type: Length validation
```

**Client Inquiry Validation:**
```javascript
- client_name: 2-100 characters, letters only
- client_email: Valid email format
- subject: 3-200 characters
- message: 10-5000 characters
- status: Pending, In Progress, Resolved, Closed
```

---

### 2. XSS (Cross-Site Scripting) Prevention

#### Sanitization Middleware
All incoming data is automatically sanitized using the `xss` library:

```javascript
// backend/middleware/security.js
const sanitizeInput = (req, res, next) => {
    // Sanitizes req.body, req.query, req.params
    // Removes: <script>, <iframe>, javascript:, event handlers
}
```

**Applied globally to all routes:**
```javascript
app.use(sanitizeInput); // Runs before all route handlers
```

**Protection Against:**
- Script injection: `<script>alert('XSS')</script>`
- Event handlers: `<img onerror="alert('XSS')">`
- JavaScript protocol: `<a href="javascript:alert('XSS')">`
- SVG attacks: `<svg onload="alert('XSS')">`
- iFrame injection: `<iframe src="evil.com">`

---

### 3. SQL Injection Prevention

#### Prisma ORM
All database queries use **Prisma ORM**, which automatically:
- Parameterizes all queries
- Escapes special characters
- Prevents raw SQL injection

**Example (Safe):**
```javascript
// ✅ SAFE - Parameterized query
const user = await prisma.user.findUnique({ 
    where: { email } 
});

// ❌ NEVER use raw SQL with user input
// prisma.$queryRaw`SELECT * FROM User WHERE email = '${email}'`
```

**Protection Against:**
- Union attacks: `' UNION SELECT * FROM User--`
- Tautology attacks: `' OR '1'='1`
- Comment injection: `'; DROP TABLE User;--`
- Blind SQL injection: `' AND SLEEP(5)--`

---

### 4. CSRF (Cross-Site Request Forgery) Protection

#### Custom CSRF Implementation
Located in `backend/middleware/security.js`:

**Token Generation:**
```javascript
GET /api/csrf-token (authenticated)
Response: { csrfToken: "64-character-hex" }
```

**Token Validation:**
```javascript
// All non-GET requests require CSRF token
Headers: { 'X-CSRF-Token': 'your-token-here' }
// OR
Body: { _csrf: 'your-token-here' }
```

**Features:**
- 1-hour token expiration
- User-specific tokens
- In-memory token store (use Redis in production)
- Auto-validates on POST/PUT/DELETE/PATCH requests

**Usage Example:**
```javascript
// Frontend
const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'X-CSRF-Token': csrfToken, // Include CSRF token
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
});
```

---

### 5. Security Headers (Helmet)

#### Helmet Configuration
Located in `backend/server.js`:

**Headers Applied:**

1. **Content-Security-Policy (CSP)**
   - Default: `'self'` only
   - Scripts: Same-origin only
   - Styles: Same-origin + inline (for CSS)
   - Images: Self + data URIs + HTTPS
   - Frames: Blocked (`'none'`)
   - Objects: Blocked (`'none'`)

2. **X-Frame-Options**
   - Value: `DENY`
   - Prevents: Clickjacking attacks

3. **X-Content-Type-Options**
   - Value: `nosniff`
   - Prevents: MIME type sniffing

4. **Strict-Transport-Security (HSTS)**
   - Max-Age: 1 year (31,536,000 seconds)
   - IncludeSubDomains: true
   - Preload: true
   - Enforces: HTTPS only

5. **X-XSS-Protection**
   - Enabled by default (legacy browsers)

**Test Endpoint:**
```
GET /api/security/headers
```

---

### 6. Rate Limiting (DoS Protection)

#### Express Rate Limit Configuration
Located in `backend/server.js`:

**General API Rate Limit:**
```javascript
Window: 15 minutes
Max Requests: 100 per IP
Message: "Too many requests from this IP, please try again later."
```

**Authentication Rate Limit (Stricter):**
```javascript
Window: 15 minutes
Max Requests: 10 per IP
Routes: /login, /register
Message: "Too many login attempts, please try again later."
```

**Protection Against:**
- Brute force attacks
- Credential stuffing
- DDoS attacks
- Account enumeration

**Headers Sent:**
```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1234567890
```

---

### 7. HTTPS Enforcement

#### Production Redirect
Located in `backend/server.js`:

```javascript
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}
```

**Features:**
- Automatic HTTP → HTTPS redirect
- Only active in production (`NODE_ENV=production`)
- Works with reverse proxies (Nginx, PaaS platforms)

**Environment Variables:**
```env
NODE_ENV=production
ENFORCE_HTTPS=true
```

---

## 🧪 Security Testing

### Running Security Tests
```bash
cd backend
npm start  # Start server in separate terminal
node test-security.js
```

### Tests Included
1. **Security Headers Test**: Validates Helmet configuration
2. **Input Validation Test**: Invalid email, short password, missing fields
3. **XSS Prevention Test**: Script injection attempts
4. **Rate Limiting Test**: 15 rapid requests (expects blocking)
5. **SQL Injection Test**: Common SQL injection payloads
6. **CSRF Token Test**: Token generation and validation
7. **Password Strength Test**: Weak password rejection

---

## 📋 Security Checklist

### Before Production Deployment

- [ ] Change `JWT_SECRET` to strong random value (32+ characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `FRONTEND_URL` to actual domain (remove `*`)
- [ ] Enable HTTPS (Let's Encrypt, CloudFlare, PaaS SSL)
- [ ] Set `ENFORCE_HTTPS=true`
- [ ] Review CORS origins (restrict to specific domains)
- [ ] Implement Redis for CSRF token storage (replace in-memory)
- [ ] Enable database connection encryption (SSL/TLS)
- [ ] Set up rate limit storage (Redis) for distributed systems
- [ ] Configure logging (Winston, Morgan) for security events
- [ ] Enable API request logging
- [ ] Set up security monitoring (e.g., Sentry, LogRocket)
- [ ] Configure backup strategy for database
- [ ] Implement audit logging for sensitive operations
- [ ] Review and update CSP directives for your CDN/assets
- [ ] Test security features with automated tools (OWASP ZAP)

---

## 🚨 Common Security Threats Mitigated

| Threat | Mitigation | Implementation |
|--------|------------|----------------|
| **XSS** | Input sanitization | `xss` library + `sanitizeInput` middleware |
| **SQL Injection** | Parameterized queries | Prisma ORM |
| **CSRF** | Token validation | Custom CSRF middleware |
| **Clickjacking** | X-Frame-Options | Helmet (DENY) |
| **MIME Sniffing** | X-Content-Type-Options | Helmet (nosniff) |
| **Brute Force** | Rate limiting | express-rate-limit |
| **Session Hijacking** | JWT expiration | 1-day token expiration |
| **Man-in-the-Middle** | HTTPS enforcement | HSTS + redirect |
| **DoS/DDoS** | Rate limiting | IP-based limits |
| **Weak Passwords** | Complexity requirements | express-validator + bcrypt |

---

## 📚 Security Best Practices

### Password Security
- **Hashing**: bcrypt with 10 salt rounds
- **Storage**: Only hashed passwords in database
- **Transmission**: HTTPS only (never in logs)
- **Requirements**: Min 8 chars, uppercase, lowercase, number

### JWT Token Security
- **Expiration**: 1 day (configurable)
- **Storage**: Client-side (localStorage or httpOnly cookies)
- **Verification**: Every protected route
- **Signature**: HMAC SHA-256 with secret key

### Database Security
- **ORM**: Prisma (prevents SQL injection)
- **Connections**: Encrypted (configure in production)
- **Credentials**: Environment variables only
- **Backups**: Regular automated backups

### API Security
- **Authentication**: JWT Bearer tokens
- **Authorization**: Granular permission system (30 flags)
- **Rate Limiting**: Per-IP and per-route
- **Input Validation**: Frontend + Backend double validation
- **Error Messages**: Generic (don't leak sensitive info)

---

## 🔧 Configuration Files

### Environment Variables (`.env`)
```env
# Security
JWT_SECRET="your-strong-secret-here"
NODE_ENV="production"
FRONTEND_URL="https://yourdomain.com"
ENFORCE_HTTPS="true"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=10
```

### Security Middleware Order
```javascript
1. Helmet (security headers)
2. CORS (cross-origin policy)
3. Rate limiting (DoS protection)
4. Body parser (with size limit)
5. XSS sanitization (input cleaning)
6. HTTPS redirect (production only)
7. Route handlers
8. Error handler
```

---

## 🆘 Security Incident Response

### If XSS Attack Detected
1. Check `sanitizeInput` middleware is active
2. Review frontend validation in `js/validation.js`
3. Audit user-generated content in database
4. Update CSP headers if scripts from external sources

### If Rate Limit Bypassed
1. Check IP forwarding headers (`x-forwarded-for`)
2. Consider implementing Redis for distributed rate limiting
3. Lower `max` value or shorten `windowMs`
4. Add CAPTCHA for authentication routes

### If SQL Injection Suspected
1. Verify all queries use Prisma ORM (NOT raw SQL)
2. Check for `$queryRaw` usage (should be avoided)
3. Review database logs for unusual queries
4. Audit all custom database queries

---

## 📞 Support & Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Helmet Documentation**: https://helmetjs.github.io/
- **Express Validator**: https://express-validator.github.io/
- **Prisma Security**: https://www.prisma.io/docs/concepts/components/prisma-client/deployment#security

---

**Last Updated**: 2026-01-19  
**Security Audit**: Required every 6 months  
**Maintained By**: CICJ Development Team
