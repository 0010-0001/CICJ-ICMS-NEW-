# 🔐 Multi-Factor Authentication (MFA) Documentation

## Overview
The CICJ-ICMS implements email-based Multi-Factor Authentication (MFA) using One-Time Passwords (OTP) to satisfy Identity and Access Management (IAM) requirements. This adds an additional security layer beyond username/password authentication.

---

## 🎯 MFA Flow

### User Login Journey

```
1. User enters email + password
   ↓
2. Server validates credentials
   ↓
3. If valid, 6-digit OTP generated and sent to email
   ↓
4. User receives email with OTP (valid for 5 minutes)
   ↓
5. User enters 6-digit OTP on login page
   ↓
6. Server validates OTP
   ↓
7. If valid, JWT token issued and user redirected
```

---

## 📦 Implementation Components

### Backend Components

#### 1. **MFA Middleware** (`backend/middleware/mfa.js`)

**Key Functions:**
- `generateOTP()`: Generates secure 6-digit random code
- `sendOTPEmail(email, otp, userName)`: Sends formatted HTML email with OTP
- `generateAndSendOTP(userId, email, userName)`: Combines generation and sending
- `verifyOTP(email, submittedOTP)`: Validates OTP and tracks attempts
- `resendOTP(userId, email, userName)`: Resends OTP with rate limiting
- `clearOTP(email)`: Removes OTP from storage
- `getOTPStatus(email)`: Returns OTP metadata (dev mode only)
- `cleanupExpiredOTPs()`: Periodic cleanup (runs every 5 minutes)

**Configuration:**
```javascript
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 3
```

**Storage:**
- In-memory Map (development)
- Recommendation: Redis for production (distributed systems)

#### 2. **Server Routes** (`backend/server.js`)

**POST /login** - Step 1: Validate credentials, send OTP
```javascript
Request:
{
  "email": "user@cicj.com",
  "password": "SecurePassword123!"
}

Response (200 OK):
{
  "message": "Credentials verified. OTP sent to your email.",
  "mfaRequired": true,
  "email": "user@cicj.com",
  "expiresIn": 300,
  "devMode": false,
  "hint": "Check your email for the 6-digit verification code."
}
```

**POST /verify-otp** - Step 2: Validate OTP, issue JWT
```javascript
Request:
{
  "email": "user@cicj.com",
  "otp": "123456"
}

Response (200 OK):
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "user_id": 1,
    "full_name": "John Doe",
    "email": "user@cicj.com",
    "role": "ADMIN"
  }
}

Response (401 Unauthorized):
{
  "error": "Invalid OTP. 2 attempt(s) remaining.",
  "code": "INVALID_OTP",
  "attemptsLeft": 2
}
```

**POST /resend-otp** - Resend OTP with rate limiting
```javascript
Request:
{
  "email": "user@cicj.com"
}

Response (200 OK):
{
  "message": "New verification code sent to your email.",
  "expiresIn": 300,
  "devMode": false
}

Response (429 Too Many Requests):
{
  "error": "Please wait 45 seconds before requesting a new code.",
  "code": "RATE_LIMITED",
  "waitTime": 45
}
```

**GET /otp-status/:email** - Debug endpoint (dev mode only)
```javascript
Response:
{
  "exists": true,
  "expiresIn": 245,
  "attempts": 1,
  "maxAttempts": 3,
  "isExpired": false
}
```

---

### Frontend Components

#### 1. **OTP Modal** (`index.html`)

HTML structure with 6 individual OTP input boxes:
```html
<div id="otp-modal" class="modal hidden">
    <div class="modal-content otp-modal-content">
        <h3>🔐 Verify Your Identity</h3>
        <input type="text" id="otp-1" class="otp-digit" maxlength="1">
        <input type="text" id="otp-2" class="otp-digit" maxlength="1">
        <!-- ... 4 more inputs ... -->
        <button id="verify-otp-btn">Verify Code</button>
        <button id="resend-otp-btn">Resend Code</button>
    </div>
</div>
```

#### 2. **Login Script** (`js/login.js`)

**Features:**
- Auto-focus next OTP digit on input
- Backspace navigation between inputs
- Paste support (paste 6-digit code)
- Countdown timer (5:00 → 0:00)
- Resend OTP with rate limiting
- Error handling with attempts tracking
- Email masking for privacy (`u***r@domain.com`)

**Key Functions:**
```javascript
showOTPModal(data)          // Display modal with timer
getOTPValue()               // Combine 6 digits
clearOTPInputs()            // Reset form
startCountdown()            // 5-minute timer
maskEmail(email)            // Privacy protection
```

#### 3. **OTP Styles** (`css/login.css`)

**Highlights:**
- Individual digit inputs (50px × 60px)
- Focus animation (scale + shadow)
- Valid state (green border)
- Color-coded timer (green → orange → red)
- Mobile responsive (down to 320px)
- Smooth animations (modal slide-in)

---

