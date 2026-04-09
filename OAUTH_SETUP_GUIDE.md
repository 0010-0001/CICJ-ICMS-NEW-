# OAuth Single Sign-On Setup Guide

## Overview
This guide explains how to configure Google Workspace and Microsoft Azure AD OAuth for the CICJ-SH-COMS system.

---

## ✅ Implementation Complete

### What's Been Implemented:
- ✅ **Google OAuth 2.0 Strategy** - Passport.js integration
- ✅ **Microsoft Azure AD Strategy** - Passport.js integration
- ✅ **OAuth Callback Routes** - `/oauth/google/callback` and `/oauth/microsoft/callback`
- ✅ **Auto User Creation** - New users created on first OAuth login
- ✅ **JWT Token Generation** - Seamless authentication after OAuth
- ✅ **Audit Logging** - OAuth logins tracked in System_Health_Log table
- ✅ **Frontend Integration** - SSO buttons redirect to backend OAuth routes

### Backend Files Modified:
- `backend/server.js` - Added passport strategies and OAuth routes
- `backend/.env.example` - Added OAuth environment variables
- `js/login.js` - SSO buttons now redirect to `/oauth/google` and `/oauth/microsoft`

---

## 🔑 Google Workspace OAuth Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"** or select existing project
3. Name: `CICJ-SH-COMS-OAuth` (or any name)
4. Click **Create**

### Step 2: Enable Google+ API
1. Navigate to **APIs & Services > Library**
2. Search for **"Google+ API"**
3. Click **Enable**

### Step 3: Create OAuth Credentials
1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth client ID**
3. Application type: **Web application**
4. Name: `CICJ-SH-COMS Web Client`
5. **Authorized JavaScript origins**:
   ```
   http://localhost:5000
   https://yourdomain.com
   ```
6. **Authorized redirect URIs**:
   ```
   http://localhost:5000/oauth/google/callback
   https://yourdomain.com/oauth/google/callback
   ```
7. Click **Create**
8. **Copy the Client ID and Client Secret**

### Step 4: Configure Consent Screen
1. Go to **OAuth consent screen**
2. User Type: **Internal** (for Google Workspace) or **External** (for public)
3. App name: `CICJ-SH-COMS`
4. User support email: `your-email@company.com`
5. Add scopes:
   - `openid`
   - `email`
   - `profile`
6. Save and Continue

### Step 5: Update Environment Variables
In `backend/.env`:
```bash
GOOGLE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcdefghijklmnop"
GOOGLE_CALLBACK_URL="http://localhost:5000/oauth/google/callback"
```

**Production**: Replace `localhost:5000` with your production domain.

---

## 🔷 Microsoft Azure AD OAuth Setup

### Step 1: Register Application in Azure AD
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **+ New registration**
4. Name: `CICJ-SH-COMS`
5. Supported account types:
   - **Accounts in this organizational directory only** (single tenant)
   - OR **Accounts in any organizational directory** (multi-tenant)
6. Redirect URI:
   - Platform: **Web**
   - URL: `http://localhost:5000/oauth/microsoft/callback`
7. Click **Register**

