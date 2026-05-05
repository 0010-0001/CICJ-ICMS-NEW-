/**
 * ==========================================
 * MULTI-FACTOR AUTHENTICATION (MFA) MIDDLEWARE
 * ==========================================
 * Email-based OTP (One-Time Password) system
 * Implements Identity and Access Management (IAM) requirements
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// This module handles OTP generation, delivery, and verification state.

// In-memory OTP storage (use Redis in production)
// Structure: { email: { otp: '123456', expires: timestamp, userId: 1 } }
const otpStore = new Map();

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;

const logOTPToTerminal = (email, otp, note = 'MFA code generated') => {
    console.log('\n' + '='.repeat(64));
    console.log(`[MFA CODE] ${note}`);
    console.log(`[MFA CODE] Email: ${email}`);
    console.log(`[MFA CODE] OTP: ${otp}`);
    console.log(`[MFA CODE] Expires in: ${OTP_EXPIRY_MINUTES} minute(s)`);
    console.log('[MFA CODE] Enter this code on the OTP verification screen.');
    console.log('='.repeat(64) + '\n');
};

/**
 * Email Transporter Configuration
 */
let transporter;

const initializeEmailTransporter = () => {
    // Create reusable SMTP connection settings for OTP emails.
    try {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });

        console.log('[MFA] Email transporter initialized successfully');
        return true;
    } catch (error) {
        console.error('[MFA] Email transporter initialization failed:', error.message);
        return false;
    }
};

/**
 * Generate Random OTP
 */
const generateOTP = () => {
    // Generate a secure random 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
};

