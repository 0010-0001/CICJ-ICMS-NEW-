/**
 * ==========================================
 * MULTI-FACTOR AUTHENTICATION (MFA) MIDDLEWARE
 * ==========================================
 * Email-based OTP (One-Time Password) system
 * Implements Identity and Access Management (IAM) requirements
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// In-memory OTP storage (use Redis in production)
// Structure: { email: { otp: '123456', expires: timestamp, userId: 1 } }
const otpStore = new Map();

// OTP Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 3;

/**
 * Email Transporter Configuration
 */
let transporter;

const initializeEmailTransporter = () => {
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

        console.log('✅ Email transporter initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Email transporter initialization failed:', error.message);
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

/**
 * Send OTP Email
 */
const sendOTPEmail = async (email, otp, userName = 'User') => {
    try {
        // Check if email is configured
        if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            console.warn('⚠️  Email not configured. OTP would be:', otp);
            // In development, just log the OTP
            if (process.env.NODE_ENV !== 'production') {
                console.log(`\n${'='.repeat(50)}`);
                console.log(`📧 OTP for ${email}: ${otp}`);
                console.log(`   Valid for ${OTP_EXPIRY_MINUTES} minutes`);
                console.log(`${'='.repeat(50)}\n`);
                return { success: true, devMode: true };
            }
            throw new Error('Email configuration missing');
        }

        // Initialize transporter if not already done
        if (!transporter) {
            initializeEmailTransporter();
        }

        const mailOptions = {
            from: `"CICJ-ICMS Security" <${process.env.SMTP_USER}>`,
            to: email,
            subject: '🔐 Your Login Verification Code - CICJ-ICMS',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #1976D2;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #1976D2;
            margin: 0;
            font-size: 28px;
        }
        .otp-box {
            background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
            color: white;
            text-align: center;
            padding: 30px;
            border-radius: 8px;
            margin: 30px 0;
            box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
        }
        .otp-code {
            font-size: 48px;
            font-weight: bold;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .otp-label {
            font-size: 14px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .info {
            background-color: #FFF3E0;
            border-left: 4px solid #FF9800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .warning {
            background-color: #FFEBEE;
            border-left: 4px solid #F44336;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
        }
        ul {
            padding-left: 20px;
        }
        li {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Login Verification</h1>
            <p style="margin: 10px 0 0 0; color: #666;">CICJ-ICMS Security System</p>
        </div>

        <p>Hello <strong>${userName}</strong>,</p>
        
        <p>We received a login attempt for your CICJ-ICMS account. To complete the login process, please use the One-Time Password (OTP) below:</p>

        <div class="otp-box">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="otp-label">Valid for ${OTP_EXPIRY_MINUTES} minutes</div>
        </div>

        <div class="info">
            <strong>⏱️ Important:</strong>
            <ul>
                <li>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong></li>
                <li>Do not share this code with anyone</li>
                <li>Enter this code on the login page to continue</li>
            </ul>
        </div>

        <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
                <li>If you did not attempt to log in, please ignore this email</li>
                <li>Contact your system administrator if you suspect unauthorized access</li>
                <li>Never share your password or OTP with anyone, including CICJ staff</li>
            </ul>
        </div>

        <p>If you have any questions or concerns, please contact your system administrator.</p>

        <div class="footer">
            <p><strong>CICJ-ICMS</strong> - Construction Information & Client Journey</p>
            <p>Integrated Construction Management System</p>
            <p style="margin-top: 10px; font-size: 11px;">
                This is an automated message. Please do not reply to this email.<br>
                © ${new Date().getFullYear()} CICJ-ICMS. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
            `,
            text: `
CICJ-ICMS Login Verification

Hello ${userName},

Your One-Time Password (OTP) is: ${otp}

This code will expire in ${OTP_EXPIRY_MINUTES} minutes.

If you did not attempt to log in, please ignore this email and contact your system administrator.

Never share your password or OTP with anyone.

---
CICJ-ICMS - Construction Information & Client Journey
© ${new Date().getFullYear()} CICJ-ICMS. All rights reserved.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        
        console.log(`✅ OTP email sent to ${email}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };

    } catch (error) {
        console.error('❌ Failed to send OTP email:', error.message);
        
        // In development, still show OTP in console
        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`📧 OTP for ${email}: ${otp} (Email failed, dev mode)`);
            console.log(`   Valid for ${OTP_EXPIRY_MINUTES} minutes`);
            console.log(`${'='.repeat(50)}\n`);
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

        console.log(`✅ OTP generated for ${email} (User ID: ${userId})`);
        
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