## 📧 Email Configuration

### Environment Variables (`.env`)

```env
# SMTP Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password_here

# MFA Settings
MFA_ENABLED=true
OTP_EXPIRY_MINUTES=5
```

### Gmail Setup (Recommended for Development)

1. **Enable 2-Step Verification** in Gmail account
2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Add to `.env`:**
   ```env
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop
   ```

### Other Email Providers

**Outlook/Office365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_ses_smtp_username
SMTP_PASSWORD=your_ses_smtp_password
```

---

## 🧪 Testing

### Running MFA Tests

```bash
cd backend
npm start  # Start server in separate terminal
node test-mfa.js
```

### Test Coverage

1. **Login OTP Generation**: Credentials validated, OTP sent
2. **Valid OTP Verification**: Correct code accepted, JWT issued
3. **Invalid OTP Rejection**: Wrong code rejected, attempts tracked
4. **Resend OTP**: New code sent, rate limiting enforced
5. **OTP Expiration**: Code expires after 5 minutes
6. **Max Attempts**: 3 attempts maximum, then OTP cleared
7. **OTP Status**: Development endpoint for debugging

### Manual Testing (Development Mode)

When email is not configured, OTP is displayed in terminal:

```
==================================================
📧 OTP for admin@cicj.com: 123456
   Valid for 5 minutes
==================================================
```

Copy the OTP and paste into the login modal.

---

## 🔒 Security Features

### 1. **OTP Generation**
- **Cryptographically secure**: `crypto.randomInt(100000, 999999)`
- **Uniqueness**: New OTP per login attempt
- **No patterns**: Random distribution across range

### 2. **OTP Storage**
- **Encrypted in transit**: HTTPS (production)
- **Time-limited**: 5-minute expiration
- **User-specific**: Mapped to email address
- **Auto-cleanup**: Expired OTPs deleted every 5 minutes

### 3. **Attempt Limiting**
- **Maximum 3 attempts** per OTP
- **Progressive lockout**: OTP cleared after max attempts
- **Attempt tracking**: Counter incremented per failed attempt

### 4. **Rate Limiting**
- **Resend cooldown**: 60 seconds between resend requests
- **Prevents abuse**: Blocks rapid OTP generation
- **User-friendly**: Shows countdown to user

### 5. **Email Security**
- **HTML injection prevention**: Email templates validated
- **No sensitive data**: Password never included in email
- **Clear expiration**: User notified of 5-minute limit

### 6. **Session Management**
- **OTP cleared after use**: Single-use codes only
- **No persistent storage**: OTP deleted after verification
- **JWT issued only after MFA**: Two-factor requirement enforced

---

## 🎨 Email Template

The OTP email includes:

- **Professional header**: CICJ-ICMS branding
- **Large OTP display**: 48px, monospace, white text on blue gradient
- **Clear expiration**: 5-minute timer displayed
- **Security warnings**: Don't share code, contact admin if suspicious
- **Responsive design**: Mobile-friendly HTML

**Preview:**

```
╔══════════════════════════════════════════╗
║        🔐 Login Verification             ║
║      CICJ-ICMS Security System           ║
╠══════════════════════════════════════════╣
║                                          ║
║  Hello John Doe,                         ║
║                                          ║
║  Your Verification Code:                 ║
║                                          ║
║        ┌─────────────┐                   ║
║        │   1 2 3 4 5 6   │               ║
║        └─────────────┘                   ║
║                                          ║
║  Valid for 5 minutes                     ║
║                                          ║
║  ⚠️ Security Notice:                     ║
║  • Do not share this code                ║
║  • Contact admin if you didn't log in    ║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## 📊 OTP Lifecycle

```
┌─────────────────────────────────────────────────┐
│ 1. USER REQUESTS LOGIN                          │
│    • Email + Password submitted                 │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 2. SERVER VALIDATES CREDENTIALS                 │
│    • bcrypt password check                      │
│    • User active status check                   │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 3. OTP GENERATION                               │
│    • crypto.randomInt(100000, 999999)           │
│    • Stored in Map with 5-min expiry            │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 4. EMAIL SENT                                   │
│    • Nodemailer SMTP                            │
│    • HTML template with OTP                     │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 5. USER ENTERS OTP                              │
│    • 6 individual digit inputs                  │
│    • Auto-focus, paste support                  │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 6. OTP VERIFICATION                             │
│    • Compare submitted vs stored                │
│    • Check expiration                           │
│    • Track attempts (max 3)                     │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 7. JWT TOKEN ISSUED                             │
│    • user_id + role in payload                  │
│    • 1-day expiration                           │
│    • Stored in localStorage                     │
└──────────────┬──────────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────┐
│ 8. USER REDIRECTED                              │
│    • Admin → admin.html                         │
│    • Employee → employee.html                   │
└─────────────────────────────────────────────────┘
```

---