### Step 2: Copy Application IDs
1. On the Overview page, copy:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### Step 3: Create Client Secret
1. Go to **Certificates & secrets**
2. Click **+ New client secret**
3. Description: `CICJ-SH-COMS Backend`
4. Expires: **24 months** (recommended)
5. Click **Add**
6. **Copy the secret Value immediately** (it won't be shown again)

### Step 4: Configure API Permissions
1. Go to **API permissions**
2. Default permissions should include:
   - Microsoft Graph > `User.Read` (Delegated)
   - Microsoft Graph > `openid` (Delegated)
   - Microsoft Graph > `email` (Delegated)
   - Microsoft Graph > `profile` (Delegated)
3. If missing, click **+ Add a permission > Microsoft Graph > Delegated permissions**
4. Click **Grant admin consent** (if you're a tenant admin)

### Step 5: Update Environment Variables
In `backend/.env`:
```bash
MICROSOFT_CLIENT_ID="12345678-1234-1234-1234-123456789abc"
MICROSOFT_CLIENT_SECRET="secret~value~here"
MICROSOFT_TENANT_ID="common"  # or your specific tenant ID for single-tenant
MICROSOFT_CALLBACK_URL="http://localhost:5000/oauth/microsoft/callback"
```

**Production**: Replace `localhost:5000` with your production domain.

---

## 🧪 Testing OAuth Integration

### 1. Start the Backend Server
```bash
cd backend
npm start
```

### 2. Open the Login Page
Navigate to: `http://localhost:5000/index.html`

### 3. Test Google OAuth
1. Click **"Sign in with Google Workspace"**
2. You should be redirected to Google login
3. Select your account
4. Grant permissions
5. You should be redirected back to:
   - `admin.html` (if your email has ADMIN role in database)
   - `employee.html` (for new OAuth users)

### 4. Test Microsoft OAuth
1. Click **"Sign in with Microsoft"**
2. You should be redirected to Microsoft login
3. Enter your Microsoft/Azure AD credentials
4. Grant permissions
5. You should be redirected back to the appropriate dashboard

---

## 🔒 Security Best Practices

### 1. Use HTTPS in Production
OAuth requires HTTPS for production. Update your `.env`:
```bash
ENFORCE_HTTPS=true
GOOGLE_CALLBACK_URL="https://yourdomain.com/oauth/google/callback"
MICROSOFT_CALLBACK_URL="https://yourdomain.com/oauth/microsoft/callback"
```

### 2. Restrict CORS Origins
Update `FRONTEND_URL` in `.env`:
```bash
FRONTEND_URL="https://yourdomain.com"
```

### 3. Rotate Secrets Regularly
- Regenerate Google Client Secret every 6-12 months
- Regenerate Microsoft Client Secret before expiration

### 4. Monitor OAuth Logins
Check System_Health_Log table for OAuth events:
```sql
SELECT * FROM System_Health_Log 
WHERE event_type IN ('GOOGLE_OAUTH_LOGIN', 'MICROSOFT_OAUTH_LOGIN', 'OAUTH_USER_CREATED')
ORDER BY timestamp DESC;
```

---

## 🔍 Troubleshooting

### Error: "redirect_uri_mismatch"
**Cause**: Callback URL doesn't match registered URL.

**Solution**:
1. Check `.env` callback URLs match exactly with:
   - Google Cloud Console > Credentials > Authorized redirect URIs
   - Azure Portal > App registrations > Redirect URIs
2. Include protocol (`http://` or `https://`)
3. Don't include trailing slashes

### Error: "invalid_client"
**Cause**: Client ID or Secret is incorrect.

**Solution**:
1. Verify `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` in `.env`
2. Regenerate secrets if needed
3. Ensure no extra spaces in `.env` values

### Error: "User account is deactivated"
**Cause**: User's `is_active` field is false in database.

**Solution**:
```sql
UPDATE Users SET is_active = true WHERE email = 'user@example.com';
```

### OAuth Creates New User Instead of Using Existing
**Cause**: Email mismatch between OAuth provider and database.

**Solution**:
1. Check email case sensitivity
2. Verify email in Google/Microsoft profile matches database exactly
3. OAuth users are matched by email (case-sensitive)

### Passport Strategy Not Loaded
**Cause**: Missing environment variables.

**Solution**:
Check that ALL OAuth variables are set in `.env`:
```bash
# Google (all 3 required)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL

# Microsoft (all 4 required)
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID
MICROSOFT_CALLBACK_URL
```

If variables are missing, passport strategies won't initialize (this is intentional for development environments).

---

## 📋 OAuth User Flow

### First-Time Users:
1. User clicks SSO button on login page
2. Redirected to Google/Microsoft login
3. User grants permissions
4. OAuth provider redirects to `/oauth/{provider}/callback`
5. Backend creates new user in database with:
   - Email from OAuth profile
   - Full name from OAuth profile
   - Role: `EMPLOYEE` (default)
   - Random password (OAuth users don't use passwords)
6. JWT token generated
7. User redirected to `employee.html` with token

### Existing Users:
1. User clicks SSO button
2. OAuth authentication completes
3. Backend finds user by email
4. Checks `is_active = true`
5. JWT token generated
6. User redirected to appropriate dashboard (admin.html or employee.html)

---

## 🎯 Production Deployment Checklist

- [ ] Register OAuth applications in production environment
- [ ] Update callback URLs to production domain
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Enable HTTPS (`ENFORCE_HTTPS=true`)
- [ ] Restrict CORS to production domain
- [ ] Use strong `JWT_SECRET` (64+ characters)
- [ ] Configure SSL certificate for domain
- [ ] Test OAuth flow end-to-end
- [ ] Monitor System_Health_Log for OAuth events
- [ ] Document OAuth credentials in secure vault

---

## 📞 Support

For OAuth configuration issues:
1. Check browser console for errors
2. Check backend logs: `docker logs cicj-backend`
3. Verify environment variables: `cat backend/.env`
4. Test with Postman/curl to isolate frontend vs backend issues

---

**Task 3 (OAuth SSO Integration) - COMPLETE** ✅