const buildOtpEmailHtml = ({ userName, otp, logoMarkup }) => {
    const safeName = userName || 'User';
    const headerLogo = logoMarkup || '<div class="logo-box"><div class="logo-icon"></div></div>';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #374151;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f3f4f6;
        }
        .container {
            background-color: #ffffff;
            border-radius: 16px;
            margin: 40px 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #0f172a 0%, #111827 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 999px;
            color: #cbd5f5;
            font-size: 12px;
            letter-spacing: 0.4px;
            margin: 6px 0 18px;
        }
        .logo-box {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #2dad50 0%, #258a3f 100%);
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            box-shadow: 0 8px 24px rgba(45, 173, 80, 0.3);
        }
        .brand-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
            border-radius: 12px;
            margin-bottom: 16px;
            background: #ffffff;
            padding: 6px;
            box-shadow: 0 8px 24px rgba(45, 173, 80, 0.3);
        }
        .brand-name {
            color: #e2e8f0;
            font-size: 13px;
            letter-spacing: 1.6px;
            text-transform: uppercase;
            margin-bottom: 6px;
        }
        .logo-icon {
            width: 32px;
            height: 32px;
            background-color: white;
            -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86 0-7-3.14-7-7V8.3l7-3.11 7 3.11V13c0 3.86-3.14 7-7 7z"/></svg>') no-repeat center;
            mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.86 0-7-3.14-7-7V8.3l7-3.11 7 3.11V13c0 3.86-3.14 7-7 7z"/></svg>') no-repeat center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 22px;
            font-weight: 700;
        }
        .header p {
            color: #cbd5f5;
            margin: 6px 0 0 0;
            font-size: 13px;
            font-weight: 500;
        }
        .content {
            padding: 36px 30px 40px;
        }
        .greeting {
            color: #0f172a;
            font-size: 16px;
            margin-bottom: 14px;
        }
        .message {
            color: #64748b;
            font-size: 15px;
            margin-bottom: 24px;
            line-height: 1.7;
        }
        .otp-box {
            background: linear-gradient(135deg, #2dad50 0%, #258a3f 100%);
            color: #ffffff;
            text-align: center;
            padding: 26px;
            border-radius: 12px;
            margin: 20px 0 22px;
            box-shadow: 0 12px 28px rgba(45, 173, 80, 0.25);
        }
        .otp-label {
            font-size: 12px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .otp-code {
            font-size: 38px;
            font-weight: bold;
            letter-spacing: 10px;
            font-family: 'Courier New', monospace;
            margin: 10px 0 0;
        }
        .otp-expiry {
            margin-top: 16px;
            font-size: 12px;
            color: #6b7280;
        }
        .footer {
            margin-top: 26px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
        }
        @media (max-width: 560px) {
            .container {
                margin: 20px 12px;
            }
            .content {
                padding: 28px 22px 32px;
            }
            .otp-code {
                font-size: 30px;
                letter-spacing: 6px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            ${headerLogo}
            <div class="brand-name">CICJ Construction</div>
            <h1>CICJ-SH-COMS Verification</h1>
            <p>Secure access confirmation</p>
            <div class="header-badge">Secure login • 2-step verification</div>
        </div>
        <div class="content">
            <div class="greeting">Hi ${safeName},</div>
            <div class="message">Use the code below to finish signing in. This code expires in ${OTP_EXPIRY_MINUTES} minute(s).</div>
            <div class="otp-box">
                <div class="otp-label">Verification Code</div>
                <div class="otp-code">${otp}</div>
            </div>
            <div class="otp-expiry">If you did not request this, you can ignore this email.</div>
        </div>
    </div>
    <div class="footer">CICJ-SH-COMS Security • Do not share this code.</div>
</body>
</html>
    `.trim();
};

/**
 * Send OTP Email
 */
const sendOTPEmail = async (email, otp, userName = 'User') => {
    // In dev mode, OTP can be printed in terminal when SMTP is not configured.
    try {
        const logoPath = path.join(__dirname, '..', '..', 'Images', 'CICJ.png');
        const logoExists = fs.existsSync(logoPath);
        const logoDataUri = logoExists
            ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
            : null;

        // Prefer Brevo HTTP API when configured (avoids SMTP blocks).
        if (process.env.BREVO_API_KEY) {
            const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER;
            const senderName = process.env.BREVO_SENDER_NAME || 'CICJ-SH-COMS Security';

            if (!senderEmail) {
                throw new Error('Brevo sender email missing');
            }

            const headerLogoMarkup = logoDataUri
                ? `<img src="${logoDataUri}" alt="CICJ Logo" class="brand-logo">`
                : `<div class="logo-box"><div class="logo-icon"></div></div>`;

            await axios.post(
                'https://api.brevo.com/v3/smtp/email',
                {
                    sender: {
                        name: senderName,
                        email: senderEmail
                    },
                    to: [{ email, name: userName }],
                    subject: 'Login Verification Code - CICJ-SH-COMS',
                    htmlContent: buildOtpEmailHtml({ userName, otp, logoMarkup: headerLogoMarkup })
                },
                {
                    headers: {
                        'api-key': process.env.BREVO_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            return { success: true, devMode: false };
        }

        // Check if SMTP email is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('[MFA] Email not configured. OTP would be:', otp);
            // In development, just log the OTP
            if (process.env.NODE_ENV !== 'production') {
                logOTPToTerminal(email, otp, 'Email not configured (development mode)');
                return { success: true, devMode: true };
            }
            throw new Error('Email configuration missing');
        }

        // Initialize transporter if not already done
        if (!transporter) {
            initializeEmailTransporter();
        }

        const logoCid = 'cicj-logo';
        const headerLogoMarkup = logoExists
            ? `<img src="cid:${logoCid}" alt="CICJ Logo" class="brand-logo">`
            : `<div class="logo-box"><div class="logo-icon"></div></div>`;

        const mailOptions = {
            from: `"CICJ-SH-COMS Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Login Verification Code - CICJ-SH-COMS',
            attachments: logoExists
                ? [{
                    filename: 'CICJ.png',
                    path: logoPath,
                    cid: logoCid
                }]
                : [],
            html: buildOtpEmailHtml({ userName, otp, logoMarkup: headerLogoMarkup }),
            text: `
CICJ-SH-COMS Login Verification
========================================

Hello ${userName},

We received a login attempt for your CICJ-SH-COMS account.

Your verification code is: ${otp}

This code will expire in ${OTP_EXPIRY_MINUTES} minutes.

INSTRUCTIONS:
- Enter this code on the login verification page
- Do not share this code with anyone

SECURITY NOTICE:
If you did not attempt to log in, please disregard this email
and contact your system administrator immediately.

Never share your credentials or verification codes with anyone.

========================================
CICJ-SH-COMS - Secure Hybrid Construction Management System
Construction Information & Client Journey
(c) ${new Date().getFullYear()} CICJ-SH-COMS. All rights reserved.

This is an automated message. Please do not reply.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[MFA] OTP email sent to ${email}: ${info.messageId}`);
        logOTPToTerminal(email, otp, 'Email sent successfully');
        
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('[MFA] Failed to send OTP email:', error.message);
        
        // In development, still show OTP in console
        if (process.env.NODE_ENV !== 'production') {
            logOTPToTerminal(email, otp, 'Email send failed (development fallback)');
            return { success: true, devMode: true, error: error.message };
        }
        
        throw error;
    }
};

/**
 * Generate and Send OTP
 */
const generateAndSendOTP = async (userId, email, userName) => {
    try {
        const otp = generateOTP();
        const expiresAt = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);

        // Store OTP
        otpStore.set(email, {
            otp,
            userId,
            expires: expiresAt,
            attempts: 0,
            createdAt: Date.now()
        });

        // Send email
        const emailResult = await sendOTPEmail(email, otp, userName);

        console.log(`[MFA] OTP generated for ${email} (User ID: ${userId})`);
        
        return {
            success: true,
            expiresIn: OTP_EXPIRY_MINUTES * 60,
            devMode: emailResult.devMode || false
        };

    } catch (error) {
        console.error('❌ Failed to generate and send OTP:', error.message);
        throw error;
    }
};