## 🚨 Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `OTP_NOT_FOUND` | No OTP exists for email | 401 |
| `OTP_EXPIRED` | OTP expired (>5 minutes) | 401 |
| `INVALID_OTP` | Submitted OTP doesn't match | 401 |
| `MAX_ATTEMPTS_EXCEEDED` | 3 failed attempts | 401 |
| `RATE_LIMITED` | Resend too soon (<60 sec) | 429 |

---

## 🔧 Troubleshooting

### Email Not Sending

**Problem**: OTP email not received

**Solutions:**
1. Check SMTP credentials in `.env`
2. Gmail: Use App Password, not regular password
3. Check spam/junk folder
4. Enable "Less secure app access" (Gmail legacy)
5. Check firewall/antivirus blocking port 587
6. Test SMTP connection:
   ```bash
   node -e "require('./backend/middleware/mfa').sendOTPEmail('test@example.com', '123456', 'Test User')"
   ```

### OTP Always Expires

**Problem**: OTP expires immediately

**Solution:**
- Check server time is correct
- Verify `OTP_EXPIRY_MINUTES` in `.env`
- Check for clock drift in Docker containers

### Rate Limit Too Strict

**Problem**: Can't resend OTP

**Solution:**
- Wait 60 seconds between resend attempts
- Adjust rate limit in `backend/middleware/mfa.js`:
  ```javascript
  if (existingOTP && (Date.now() - existingOTP.createdAt) < 30000) {
      // Changed from 60000 to 30000 (30 seconds)
  }
  ```

### Dev Mode OTP Not Showing

**Problem**: Can't see OTP in terminal

**Solution:**
- Ensure `NODE_ENV !== 'production'` in `.env`
- Check backend terminal console output
- Look for `📧 OTP for ...` message

---

## 🚀 Production Deployment

### Pre-Deployment Checklist

- [ ] Set up production email service (SendGrid, AWS SES, etc.)
- [ ] Configure SMTP credentials in production environment
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Enable HTTPS (OTP sent over encrypted connection)
- [ ] Implement Redis for OTP storage (distributed systems)
- [ ] Configure email delivery monitoring
- [ ] Set up OTP delivery failure alerts
- [ ] Test email deliverability across providers (Gmail, Outlook, etc.)
- [ ] Customize email template with company branding
- [ ] Configure SPF, DKIM, DMARC records for email domain
- [ ] Enable email rate limiting (prevent abuse)
- [ ] Set up audit logging for MFA events

### Redis Integration (Recommended for Production)

Replace in-memory Map with Redis:

```javascript
// backend/middleware/mfa.js
const redis = require('redis');
const client = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

// Store OTP
await client.setex(`otp:${email}`, OTP_EXPIRY_MINUTES * 60, JSON.stringify(otpData));

// Retrieve OTP
const otpData = JSON.parse(await client.get(`otp:${email}`));

// Delete OTP
await client.del(`otp:${email}`);
```

**Benefits:**
- Persistent storage
- Distributed systems support
- Automatic expiration (TTL)
- Better performance at scale

---

## 📈 Metrics & Monitoring

### Key Metrics to Track

1. **OTP Delivery Rate**: % of OTPs successfully sent
2. **OTP Success Rate**: % of OTPs verified on first attempt
3. **Average Verification Time**: Time from OTP sent to verified
4. **Resend Frequency**: How often users resend OTPs
5. **Max Attempts Rate**: % of users hitting 3-attempt limit
6. **Expiration Rate**: % of OTPs expiring before use

### Audit Logging

MFA events are logged to `System_Health_Log`:

```javascript
await prisma.system_Health_Log.create({
    data: {
        event_type: 'MFA_LOGIN_SUCCESS',
        description: `User ${user.full_name} logged in successfully with MFA`,
        status: 'Success'
    }
});
```

**Event Types:**
- `MFA_LOGIN_SUCCESS`: OTP verified, JWT issued
- `MFA_OTP_SENT`: OTP generated and sent
- `MFA_OTP_FAILED`: Invalid OTP submitted
- `MFA_MAX_ATTEMPTS`: User exceeded 3 attempts
- `MFA_OTP_RESENT`: New OTP requested

---

## 🔗 Integration Points

### 1. **Authentication Middleware**
- MFA integrated with existing JWT auth
- No changes needed to protected routes
- JWT still required for API access

### 2. **User Management**
- All users automatically enrolled in MFA
- No opt-out (security requirement)
- Admin can disable MFA per user (future feature)

### 3. **Security Hardening**
- Works with rate limiting (separate limits)
- Compatible with CSRF protection
- Helmet security headers still applied

---

## 📞 Support & Resources

- **Nodemailer Documentation**: https://nodemailer.com/
- **Email Testing**: https://mailtrap.io/ (development)
- **Email Templates**: https://email.foundations.com/
- **TOTP Alternative**: Consider Google Authenticator for mobile app MFA

---

**Last Updated**: March 8, 2026  
**MFA Version**: 1.0.0  
**Maintained By**: CICJ Development Team
