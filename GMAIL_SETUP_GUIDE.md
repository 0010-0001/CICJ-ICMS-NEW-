# 📧 Gmail Configuration Guide for OTP Email System

## Overview
This guide explains how to configure Gmail to send OTP (One-Time Password) verification emails for the CICJ-SH-COMS MFA system.

---

## ⚠️ Important: App Passwords Required

**You CANNOT use your regular Gmail password for SMTP authentication.**

Gmail requires **App Passwords** for third-party applications. This is a security feature that protects your main account.

---

## 🔧 Setup Instructions

### Step 1: Enable 2-Factor Authentication on Your Gmail Account

1. **Go to** [Google Account Security](https://myaccount.google.com/security)
2. **Scroll to** "How you sign in to Google"
3. **Click** "2-Step Verification"
4. **Follow the prompts** to enable 2FA using your phone

**You MUST enable 2FA before you can create App Passwords.**

---

### Step 2: Generate an App Password

1. **Go to** [App Passwords](https://myaccount.google.com/apppasswords)
   - Or navigate: Google Account → Security → 2-Step Verification → App Passwords

2. **Sign in** if prompted

3. **Click** "Select app" dropdown
   - Choose **"Mail"** or **"Other (Custom name)"**
   - If using custom: enter **"CICJ-SH-COMS Backend"**

4. **Click** "Select device" dropdown
   - Choose **"Other (Custom name)"**
   - Enter: **"CICJ Server"** or **"Backend API"**

5. **Click "Generate"**

6. **Copy the 16-character App Password**
   - Format: `xxxx xxxx xxxx xxxx` (remove spaces when copying)
   - Example: `abcd efgh ijkl mnop` → use as `abcdefghijklmnop`

7. **IMPORTANT**: Save this password - you won't see it again!

---

### Step 3: Update Backend Environment Variables

1. **Open** `backend/.env` file

2. **Update** the following variables with your Gmail credentials:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=abcdefghijklmnop

# MFA Settings
MFA_ENABLED=true
OTP_EXPIRY_MINUTES=5
```

**Example with real values:**
```env
SMTP_USER=cicj.system@gmail.com
SMTP_PASSWORD=xmpl abcd efgh ijkl  # Remove spaces: xmplabcdefghijkl
```

3. **Save the file** and **restart the backend server**

---

## ✅ Testing the Configuration

### Method 1: Test via Login Flow

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Open the login page:**
   ```
   http://localhost:5000/index.html
   ```

3. **Attempt to login** with valid credentials

4. **Check your email inbox** for the OTP code

5. **Enter the 6-digit OTP** on the verification screen

**Expected Outcome**: You should receive an email within 10-30 seconds.

---

### Method 2: Check Server Logs

When email is **properly configured**, you'll see:
```
✅ Email transporter initialized successfully
✅ OTP email sent to user@example.com: <message-id>
```

When email is **NOT configured** (dev mode), you'll see:
```
⚠️  Email not configured. OTP would be: 123456
==================================================
📧 OTP for user@example.com: 654321
   Valid for 5 minutes
==================================================
```

---

## 🔒 Security Best Practices

### 1. Use a Dedicated Gmail Account

**DO NOT** use your personal Gmail account for the SMTP server.

**Create a new Gmail account** specifically for system emails:
- Example: `cicj.alerts@gmail.com` or `noreply.cicj@gmail.com`
- This isolates system email from personal email
- Easier to revoke access if compromised

### 2. Restrict App Password Scope

- App Passwords are **account-specific**, not application-specific
- If the backend is compromised, **revoke the App Password immediately**
- Generate a **new App Password** for each deployment environment:
  - Development: One App Password
  - Staging: Different App Password
  - Production: Different App Password

### 3. Never Commit Credentials to Git

The `.env` file is already in `.gitignore`, but double-check:

```bash
# Verify .env is ignored
git status
# Should NOT show .env file

# If it does, add to .gitignore:
echo "backend/.env" >> .gitignore
```

### 4. Use Environment Variables in Production

For production deployments (Render, Heroku, Railway, etc.):

1. **DO NOT** commit `.env` file
2. **Set environment variables** in the hosting platform's dashboard
3. **Use secrets management** if available (e.g., AWS Secrets Manager, Railway Secrets)

---

## 🛠️ Troubleshooting

### Issue 1: "Invalid login: 535-5.7.8 Username and Password not accepted"

**Cause**: Using regular Gmail password instead of App Password

**Solution**:
1. Generate a new App Password (see Step 2 above)
2. Copy the 16-character code (remove spaces)
3. Update `SMTP_PASSWORD` in `.env`
4. Restart the server

---

### Issue 2: "Connection timeout" or "ECONNREFUSED"

**Cause**: Firewall blocking SMTP port 587

**Solutions**:
- **Check firewall settings** (Windows Defender, antivirus)
- **Try port 465** with `SMTP_SECURE=true`:
  ```env
  SMTP_PORT=465
  SMTP_SECURE=true
  ```
- **Allow Node.js** through firewall
- **Check corporate network** - some networks block SMTP ports

---

### Issue 3: Email not arriving in inbox

**Possible Causes**:
1. **Spam folder** - Check spam/junk folder
2. **Gmail filters** - Emails may be auto-archived
3. **Incorrect recipient email** - Verify email in database

**Solutions**:
1. **Add SMTP email to contacts** to improve deliverability
2. **Check Gmail Sent folder** of the SMTP account
3. **Review server logs** for `messageId` confirmation

---

### Issue 4: "Too many login attempts" or rate limiting

**Cause**: Gmail has sending limits:
- Free accounts: ~500 emails/day
- Google Workspace: ~2000 emails/day

**Solutions**:
1. **Monitor usage** to stay within limits
2. **Upgrade to Google Workspace** for higher limits
3. **Use transactional email service** for production:
   - SendGrid (100 emails/day free)
   - Mailgun (5000 emails/month free)
   - Amazon SES (62,000 emails/month free)

---

## 🌐 Alternative Email Providers

If Gmail doesn't work, consider these alternatives:

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-outlook-password
```

### SendGrid (Recommended for Production)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
```

---

## 📊 Email Template Customization

The OTP email template is defined in: `backend/middleware/mfa.js`

To customize the email design, edit the HTML template in the `sendOTPEmail` function:
```javascript
// Line ~84 in mfa.js
const mailOptions = {
    from: `"CICJ-SH-COMS Security" <${process.env.SMTP_USER}>`,
    subject: '🔐 Your Login Verification Code - CICJ-SH-COMS',
    html: `...` // Edit this HTML
};
```

**Current template includes**:
- Professional branded header
- Large, readable OTP code
- Expiration warning
- Security tips
- Responsive design (mobile-friendly)

---

## 🧪 Development Mode (No Email)

If you don't want to configure email during development:

1. **Leave SMTP credentials blank** in `.env`:
   ```env
   SMTP_USER=
   SMTP_PASSWORD=
   ```

2. **OTP will be printed to terminal** instead:
   ```
   ==================================================
   📧 OTP for test@example.com: 654321
      Valid for 5 minutes
   ==================================================
   ```

3. **Copy the OTP** from terminal and paste into login screen

This is **ONLY for development**. Production MUST use real email.

---

## ✅ Verification Checklist

- [ ] 2FA enabled on Gmail account
- [ ] App Password generated (16 characters)
- [ ] `SMTP_USER` set to Gmail address
- [ ] `SMTP_PASSWORD` set to App Password (no spaces)
- [ ] Backend server restarted after changes
- [ ] Test email received in inbox (or spam)
- [ ] OTP works for login verification
- [ ] `.env` file NOT committed to Git
- [ ] Production uses environment variables

---

## 📞 Support

If you encounter issues not covered in this guide:

1. **Check server logs** for specific error messages
2. **Review Gmail security settings** (App Passwords section)
3. **Test SMTP connection** with a tool like [smtper.net](https://www.smtper.net/)
4. **Try a different email provider** (Outlook, SendGrid)

---

**Task 3 (MFA) Complete** once email is configured! ✅