/**
 * Verify OTP
 */
const verifyOTP = (email, submittedOTP) => {
    const otpData = otpStore.get(email);

    // Check if OTP exists
    if (!otpData) {
        return {
            valid: false,
            error: 'No OTP found. Please request a new code.',
            code: 'OTP_NOT_FOUND'
        };
    }

    // Check expiration
    if (Date.now() > otpData.expires) {
        otpStore.delete(email);
        return {
            valid: false,
            error: 'OTP has expired. Please request a new code.',
            code: 'OTP_EXPIRED'
        };
    }

    // Check attempts
    if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(email);
        return {
            valid: false,
            error: 'Maximum verification attempts exceeded. Please request a new code.',
            code: 'MAX_ATTEMPTS_EXCEEDED'
        };
    }

    // Increment attempts
    otpData.attempts++;

    // Verify OTP
    if (submittedOTP === otpData.otp) {
        const userId = otpData.userId;
        otpStore.delete(email); // Clear OTP after successful verification
        
        return {
            valid: true,
            userId,
            message: 'OTP verified successfully'
        };
    } else {
        const attemptsLeft = MAX_OTP_ATTEMPTS - otpData.attempts;
        
        return {
            valid: false,
            error: `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`,
            code: 'INVALID_OTP',
            attemptsLeft
        };
    }
};

/**
 * Resend OTP (with rate limiting)
 */
const resendOTP = async (userId, email, userName) => {
    const existingOTP = otpStore.get(email);

    // Rate limiting: Don't allow resend within 1 minute
    if (existingOTP && (Date.now() - existingOTP.createdAt) < 60000) {
        const waitTime = Math.ceil((60000 - (Date.now() - existingOTP.createdAt)) / 1000);
        return {
            success: false,
            error: `Please wait ${waitTime} seconds before requesting a new code.`,
            code: 'RATE_LIMITED',
            waitTime
        };
    }

    // Generate and send new OTP
    return await generateAndSendOTP(userId, email, userName);
};

/**
 * Clear OTP (for cleanup or logout)
 */
const clearOTP = (email) => {
    otpStore.delete(email);
    console.log(`🗑️  OTP cleared for ${email}`);
};

/**
 * Get OTP Status (for debugging)
 */
const getOTPStatus = (email) => {
    const otpData = otpStore.get(email);
    
    if (!otpData) {
        return { exists: false };
    }

    return {
        exists: true,
        expiresIn: Math.max(0, Math.ceil((otpData.expires - Date.now()) / 1000)),
        attempts: otpData.attempts,
        maxAttempts: MAX_OTP_ATTEMPTS,
        isExpired: Date.now() > otpData.expires
    };
};

/**
 * Cleanup expired OTPs (run periodically)
 */
const cleanupExpiredOTPs = () => {
    let cleanedCount = 0;
    
    for (const [email, otpData] of otpStore.entries()) {
        if (Date.now() > otpData.expires) {
            otpStore.delete(email);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired OTP(s)`);
    }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    initializeEmailTransporter,
    generateOTP,
    sendOTPEmail,
    generateAndSendOTP,
    verifyOTP,
    resendOTP,
    clearOTP,
    getOTPStatus,
    cleanupExpiredOTPs,
    OTP_EXPIRY_MINUTES,
    MAX_OTP_ATTEMPTS
};
