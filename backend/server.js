const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const fs = require('fs');
const { 
    authenticateToken, 
    authorizeRole,
    requirePermission,
    requireAllPermissions,
    requireAnyPermission,
    requireOwnershipOrPermission
} = require('./middleware/auth');
const {
    sanitizeInput,
    validateUserRegistration,
    validateLogin,
    validateEquipment,
    validateAttendance,
    validateFileUpload,
    validateInquiry,
    validateId,
    handleValidationErrors,
    generateCsrfToken,
    validateCsrfToken,
    getCsrfTokenEndpoint
} = require('./middleware/security');
const {
    initializeEmailTransporter,
    generateAndSendOTP,
    verifyOTP,
    resendOTP,
    clearOTP,
    getOTPStatus,
    OTP_EXPIRY_MINUTES,
    MAX_OTP_ATTEMPTS
} = require('./middleware/mfa');
const {
    calculateDistance,
    isWithinGeoFence,
    isValidCoordinates,
    findNearestSite
} = require('./middleware/geo-fencing');
const {
    cloudinary,
    imageUpload,
    fileUpload,
    uploadToCloudinary,
    deleteFromCloudinary,
    isImageType,
    resolveStorageLocation
} = require('./middleware/cloudinary');
require('dotenv').config();

/**
 * Main API server for CICJ-SHCOMS.
 * This file sets up middleware, authentication, and route handlers.
 */

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const SEED_ADMIN_TOKEN = process.env.SEED_ADMIN_TOKEN;

// Railway/Reverse-proxy setup so rate limiting reads real client IPs.
app.set('trust proxy', 1);

// ==========================================
// PASSPORT OAUTH CONFIGURATION
// ==========================================

// Initialize Passport
app.use(passport.initialize());

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || '/oauth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                const fullName = profile.displayName;

                // Find or create user
                let user = await prisma.user.findUnique({ where: { email } });

                if (!user) {
                    // Create new user with OAuth
                    user = await prisma.user.create({
                        data: {
                            email,
                            full_name: fullName,
                            password_hash: await bcrypt.hash(Math.random().toString(36), 10), // Random password for OAuth users
                            role: 'EMPLOYEE',
                            is_active: true
                        }
                    });

                    await prisma.system_Health_Log.create({
                        data: {
                            event_type: 'OAUTH_USER_CREATED',
                            description: `New user created via Google OAuth: ${email}`,
                            ip_address: '0.0.0.0'
                        }
                    });
                }

                if (!user.is_active) {
                    return done(null, false, { message: 'Account is deactivated' });
                }

                return done(null, user);
            } catch (error) {
                console.error('Google OAuth Error:', error);
                return done(error, null);
            }
        }
    ));
}

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

function buildAdminPermissions() {
    return {
        can_view_users: true,
        can_add_users: true,
        can_edit_users: true,
        can_delete_users: true,
        can_activate_users: true,
        can_view_own_attendance: true,
        can_view_all_attendance: true,
        can_edit_attendance: true,
        can_delete_attendance: true,
        can_export_attendance: true,
        can_view_equipment: true,
        can_add_equipment: true,
        can_edit_equipment: true,
        can_delete_equipment: true,
        can_assign_equipment: true,
        can_view_files: true,
        can_upload_files: true,
        can_edit_files: true,
        can_delete_files: true,
        can_download_files: true,
        can_view_inquiries: true,
        can_add_inquiries: true,
        can_update_inquiries: true,
        can_delete_inquiries: true,
        can_assign_inquiries: true,
        can_view_health_logs: true,
        can_export_health_logs: true,
        can_acknowledge_security_alerts: true,
        can_manage_permissions: true,
        can_view_audit_trail: true,
        can_backup_database: true,
        can_view_reports: true,
        can_export_attendance_report: true,
        can_export_equipment_report: true,
        can_export_inquiry_report: true,
        can_export_files_report: true
    };
}

// 1. Helmet - Security headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "https://unpkg.com", "https://www.google.com", "https://www.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://www.google.com", "https://www.gstatic.com"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'", "https://www.google.com", "https://recaptcha.google.com"]
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// 2. CORS - Controlled cross-origin access
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Restrict in production
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// 3. Rate Limiting - Prevent DoS attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window per IP (increased for development)
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limit for authentication routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per window
    handler: async (req, res) => {
        await logSiemEvent(
            'SECURITY_BRUTE_FORCE_SUSPECTED',
            'HIGH',
            'Login rate limit triggered due to excessive attempts',
            req,
            { window_minutes: 15, max_attempts: 10 }
        );

        return res.status(429).json({
            error: 'Too many login attempts, please try again later.',
            retryAfter: '15 minutes',
            hint: 'For security, we limit login attempts. Please wait before trying again.'
        });
    }
});

if (process.env.NODE_ENV === 'production') {
    app.use('/login', authLimiter);
} else {
    // Development-only: skip login throttling to avoid blocking local testing.
    console.warn('[SECURITY] Login rate limiter is disabled outside production.');
}
app.use('/register', limiter);
app.use('/api/', limiter);

// 4. Body parser
app.use(express.json({ limit: '10mb' })); // Limit payload size

// 5. XSS Protection - Sanitize all inputs
app.use(sanitizeInput);

// 6. HTTPS Redirect (production only)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
        } else {
            next();
        }
    });
}

// 7. Serve static files (HTML, CSS, JS) from parent directory
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

const USER_PROFILE_PHOTO_DIR = path.join(__dirname, 'data');
const USER_PROFILE_PHOTO_FILE = path.join(USER_PROFILE_PHOTO_DIR, 'user-profile-photos.json');

// Legacy local store for profile photos.
// DB is the main source now, but this keeps older records readable.

function ensureUserProfilePhotoStore() {
    if (!fs.existsSync(USER_PROFILE_PHOTO_DIR)) {
        fs.mkdirSync(USER_PROFILE_PHOTO_DIR, { recursive: true });
    }

    if (!fs.existsSync(USER_PROFILE_PHOTO_FILE)) {
        fs.writeFileSync(USER_PROFILE_PHOTO_FILE, '{}', 'utf8');
    }
}

function loadUserProfilePhotoStore() {
    try {
        ensureUserProfilePhotoStore();
        const raw = fs.readFileSync(USER_PROFILE_PHOTO_FILE, 'utf8');
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('User profile photo store load warning:', error.message);
        return {};
    }
}

let userProfilePhotoStore = loadUserProfilePhotoStore();

function saveUserProfilePhotoStore() {
    try {
        ensureUserProfilePhotoStore();
        fs.writeFileSync(USER_PROFILE_PHOTO_FILE, JSON.stringify(userProfilePhotoStore, null, 2), 'utf8');
    } catch (error) {
        console.warn('User profile photo store save warning:', error.message);
    }
}

function getUserProfilePhoto(userId) {
    if (!userId) return null;
    const value = userProfilePhotoStore[String(userId)];
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveUserProfilePhoto(dbPhoto, userId) {
    // DB is the source of truth. Legacy store is only written for compatibility.
    const normalizedDbPhoto = typeof dbPhoto === 'string' ? dbPhoto.trim() : '';
    if (normalizedDbPhoto.length > 0) return normalizedDbPhoto;
    return null;
}

function setUserProfilePhoto(userId, photoDataUrl) {
    const key = String(userId);
    if (!photoDataUrl) {
        delete userProfilePhotoStore[key];
    } else {
        userProfilePhotoStore[key] = photoDataUrl;
    }
    saveUserProfilePhotoStore();
}

function validateProfilePhotoDataUrl(photoDataUrl) {
    if (photoDataUrl == null || photoDataUrl === '') {
        return { valid: true, normalized: null };
    }

    if (typeof photoDataUrl !== 'string') {
        return { valid: false, error: 'Invalid profile photo payload.' };
    }

    const normalized = photoDataUrl.trim();
    const dataUrlMatch = normalized.match(/^data:image\/(png|jpe?g|webp|gif);base64,([a-zA-Z0-9+/=]+)$/i);
    if (!dataUrlMatch) {
        return { valid: false, error: 'Profile photo must be a valid base64 image data URL.' };
    }

    const base64Payload = dataUrlMatch[2];
    const sizeBytes = Buffer.byteLength(base64Payload, 'base64');
    const maxBytes = 5 * 1024 * 1024;
    if (sizeBytes > maxBytes) {
        return { valid: false, error: 'Profile photo must be 5 MB or smaller.' };
    }

    return { valid: true, normalized };
}

// Compute total size of a directory recursively.
function getDirectorySizeBytes(dirPath) {
    const fs = require('fs');

    if (!fs.existsSync(dirPath)) return 0;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let total = 0;

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            total += getDirectorySizeBytes(fullPath);
        } else if (entry.isFile()) {
            total += fs.statSync(fullPath).size;
        }
    }

    return total;
}

function escapeCsv(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function parseDateRange(query, defaultDays = 7) {
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();
    const startDate = query?.startDate
        ? new Date(query.startDate)
        : new Date(endDate.getTime() - (defaultDays - 1) * 24 * 60 * 60 * 1000);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}

const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_LOGIN_ALERT_THRESHOLD = 5;
const LOW_INVENTORY_THRESHOLD = Number(process.env.LOW_INVENTORY_THRESHOLD || 2);
const LOW_INVENTORY_COOLDOWN_MS = 30 * 60 * 1000;
const failedLoginTracker = new Map();
const lowInventoryNotificationTracker = new Map();
let notificationTransporter = null;

// SIEM + notification utility block.
// These helpers keep alert logic in one place so route handlers stay shorter.

function getClientIp(req) {
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1';
}

async function ensureArchiveStore() {
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS archive_records (
            archive_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            entity_type VARCHAR(64) NOT NULL,
            source_table VARCHAR(128) NOT NULL,
            record_id VARCHAR(64) NOT NULL,
            deleted_by_user_id INT NULL,
            deleted_by_name VARCHAR(191) NULL,
            deleted_by_email VARCHAR(191) NULL,
            deleted_by_role VARCHAR(64) NULL,
            delete_reason VARCHAR(255) NULL,
            deleted_ip VARCHAR(120) NULL,
            payload_json LONGTEXT NOT NULL,
            deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_immutable TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (archive_id),
            INDEX idx_archive_deleted_at (deleted_at),
            INDEX idx_archive_entity_type (entity_type),
            INDEX idx_archive_deleted_by_user_id (deleted_by_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

function sanitizeArchivePayload(entityType, payload) {
    if (!payload || typeof payload !== 'object') {
        return payload;
    }

    const sanitized = { ...payload };

    if (entityType === 'USER') {
        if (Object.prototype.hasOwnProperty.call(sanitized, 'password_hash')) {
            sanitized.password_hash = '[REDACTED]';
        }
        if (Object.prototype.hasOwnProperty.call(sanitized, 'mfa_secret')) {
            sanitized.mfa_secret = '[REDACTED]';
        }
    }

    return sanitized;
}

function parseArchivePayload(payloadJson) {
    if (!payloadJson) return null;
    try {
        return JSON.parse(payloadJson);
    } catch (error) {
        return null;
    }
}

async function archiveDeletedRecord(txClient, archiveData) {
    const {
        entityType,
        sourceTable,
        recordId,
        actorUserId,
        actorName,
        actorEmail,
        actorRole,
        deletedIp,
        payload,
        deleteReason
    } = archiveData;

    const sanitizedPayload = sanitizeArchivePayload(entityType, payload);
    const payloadJson = JSON.stringify(sanitizedPayload ?? {});

    await txClient.$executeRaw`
        INSERT INTO archive_records (
            entity_type,
            source_table,
            record_id,
            deleted_by_user_id,
            deleted_by_name,
            deleted_by_email,
            deleted_by_role,
            delete_reason,
            deleted_ip,
            payload_json,
            is_immutable
        )
        VALUES (
            ${entityType},
            ${sourceTable},
            ${String(recordId)},
            ${actorUserId ?? null},
            ${actorName || null},
            ${actorEmail || null},
            ${actorRole || null},
            ${deleteReason || null},
            ${deletedIp || null},
            ${payloadJson},
            ${1}
        )
    `;
}

function getArchiveActorFromRequest(req) {
    const permissionsUser = req.userPermissions || {};
    const jwtUser = req.user || {};

    return {
        actorUserId: permissionsUser.user_id ?? jwtUser.user_id ?? null,
        actorName: permissionsUser.full_name || null,
        actorEmail: permissionsUser.email || null,
        actorRole: (permissionsUser.role || jwtUser.role || 'UNKNOWN').toUpperCase()
    };
}

async function logSiemEvent(eventType, severity, description, req, metadata = {}) {
    const payload = {
        event_type: eventType,
        description: `[SIEM][${severity}] ${description}${Object.keys(metadata).length ? ` | context=${JSON.stringify(metadata)}` : ''}`,
        ip_address: getClientIp(req)
    };

    await prisma.system_Health_Log.create({ data: payload }).catch((error) => {
        console.error('SIEM log write error:', error.message);
    });
}

function getNotificationTransporter() {
    if (notificationTransporter) {
        return notificationTransporter;
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        return null;
    }

    notificationTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
        },
        tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
    });

    return notificationTransporter;
}

function extractNotificationContext(description) {
    const text = String(description || '');
    const marker = ' | context=';
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    const jsonText = text.slice(idx + marker.length).trim();
    try {
        const payload = JSON.parse(jsonText);
        return payload && typeof payload === 'object' ? payload : null;
    } catch (error) {
        return null;
    }
}

async function sendNotificationEmail(recipients, subject, title, messageLines = []) {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { success: false, reason: 'no_recipients' };
    }

    const mailer = getNotificationTransporter();
    if (!mailer) {
        return { success: false, reason: 'email_not_configured' };
    }

    const safeLines = messageLines.map(line => String(line || ''));
    const textBody = [title, ...safeLines].join('\n');
    const htmlBody = `
        <div style="font-family:Segoe UI,Tahoma,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1f2937;">
            <h2 style="margin:0 0 12px 0;color:#111827;">${title}</h2>
            ${safeLines.map(line => `<p style="margin:0 0 8px 0;line-height:1.5;">${line}</p>`).join('')}
            <p style="margin-top:16px;color:#6b7280;font-size:12px;">This is an automated alert from CICJ-ICMS.</p>
        </div>
    `;

    await mailer.sendMail({
        from: `"CICJ-ICMS Alerts" <${process.env.SMTP_USER}>`,
        to: recipients.join(','),
        subject,
        text: textBody,
        html: htmlBody
    });

    return { success: true };
}

async function getAdminNotificationRecipients() {
    const adminUsers = await prisma.user.findMany({
        where: {
            is_active: true,
            OR: [
                { role: 'ADMIN' },
                { can_view_health_logs: true }
            ]
        },
        select: {
            email: true
        }
    });

    return [...new Set(adminUsers.map(user => String(user.email || '').trim()).filter(Boolean))];
}

async function createNotificationEvent(eventType, severity, title, message, req, metadata = {}) {
    const payload = {
        event_type: eventType,
        description: `[NOTIFICATION][${severity}] ${title} | ${message}${Object.keys(metadata).length ? ` | context=${JSON.stringify(metadata)}` : ''}`,
        ip_address: getClientIp(req)
    };

    return prisma.system_Health_Log.create({ data: payload });
}

async function notifyAdmins(eventType, severity, title, message, req, metadata = {}, emailSubject = null) {
    await createNotificationEvent(eventType, severity, title, message, req, metadata);

    try {
        const recipients = await getAdminNotificationRecipients();
        if (recipients.length > 0) {
            await sendNotificationEmail(
                recipients,
                emailSubject || title,
                title,
                [message, `Time: ${new Date().toLocaleString('en-US')}`]
            );
        }
    } catch (error) {
        console.warn('Notification email warning:', error.message);
    }
}

async function checkAndNotifyLowInventory(equipmentName, req, metadata = {}) {
    if (!equipmentName) return;

    const availableCount = await prisma.equipment_Inventory.count({
        where: {
            name: equipmentName,
            status: 'Available'
        }
    });

    const totalCount = await prisma.equipment_Inventory.count({
        where: {
            name: equipmentName
        }
    });

    const cacheKey = String(equipmentName).trim().toLowerCase();

    if (totalCount === 0 || availableCount > LOW_INVENTORY_THRESHOLD) {
        lowInventoryNotificationTracker.delete(cacheKey);
        return;
    }

    const lastNotifiedAt = lowInventoryNotificationTracker.get(cacheKey) || 0;
    if (Date.now() - lastNotifiedAt < LOW_INVENTORY_COOLDOWN_MS) {
        return;
    }

    lowInventoryNotificationTracker.set(cacheKey, Date.now());

    await notifyAdmins(
        'NOTIFICATION_LOW_INVENTORY',
        'HIGH',
        'Low Inventory Alert',
        `Equipment "${equipmentName}" is low on available units (${availableCount} available out of ${totalCount}).`,
        req,
        {
            notification_type: 'low_inventory',
            equipment_name: equipmentName,
            available_count: availableCount,
            total_count: totalCount,
            threshold: LOW_INVENTORY_THRESHOLD,
            ...metadata
        },
        `Low Inventory: ${equipmentName}`
    );
}

async function recordFailedLoginAttempt(email, req, reason) {
    const normalizedEmail = String(email || 'unknown').toLowerCase();
    const ip = getClientIp(req);
    const key = `${normalizedEmail}|${ip}`;
    const now = Date.now();

    const current = failedLoginTracker.get(key);
    const baseline = !current || now - current.firstAttemptAt > FAILED_LOGIN_WINDOW_MS
        ? { count: 0, firstAttemptAt: now }
        : current;

    const nextCount = baseline.count + 1;
    failedLoginTracker.set(key, {
        count: nextCount,
        firstAttemptAt: baseline.firstAttemptAt
    });

    await logSiemEvent(
        'SECURITY_LOGIN_FAILURE',
        'MEDIUM',
        `Failed login attempt for ${normalizedEmail} (${reason})`,
        req,
        { attemptsInWindow: nextCount, windowMinutes: 15 }
    );

    if (nextCount >= FAILED_LOGIN_ALERT_THRESHOLD) {
        await logSiemEvent(
            'SECURITY_BRUTE_FORCE_SUSPECTED',
            'HIGH',
            `Repeated failed logins detected for ${normalizedEmail}`,
            req,
            { attemptsInWindow: nextCount, threshold: FAILED_LOGIN_ALERT_THRESHOLD }
        );
    }
}

function clearFailedLoginAttempts(email, req) {
    const normalizedEmail = String(email || 'unknown').toLowerCase();
    const key = `${normalizedEmail}|${getClientIp(req)}`;
    failedLoginTracker.delete(key);
}

function formatDateTime(value) {
    if (!value) return '';
    const dt = new Date(value);
    return dt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Reporting utility block for CSV/PDF output.
// Endpoints call these helpers to keep export formats consistent.
function sendCsvReport(res, fileName, headers, rows, options = {}) {
    const {
        title = '',
        summaryLines = []
    } = options;

    const csvLines = [];

    if (title) {
        csvLines.push([escapeCsv(title)].join(','));
        csvLines.push([escapeCsv(`Generated: ${new Date().toLocaleString('en-US')}`)].join(','));
        summaryLines.forEach(line => {
            csvLines.push([escapeCsv(line)].join(','));
        });
        csvLines.push('');
    }

    csvLines.push(headers.map(escapeCsv).join(','));
    rows.forEach(row => {
        csvLines.push(row.map(escapeCsv).join(','));
    });

    // Prefix with BOM so Excel opens UTF-8 content correctly.
    const csv = `\uFEFF${csvLines.join('\n')}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    res.send(csv);
}

function sendPdfReport(res, fileName, title, headers, rows, summaryLines = []) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = new PassThrough();
    doc.pipe(stream);
    stream.pipe(res);

    const palette = {
        text: '#111827',
        muted: '#6B7280',
        border: '#D1D5DB',
        headerBg: '#E5EAF3',
        zebraBg: '#F8FAFC'
    };

    const cellPaddingX = 6;
    const cellPaddingY = 5;
    const tableFontSize = 8.5;
    const headerFontSize = 9;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(palette.text).text(title, { align: 'left' });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10).fillColor(palette.muted).text(`Generated: ${new Date().toLocaleString('en-US')}`);
    doc.fillColor(palette.text);

    if (summaryLines.length > 0) {
        doc.moveDown(0.6);
        summaryLines.forEach(line => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.text).text(line);
        });
    }

    doc.moveDown(0.8);

    const tableLeft = doc.page.margins.left;
    const tableRight = doc.page.width - doc.page.margins.right;
    const tableWidth = tableRight - tableLeft;
    const pageBottom = doc.page.height - doc.page.margins.bottom;

    const sampleRows = rows.slice(0, 120);
    const columnScores = headers.map((header, colIdx) => {
        const headerScore = String(header || '').length * 1.25;
        const maxCellScore = sampleRows.reduce((maxScore, row) => {
            const cellText = String(row?.[colIdx] ?? '');
            return Math.max(maxScore, Math.min(cellText.length, 42));
        }, 0);
        return Math.max(8, headerScore, maxCellScore);
    });

    const scoreTotal = columnScores.reduce((sum, value) => sum + value, 0);
    const columnWidths = columnScores.map(score => (score / scoreTotal) * tableWidth);

    function drawTableHeader(y) {
        const headerHeight = 24;
        doc.rect(tableLeft, y, tableWidth, headerHeight).fillAndStroke(palette.headerBg, palette.border);

        let x = tableLeft;
        headers.forEach((header, colIdx) => {
            const width = columnWidths[colIdx];
            doc.rect(x, y, width, headerHeight).stroke(palette.border);
            doc
                .font('Helvetica-Bold')
                .fontSize(headerFontSize)
                .fillColor(palette.text)
                .text(String(header || ''), x + cellPaddingX, y + 7, {
                    width: width - (cellPaddingX * 2),
                    align: 'left'
                });
            x += width;
        });

        return y + headerHeight;
    }

    function ensureSpace(requiredHeight, currentY, shouldRedrawHeader = true) {
        if (currentY + requiredHeight <= pageBottom) {
            return currentY;
        }

        doc.addPage();
        let nextY = doc.page.margins.top;
        if (shouldRedrawHeader) {
            nextY = drawTableHeader(nextY);
        }
        return nextY;
    }

    let cursorY = drawTableHeader(doc.y);

    if (rows.length === 0) {
        cursorY = ensureSpace(26, cursorY, false);
        doc
            .font('Helvetica-Oblique')
            .fontSize(10)
            .fillColor(palette.muted)
            .text('No records found for the selected date range.', tableLeft, cursorY + 6);
        doc.end();
        return;
    }

    rows.forEach((row, rowIdx) => {
        const cellHeights = headers.map((_, colIdx) => {
            const cellText = String(row?.[colIdx] ?? '');
            const width = columnWidths[colIdx] - (cellPaddingX * 2);
            const textHeight = doc.heightOfString(cellText, {
                width,
                align: 'left'
            });
            return Math.max(14, textHeight + (cellPaddingY * 2));
        });

        const rowHeight = Math.max(...cellHeights);
        cursorY = ensureSpace(rowHeight, cursorY, true);

        if (rowIdx % 2 === 1) {
            doc.rect(tableLeft, cursorY, tableWidth, rowHeight).fill(palette.zebraBg);
        }

        let x = tableLeft;
        headers.forEach((_, colIdx) => {
            const width = columnWidths[colIdx];
            const cellText = String(row?.[colIdx] ?? '');

            doc.rect(x, cursorY, width, rowHeight).stroke(palette.border);
            doc
                .font('Helvetica')
                .fontSize(tableFontSize)
                .fillColor(palette.text)
                .text(cellText, x + cellPaddingX, cursorY + cellPaddingY, {
                    width: width - (cellPaddingX * 2),
                    align: 'left'
                });

            x += width;
        });

        cursorY += rowHeight;
    });

    doc.end();
}

// ==========================================
// AUTHENTICATION ROUTES (MFA-Enabled)
// ==========================================

// 1. Login Route - Step 1: Validate credentials and send OTP
app.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await prisma.user.findUnique({ 
            where: { email: email } 
        });

        if (!user) {
            await recordFailedLoginAttempt(email, req, 'user_not_found');
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if account is active
        if (!user.is_active) {
            await logSiemEvent(
                'SECURITY_UNAUTHORIZED_INACTIVE_ACCOUNT_LOGIN',
                'MEDIUM',
                `Inactive account login attempt for ${user.email}`,
                req,
                { user_id: user.user_id }
            );
            return res.status(403).json({ error: "Account is deactivated. Contact administrator." });
        }

        // Compare plain text password with password_hash from DB
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            await recordFailedLoginAttempt(email, req, 'password_mismatch');
            return res.status(401).json({ message: "Invalid credentials" });
        }

        clearFailedLoginAttempts(email, req);

        // Check if MFA is enabled
        const mfaEnabled = process.env.MFA_ENABLED === 'true';

        if (!mfaEnabled) {
            // MFA DISABLED: Direct login with JWT token
            const token = jwt.sign(
                { user_id: user.user_id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Log successful login without MFA
            await prisma.system_Health_Log.create({
                data: {
                    event_type: 'LOGIN_SUCCESS',
                    description: `User ${user.full_name} (${user.email}) logged in successfully (MFA disabled).`,
                    ip_address: req.ip || req.connection.remoteAddress || '127.0.0.1'
                }
            });

            return res.json({
                message: "Login successful",
                token,
                user: {
                    user_id: user.user_id,
                    full_name: user.full_name,
                    email: user.email,
                    role: user.role
                }
            });
        }

        // ===== MFA ENABLED: Generate and send OTP =====
        try {
            const otpResult = await generateAndSendOTP(
                user.user_id,
                user.email,
                user.full_name
            );

            res.json({
                message: "Credentials verified. OTP sent to your email.",
                mfaRequired: true,
                email: user.email,
                expiresIn: otpResult.expiresIn,
                devMode: otpResult.devMode || false,
                hint: `Check your email (${user.email}) for the 6-digit verification code.`
            });

        } catch (otpError) {
            console.error("OTP Generation Error:", otpError);
            res.status(500).json({ 
                error: "Failed to send verification code. Please try again.",
                hint: "Contact administrator if the problem persists."
            });
        }

    } catch (error) {
        console.error("Login Error:", error.message || error);
        res.status(500).json({ error: "Server error", detail: error.message });
    }
});

// 2. Verify OTP - Step 2: Validate OTP and issue JWT
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    // Input validation
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
    }

    if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ error: "OTP must be a 6-digit number." });
    }

    try {
        // Verify OTP
        const verificationResult = verifyOTP(email, otp);

        if (!verificationResult.valid) {
            return res.status(401).json({
                error: verificationResult.error,
                code: verificationResult.code,
                attemptsLeft: verificationResult.attemptsLeft
            });
        }

        // OTP valid - fetch user and issue JWT
        const user = await prisma.user.findUnique({
            where: { user_id: verificationResult.userId }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Create JWT with user_id and role
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Log successful login with MFA
        await prisma.system_Health_Log.create({
            data: {
                event_type: 'MFA_LOGIN_SUCCESS',
                description: `User ${user.full_name} (${user.email}) logged in successfully with MFA verification.`,
                ip_address: req.ip || req.connection.remoteAddress || '127.0.0.1'
            }
        });

        res.json({
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ error: "Server error during verification." });
    }
});

// ==========================================
// OAUTH SSO ROUTES
// ==========================================

// Google OAuth - Initiate authentication
app.get('/oauth/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({
            error: 'Google OAuth is not configured on this server.',
            hint: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL environment variables.'
        });
    }
    passport.authenticate('google', {
        scope: ['openid', 'email', 'profile'],
        session: false
    })(req, res, next);
});

// Google OAuth - Callback
app.get('/oauth/google/callback',
    passport.authenticate('google', { 
        session: false,
        failureRedirect: '/index.html?error=oauth_failed' 
    }),
    async (req, res) => {
        try {
            const user = req.user;

            // Generate JWT token
            const token = jwt.sign(
                { user_id: user.user_id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Log successful OAuth login
            await prisma.system_Health_Log.create({
                data: {
                    event_type: 'GOOGLE_OAUTH_LOGIN',
                    description: `User ${user.full_name} (${user.email}) logged in via Google OAuth`,
                    ip_address: req.ip || req.connection.remoteAddress || '127.0.0.1'
                }
            });

            // Redirect to appropriate dashboard with token
            const dashboardUrl = user.role === 'ADMIN' ? '/admin.html' : '/employee.html';
            res.redirect(`${dashboardUrl}?token=${token}&user_id=${user.user_id}&role=${user.role}`);
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            res.redirect('/index.html?error=oauth_error');
        }
    }
);

// 3. Resend OTP
app.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }

    try {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(429).json({
                error: "Please wait before requesting a new code.",
                hint: "If you have an account, a new code will be sent."
            });
        }

        // Resend OTP
        const resendResult = await resendOTP(user.user_id, user.email, user.full_name);

        if (!resendResult.success) {
            return res.status(429).json({
                error: resendResult.error,
                code: resendResult.code,
                waitTime: resendResult.waitTime
            });
        }

        res.json({
            message: "New verification code sent to your email.",
            expiresIn: resendResult.expiresIn,
            devMode: resendResult.devMode || false
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ error: "Failed to resend verification code." });
    }
});

// 4. Password Reset Request Notification
app.post('/api/auth/password-reset-request', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                is_active: true
            }
        });

        await notifyAdmins(
            'NOTIFICATION_PASSWORD_RESET_REQUEST',
            'MEDIUM',
            'Password Reset Requested',
            `Password reset was requested for email ${email}.`,
            req,
            {
                user_exists: Boolean(user),
                user_id: user?.user_id || null
            },
            'Password Reset Request Alert'
        );

        if (user?.is_active) {
            await sendNotificationEmail(
                [user.email],
                'Password Reset Request Received - CICJ-ICMS',
                'Password Reset Request Received',
                [
                    `Hi ${user.full_name},`,
                    'A password reset request was received for your account.',
                    'If this was not you, contact an administrator immediately.'
                ]
            ).catch(error => {
                console.warn('Password reset confirmation email warning:', error.message);
            });
        }

        // Always return generic response to avoid account enumeration
        return res.json({
            message: 'If an account exists for this email, a reset notification has been recorded and instructions will be sent.'
        });
    } catch (error) {
        console.error('Password Reset Request Error:', error);
        return res.status(500).json({ error: 'Failed to process password reset request.' });
    }
});

// 5. Get OTP Status (Development only)
if (process.env.NODE_ENV !== 'production') {
    app.get('/otp-status/:email', (req, res) => {
        const { email } = req.params;
        const status = getOTPStatus(email);
        res.json(status);
    });
}

// ==========================================
// USER MANAGEMENT ROUTES (Granular Permissions)
// ==========================================

// Register New User with Granular Permissions - Requires can_add_users permission
app.post('/register', authenticateToken, requirePermission('can_add_users'), validateUserRegistration, handleValidationErrors, async (req, res) => {
    const { 
        // Basic User Info
        full_name, 
        email, 
        password, 
        role, 
        contact_number, 
        is_active,
        
        // ===== GRANULAR PERMISSIONS MATRIX (30 flags) =====
        // User Management Permissions
        can_view_users,
        can_add_users,
        can_edit_users,
        can_delete_users,
        can_activate_users,
        
        // Attendance Permissions
        can_view_own_attendance,
        can_view_all_attendance,
        can_edit_attendance,
        can_delete_attendance,
        can_export_attendance,
        
        // Equipment Permissions
        can_view_equipment,
        can_add_equipment,
        can_edit_equipment,
        can_delete_equipment,
        can_assign_equipment,
        
        // Project Files Permissions
        can_view_files,
        can_upload_files,
        can_edit_files,
        can_delete_files,
        can_download_files,
        
        // Client Inquiries Permissions
        can_view_inquiries,
        can_add_inquiries,
        can_update_inquiries,
        can_delete_inquiries,
        can_assign_inquiries,
        
        // System Administration Permissions
        can_view_health_logs,
        can_export_health_logs,
        can_manage_permissions,
        can_view_audit_trail,
        can_backup_database,
        
        // Reports
        can_view_reports,
        can_export_attendance_report,
        can_export_equipment_report,
        can_export_inquiry_report,
        can_export_files_report
    } = req.body;

    try {
        // Hash password with bcrypt
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user with ALL permission flags captured from Add New Hire modal
        const newUser = await prisma.user.create({
            data: { 
                // Basic Info
                full_name, 
                email, 
                password_hash: hashedPassword,
                role: role || 'EMPLOYEE',
                contact_number: contact_number || null,
                is_active: is_active !== undefined ? is_active : true,
                
                // ===== GRANULAR PERMISSIONS (from Matrix UI checkboxes) =====
                // User Management (5 permissions)
                can_view_users: can_view_users || false,
                can_add_users: can_add_users || false,
                can_edit_users: can_edit_users || false,
                can_delete_users: can_delete_users || false,
                can_activate_users: can_activate_users || false,
                
                // Attendance (5 permissions)
                can_view_own_attendance: can_view_own_attendance !== undefined ? can_view_own_attendance : true, // Default true
                can_view_all_attendance: can_view_all_attendance || false,
                can_edit_attendance: can_edit_attendance || false,
                can_delete_attendance: can_delete_attendance || false,
                can_export_attendance: can_export_attendance || false,
                
                // Equipment (5 permissions)
                can_view_equipment: can_view_equipment !== undefined ? can_view_equipment : true, // Default true
                can_add_equipment: can_add_equipment || false,
                can_edit_equipment: can_edit_equipment || false,
                can_delete_equipment: can_delete_equipment || false,
                can_assign_equipment: can_assign_equipment || false,
                
                // Project Files (5 permissions)
                can_view_files: can_view_files !== undefined ? can_view_files : true, // Default true
                can_upload_files: can_upload_files || false,
                can_edit_files: can_edit_files || false,
                can_delete_files: can_delete_files || false,
                can_download_files: can_download_files !== undefined ? can_download_files : true, // Default true
                
                // Client Inquiries (5 permissions)
                can_view_inquiries: can_view_inquiries || false,
                can_add_inquiries: can_add_inquiries !== undefined ? can_add_inquiries : true, // Default true
                can_update_inquiries: can_update_inquiries || false,
                can_delete_inquiries: can_delete_inquiries || false,
                can_assign_inquiries: can_assign_inquiries || false,
                
                // System Administration (5 permissions)
                can_view_health_logs: can_view_health_logs || false,
                can_export_health_logs: can_export_health_logs || false,
                can_manage_permissions: can_manage_permissions || false,
                can_view_audit_trail: can_view_audit_trail || false,
                can_backup_database: can_backup_database || false,
                
                // Reports
                can_view_reports: can_view_reports || false,
                can_export_attendance_report: can_export_attendance_report || false,
                can_export_equipment_report: can_export_equipment_report || false,
                can_export_inquiry_report: can_export_inquiry_report || false,
                can_export_files_report: can_export_files_report || false
            }
        });
        
        // Count granted permissions for audit log
        const grantedPermissions = Object.keys(newUser)
            .filter(key => key.startsWith('can_') && newUser[key] === true)
            .length;
        
        res.status(201).json({ 
            message: "User registered successfully with granular permissions.",
            user: {
                user_id: newUser.user_id,
                full_name: newUser.full_name,
                email: newUser.email,
                role: newUser.role,
                is_active: newUser.is_active,
                permissions_granted: grantedPermissions
            }
        });
        
        // Log to System Health (optional - for audit trail)
        await prisma.system_Health_Log.create({
            data: {
                event_type: 'USER_CREATED',
                description: `New user created: ${newUser.full_name} (${newUser.email}) with ${grantedPermissions} permissions by ${req.userPermissions.full_name}`,
                ip_address: req.ip || req.connection.remoteAddress
            }
        }).catch(err => console.error('Audit log error:', err));
        
    } catch (error) {
        console.error("Registration Error:", error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: "Email already exists." });
        }
        res.status(500).json({ error: "Registration failed.", details: error.message });
    }
});

// Get Current User Profile - Returns fresh user data with all permissions
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: req.user.user_id }, // Fix: use user_id instead of userId
            select: {
                user_id: true,
                full_name: true,
                email: true,
                profile_photo: true,
                role: true,
                contact_number: true,
                is_active: true,
                // Employee-level permissions (defaults)
                can_view_own_attendance: true,
                can_view_equipment: true,
                can_view_files: true,
                can_download_files: true,
                can_add_inquiries: true,
                // User Management permissions
                can_view_users: true,
                can_add_users: true,
                can_edit_users: true,
                can_delete_users: true,
                can_activate_users: true,
                // Attendance Management permissions
                can_view_all_attendance: true,
                can_edit_attendance: true,
                can_delete_attendance: true,
                can_export_attendance: true,
                // Equipment Management permissions
                can_add_equipment: true,
                can_edit_equipment: true,
                can_delete_equipment: true,
                can_assign_equipment: true,
                // File Management permissions
                can_upload_files: true,
                can_edit_files: true,
                can_delete_files: true,
                // Client Inquiry permissions
                can_view_inquiries: true,
                can_update_inquiries: true,
                can_delete_inquiries: true,
                can_assign_inquiries: true,
                // System permissions
                can_view_health_logs: true,
                can_export_health_logs: true,
                can_manage_permissions: true,
                can_view_audit_trail: true,
                can_backup_database: true,
                can_view_reports: true,
                can_export_attendance_report: true,
                can_export_equipment_report: true,
                can_export_inquiry_report: true,
                can_export_files_report: true,
                created_at: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        res.json({
            user: {
                ...user,
                profile_photo: resolveUserProfilePhoto(user.profile_photo, user.user_id)
            }
        });
    } catch (error) {
        console.error("Fetch Current User Error:", error);
        res.status(500).json({ error: "Failed to retrieve user data." });
    }
});

// Save/Remove Current User Profile Photo
app.put('/api/me/profile-photo', authenticateToken, async (req, res) => {
    try {
        const { photo_data_url } = req.body || {};
        const validation = validateProfilePhotoDataUrl(photo_data_url);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const user = await prisma.user.findUnique({
            where: { user_id: req.user.user_id },
            select: { user_id: true, is_active: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        await prisma.user.update({
            where: { user_id: user.user_id },
            data: { profile_photo: validation.normalized }
        });
        // Keep legacy local store in sync for compatibility with older snapshots.
        setUserProfilePhoto(user.user_id, validation.normalized);

        res.json({
            message: validation.normalized ? 'Profile photo updated successfully.' : 'Profile photo removed successfully.',
            profile_photo: validation.normalized
        });
    } catch (error) {
        console.error('Profile Photo Update Error:', error);
        res.status(500).json({ error: 'Failed to update profile photo.' });
    }
});

// Get All Users - Requires can_view_users permission
app.get('/api/users', authenticateToken, requirePermission('can_view_users'), async (req, res) => {
    try {
        const usersRaw = await prisma.user.findMany({
            select: {
                user_id: true,
                full_name: true,
                email: true,
                profile_photo: true,
                role: true,
                contact_number: true,
                is_active: true,
                created_at: true
            },
            orderBy: { created_at: 'desc' }
        });

        const users = usersRaw.map(user => ({
            ...user,
            profile_photo: resolveUserProfilePhoto(user.profile_photo, user.user_id)
        }));
        res.json({ users });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ error: "Failed to retrieve users." });
    }
});

// Get Single User - Requires can_view_users permission
app.get('/api/users/:user_id', authenticateToken, requirePermission('can_view_users'), async (req, res) => {
    const { user_id } = req.params;
    
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: parseInt(user_id) },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                profile_photo: true,
                role: true,
                contact_number: true,
                is_active: true,
                created_at: true,
                // All permissions
                can_view_users: true,
                can_add_users: true,
                can_edit_users: true,
                can_delete_users: true,
                can_activate_users: true,
                can_view_own_attendance: true,
                can_view_all_attendance: true,
                can_edit_attendance: true,
                can_delete_attendance: true,
                can_export_attendance: true,
                can_view_equipment: true,
                can_add_equipment: true,
                can_edit_equipment: true,
                can_delete_equipment: true,
                can_assign_equipment: true,
                can_view_files: true,
                can_upload_files: true,
                can_edit_files: true,
                can_delete_files: true,
                can_download_files: true,
                can_view_inquiries: true,
                can_add_inquiries: true,
                can_update_inquiries: true,
                can_delete_inquiries: true,
                can_assign_inquiries: true,
                can_view_health_logs: true,
                can_export_health_logs: true,
                can_manage_permissions: true,
                can_view_audit_trail: true,
                can_backup_database: true,
                // Reports
                can_view_reports: true,
                can_export_attendance_report: true,
                can_export_equipment_report: true,
                can_export_inquiry_report: true,
                can_export_files_report: true
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        
        res.json({
            user: {
                ...user,
                profile_photo: resolveUserProfilePhoto(user.profile_photo, user.user_id)
            }
        });
    } catch (error) {
        console.error("Fetch User Error:", error);
        res.status(500).json({ error: "Failed to retrieve user details." });
    }
});

// Update User - Requires can_edit_users permission
app.put('/api/users/:user_id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
    const { user_id } = req.params;
    const targetUserId = parseInt(user_id);
    const requesterUserId = parseInt(req.user.user_id);
    const { 
        full_name, email, contact_number, role, is_active,
        // User Management
        can_view_users, can_add_users, can_edit_users, can_delete_users, can_activate_users,
        // Attendance
        can_view_own_attendance, can_view_all_attendance, can_edit_attendance, can_delete_attendance, can_export_attendance,
        // Equipment
        can_view_equipment, can_add_equipment, can_edit_equipment, can_delete_equipment, can_assign_equipment,
        // Files
        can_view_files, can_upload_files, can_edit_files, can_delete_files, can_download_files,
        // Inquiries
        can_view_inquiries, can_add_inquiries, can_update_inquiries, can_delete_inquiries, can_assign_inquiries,
        // System
        can_view_health_logs, can_export_health_logs, can_manage_permissions, can_view_audit_trail, can_backup_database,
        // Reports
        can_view_reports, can_export_attendance_report, can_export_equipment_report, can_export_inquiry_report, can_export_files_report
    } = req.body;

    const permissionFieldNames = [
        'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
        'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
        'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
        'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
        'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
        'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database',
        'can_view_reports', 'can_export_attendance_report', 'can_export_equipment_report', 'can_export_inquiry_report', 'can_export_files_report'
    ];

    const isSelfPermissionPayload = targetUserId === requesterUserId && permissionFieldNames.some(field => req.body[field] !== undefined);
    if (isSelfPermissionPayload) {
        return res.status(403).json({
            error: 'Forbidden: You cannot modify your own permission settings.',
            hint: 'Ask another authorized administrator to update your permissions.'
        });
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { user_id: targetUserId },
            select: { user_id: true, role: true }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const requesterRole = String(req.userPermissions?.role || req.user?.role || '').toUpperCase();
        const targetRole = String(targetUser.role || '').toUpperCase();
        if (requesterRole !== 'ADMIN' && targetRole === 'ADMIN') {
            await logSiemEvent(
                'SECURITY_UNAUTHORIZED_ADMIN_ACCOUNT_MODIFICATION_ATTEMPT',
                'HIGH',
                `Blocked user update attempt on ADMIN account (requester_user_id=${requesterUserId}, target_user_id=${targetUserId})`,
                req,
                {
                    action: 'update_user',
                    requester_user_id: requesterUserId,
                    requester_role: requesterRole || 'UNKNOWN',
                    target_user_id: targetUserId,
                    target_role: targetRole
                }
            );
            return res.status(403).json({
                error: 'Forbidden: Employee accounts cannot modify ADMIN users.'
            });
        }

        const updatedUser = await prisma.user.update({
            where: { user_id: targetUserId },
            data: { 
                full_name, email, contact_number, role, is_active,
                can_view_users, can_add_users, can_edit_users, can_delete_users, can_activate_users,
                can_view_own_attendance, can_view_all_attendance, can_edit_attendance, can_delete_attendance, can_export_attendance,
                can_view_equipment, can_add_equipment, can_edit_equipment, can_delete_equipment, can_assign_equipment,
                can_view_files, can_upload_files, can_edit_files, can_delete_files, can_download_files,
                can_view_inquiries, can_add_inquiries, can_update_inquiries, can_delete_inquiries, can_assign_inquiries,
                can_view_health_logs, can_export_health_logs, can_manage_permissions, can_view_audit_trail, can_backup_database,
                can_view_reports, can_export_attendance_report, can_export_equipment_report, can_export_inquiry_report, can_export_files_report
            },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                contact_number: true,
                is_active: true
            }
        });
        res.json({ message: "User updated successfully.", user: updatedUser });
    } catch (error) {
        console.error("Update User Error:", error);
        res.status(500).json({ error: "Failed to update user." });
    }
});

// Delete User - Requires can_delete_users permission
app.delete('/api/users/:user_id', authenticateToken, requirePermission('can_delete_users'), async (req, res) => {
    const { user_id } = req.params;
    const targetUserId = parseInt(user_id);

    try {
        const targetUser = await prisma.user.findUnique({
            where: { user_id: targetUserId }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const requesterRole = String(req.userPermissions?.role || req.user?.role || '').toUpperCase();
        const targetRole = String(targetUser.role || '').toUpperCase();
        if (requesterRole !== 'ADMIN' && targetRole === 'ADMIN') {
            await logSiemEvent(
                'SECURITY_UNAUTHORIZED_ADMIN_ACCOUNT_MODIFICATION_ATTEMPT',
                'HIGH',
                `Blocked user deletion attempt on ADMIN account (requester_user_id=${req.user.user_id}, target_user_id=${targetUserId})`,
                req,
                {
                    action: 'delete_user',
                    requester_user_id: req.user.user_id,
                    requester_role: requesterRole || 'UNKNOWN',
                    target_user_id: targetUserId,
                    target_role: targetRole
                }
            );
            return res.status(403).json({
                error: 'Forbidden: Employee accounts cannot delete ADMIN users.'
            });
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'USER',
                sourceTable: 'User',
                recordId: targetUserId,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from account provisioning',
                payload: targetUser
            });

            await tx.user.delete({
                where: { user_id: targetUserId }
            });
        });

        res.json({ message: 'User moved to archives successfully.' });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ error: "Failed to delete user." });
    }
});

// Verify Password - For sensitive operations
app.post('/api/verify-password', authenticateToken, async (req, res) => {
    const { password } = req.body;
    const userId = req.user.user_id;

    try {
        const user = await prisma.user.findUnique({
            where: { user_id: userId }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Incorrect password" });
        }

        res.json({ message: "Password verified successfully" });
    } catch (error) {
        console.error("Password Verification Error:", error);
        res.status(500).json({ error: "Failed to verify password" });
    }
});

// Activate/Deactivate User - Requires can_activate_users permission
app.patch('/api/users/:user_id/status', authenticateToken, requirePermission('can_activate_users'), async (req, res) => {
    const { user_id } = req.params;
    const { is_active } = req.body;
    const targetUserId = parseInt(user_id);

    try {
        const targetUser = await prisma.user.findUnique({
            where: { user_id: targetUserId },
            select: { user_id: true, role: true }
        });

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const requesterRole = String(req.userPermissions?.role || req.user?.role || '').toUpperCase();
        const targetRole = String(targetUser.role || '').toUpperCase();
        if (requesterRole !== 'ADMIN' && targetRole === 'ADMIN') {
            await logSiemEvent(
                'SECURITY_UNAUTHORIZED_ADMIN_ACCOUNT_MODIFICATION_ATTEMPT',
                'HIGH',
                `Blocked user status change attempt on ADMIN account (requester_user_id=${req.user.user_id}, target_user_id=${targetUserId})`,
                req,
                {
                    action: 'update_user_status',
                    requester_user_id: req.user.user_id,
                    requester_role: requesterRole || 'UNKNOWN',
                    target_user_id: targetUserId,
                    target_role: targetRole,
                    requested_status: Boolean(is_active)
                }
            );
            return res.status(403).json({
                error: 'Forbidden: Employee accounts cannot change ADMIN account status.'
            });
        }

        const updatedUser = await prisma.user.update({
            where: { user_id: targetUserId },
            data: { is_active },
            select: { user_id: true, full_name: true, is_active: true }
        });
        res.json({ 
            message: `User ${is_active ? 'activated' : 'deactivated'} successfully.`,
            user: updatedUser 
        });
    } catch (error) {
        console.error("Status Update Error:", error);
        res.status(500).json({ error: "Failed to update user status." });
    }
});

// ==========================================
// EQUIPMENT MANAGEMENT ROUTES (Granular Permissions)
// ==========================================

// Get All Equipment - Requires can_view_equipment permission
app.get('/api/equipment', authenticateToken, requirePermission('can_view_equipment'), async (req, res) => {
    try {
        const equipment = await prisma.equipment_Inventory.findMany({
            include: {
                checkouts: {
                    where: { status: 'Checked Out' },
                    include: {
                        user: {
                            select: { full_name: true, email: true }
                        }
                    },
                    take: 1
                }
            },
            orderBy: { created_at: 'desc' }
        });
        res.json({ equipment });
    } catch (error) {
        console.error("Fetch Equipment Error:", error);
        res.status(500).json({ error: "Failed to retrieve equipment." });
    }
});

// Get assignable users for equipment assignment - Requires can_assign_equipment permission
app.get('/api/equipment/assignable-users', authenticateToken, requirePermission('can_assign_equipment'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                is_active: true,
                role: 'EMPLOYEE'
            },
            select: {
                user_id: true,
                full_name: true,
                email: true
            },
            orderBy: { full_name: 'asc' }
        });

        res.json({ users });
    } catch (error) {
        console.error('Get Assignable Users Error:', error);
        res.status(500).json({ error: 'Failed to retrieve assignable users.' });
    }
});

// Add Equipment - Requires can_add_equipment permission
app.post('/api/equipment', authenticateToken, requirePermission('can_add_equipment'), async (req, res) => {
    const { name, quantity, condition, status, current_location } = req.body;
    
    if (!name || !quantity) {
        return res.status(400).json({ error: "Name and quantity are required." });
    }

    const qty = parseInt(quantity);
    if (qty < 1) {
        return res.status(400).json({ error: "Quantity must be at least 1." });
    }

    try {
        // Get the highest equipment_id to generate next QR numbers
        const latestEquipment = await prisma.equipment_Inventory.findFirst({
            orderBy: { equipment_id: 'desc' },
            select: { equipment_id: true }
        });
        
        let nextId = latestEquipment ? latestEquipment.equipment_id + 1 : 1;
        
        // Create individual records for each item
        const createdEquipment = [];
        for (let i = 0; i < qty; i++) {
            const qrNumber = `EQ-${String(nextId).padStart(5, '0')}`; // e.g., EQ-00001
            
            // Generate QR code as base64 data URL
            const qrCodeData = await QRCode.toDataURL(qrNumber, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                quality: 0.95,
                margin: 1,
                width: 300
            });
            
            const newEquipment = await prisma.equipment_Inventory.create({
                data: { 
                    name, 
                    quantity: 1, // Each record represents 1 physical item
                    condition: condition || 'Good', 
                    status: status || 'Available',
                    current_location: current_location || null,
                    qr_code: qrCodeData,
                    qr_number: qrNumber
                }
            });
            
            createdEquipment.push(newEquipment);
            nextId++;
        }

        await checkAndNotifyLowInventory(name, req, {
            triggered_by: 'equipment_create',
            actor_user_id: req.user.user_id,
            created_count: qty
        });
        
        res.status(201).json({ 
            message: `${qty} equipment item(s) added successfully with individual QR codes`, 
            equipment: createdEquipment,
            count: qty
        });
    } catch (error) {
        console.error("Add Equipment Error:", error);
        res.status(500).json({ error: "Failed to add equipment" });
    }
});

// Update Equipment - Requires can_edit_equipment permission
app.put('/api/equipment/:equipment_id', authenticateToken, requirePermission('can_edit_equipment'), async (req, res) => {
    const { equipment_id } = req.params;
    const { name, condition, status, current_location } = req.body;

    try {
        const equipmentId = parseInt(equipment_id);
        const existingEquipment = await prisma.equipment_Inventory.findUnique({
            where: { equipment_id: equipmentId }
        });

        if (!existingEquipment) {
            return res.status(404).json({ error: 'Equipment not found.' });
        }

        const updatedEquipment = await prisma.equipment_Inventory.update({
            where: { equipment_id: equipmentId },
            data: { 
                name, 
                quantity: 1, // Always 1 for individual items
                condition, 
                status,
                current_location: current_location || null
            }
        });

        if (existingEquipment.status !== updatedEquipment.status && updatedEquipment.status === 'Out of Order') {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'HIGH',
                `Equipment ${updatedEquipment.qr_number || updatedEquipment.equipment_id} changed to Out of Order`,
                req,
                {
                    equipment_id: updatedEquipment.equipment_id,
                    previous_status: existingEquipment.status,
                    new_status: updatedEquipment.status,
                    changed_by: req.userPermissions?.email || req.user?.user_id
                }
            );
        }

        await checkAndNotifyLowInventory(updatedEquipment.name, req, {
            triggered_by: 'equipment_update',
            actor_user_id: req.user.user_id,
            equipment_id: updatedEquipment.equipment_id
        });

        res.json({ message: "Equipment updated successfully.", equipment: updatedEquipment });
    } catch (error) {
        console.error("Update Equipment Error:", error);
        res.status(500).json({ error: "Failed to update equipment." });
    }
});

// Delete Equipment - Requires can_delete_equipment permission
app.delete('/api/equipment/:equipment_id', authenticateToken, requirePermission('can_delete_equipment'), async (req, res) => {
    const { equipment_id } = req.params;

    try {
        const equipmentId = parseInt(equipment_id);
        const existingEquipment = await prisma.equipment_Inventory.findUnique({
            where: { equipment_id: equipmentId }
        });

        if (!existingEquipment) {
            return res.status(404).json({ error: "Equipment not found." });
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'EQUIPMENT',
                sourceTable: 'Equipment_Inventory',
                recordId: existingEquipment.equipment_id,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from equipment inventory',
                payload: existingEquipment
            });

            await tx.equipment_Inventory.delete({
                where: { equipment_id: equipmentId }
            });
        });

        await checkAndNotifyLowInventory(existingEquipment.name, req, {
            triggered_by: 'equipment_delete',
            actor_user_id: req.user.user_id,
            equipment_id: existingEquipment.equipment_id
        });

        res.json({ message: 'Equipment moved to archives successfully.' });
    } catch (error) {
        console.error("Delete Equipment Error:", error);
        res.status(500).json({ error: "Failed to delete equipment." });
    }
});

// Lookup Equipment by QR Code/Number - All authenticated users
app.get('/api/equipment/qr/:qr_number', authenticateToken, async (req, res) => {
    const { qr_number } = req.params;
    
    try {
        const equipment = await prisma.equipment_Inventory.findUnique({
            where: { qr_number: qr_number.toUpperCase() },
            include: {
                checkouts: {
                    where: { status: 'Checked Out' },
                    include: { user: { select: { full_name: true, email: true } } },
                    orderBy: { checkout_date: 'desc' },
                    take: 1
                }
            }
        });
        
        if (!equipment) {
            return res.status(404).json({ error: "Equipment not found with this QR code" });
        }
        
        res.json({ equipment });
    } catch (error) {
        console.error("Equipment Lookup Error:", error);
        res.status(500).json({ error: "Failed to lookup equipment" });
    }
});

// Checkout Equipment - All authenticated users
app.post('/api/equipment/checkout', authenticateToken, async (req, res) => {
    const { qr_number, location_lat, location_lng, notes } = req.body;
    const userId = req.user.user_id;
    
    if (!qr_number) {
        return res.status(400).json({ error: "QR number is required" });
    }
    
    try {
        // Find equipment by QR number
        const equipment = await prisma.equipment_Inventory.findUnique({
            where: { qr_number: qr_number.toUpperCase() },
            include: {
                checkouts: {
                    where: { status: 'Checked Out' },
                    take: 1
                }
            }
        });
        
        if (!equipment) {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'MEDIUM',
                `Checkout attempted with unknown QR code: ${qr_number}`,
                req,
                { actor_user_id: userId }
            );
            return res.status(404).json({ error: "Equipment not found" });
        }
        
        // Check if equipment is already checked out
        if (equipment.checkouts.length > 0) {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'MEDIUM',
                `Checkout conflict for already checked-out equipment ${equipment.qr_number || equipment.equipment_id}`,
                req,
                {
                    equipment_id: equipment.equipment_id,
                    actor_user_id: userId,
                    current_holder_user_id: equipment.checkouts[0].user_id
                }
            );
            return res.status(400).json({ 
                error: "Equipment is already checked out",
                checkedOutBy: equipment.checkouts[0].user_id
            });
        }
        
        if (equipment.status !== 'Available') {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'MEDIUM',
                `Checkout blocked because equipment status is not Available (${equipment.status})`,
                req,
                { equipment_id: equipment.equipment_id, actor_user_id: userId }
            );
            return res.status(400).json({ 
                error: `Equipment is not available (Status: ${equipment.status})` 
            });
        }
        
        // Create checkout record
        const checkout = await prisma.equipment_Checkout.create({
            data: {
                equipment_id: equipment.equipment_id,
                user_id: userId,
                location_lat: location_lat ? parseFloat(location_lat) : null,
                location_lng: location_lng ? parseFloat(location_lng) : null,
                notes: notes || null,
                status: 'Checked Out'
            },
            include: {
                equipment: true,
                user: { select: { full_name: true, email: true } }
            }
        });
        
        // Update equipment status
        await prisma.equipment_Inventory.update({
            where: { equipment_id: equipment.equipment_id },
            data: { 
                status: 'Checked Out',
                assigned_to: userId,
                current_location: location_lat && location_lng 
                    ? `${parseFloat(location_lat).toFixed(6)}, ${parseFloat(location_lng).toFixed(6)}`
                    : null
            }
        });

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentCheckoutCount = await prisma.equipment_Checkout.count({
            where: {
                user_id: userId,
                checkout_date: { gte: tenMinutesAgo }
            }
        });

        if (recentCheckoutCount >= 3) {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'HIGH',
                `Rapid equipment checkout activity detected for user ${userId}`,
                req,
                { actor_user_id: userId, recent_checkouts_10m: recentCheckoutCount }
            );
        }

        await checkAndNotifyLowInventory(equipment.name, req, {
            triggered_by: 'equipment_checkout',
            actor_user_id: userId,
            equipment_id: equipment.equipment_id
        });
        
        res.json({ 
            message: "Equipment checked out successfully",
            checkout
        });
    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).json({ error: "Failed to checkout equipment" });
    }
});

// Assign equipment to a specific user - Requires can_assign_equipment permission
app.post('/api/equipment/assign', authenticateToken, requirePermission('can_assign_equipment'), async (req, res) => {
    const { equipment_id, user_id, notes } = req.body;
    const actorUserId = req.user.user_id;

    const equipmentId = parseInt(equipment_id, 10);
    const targetUserId = parseInt(user_id, 10);

    if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
        return res.status(400).json({ error: 'Valid equipment_id is required.' });
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'Valid user_id is required.' });
    }

    try {
        const [equipment, targetUser] = await Promise.all([
            prisma.equipment_Inventory.findUnique({
                where: { equipment_id: equipmentId },
                include: {
                    checkouts: {
                        where: { status: 'Checked Out' },
                        take: 1
                    }
                }
            }),
            prisma.user.findUnique({
                where: { user_id: targetUserId },
                select: {
                    user_id: true,
                    full_name: true,
                    email: true,
                    is_active: true
                }
            })
        ]);

        if (!equipment) {
            return res.status(404).json({ error: 'Equipment not found.' });
        }

        if (!targetUser || !targetUser.is_active) {
            return res.status(404).json({ error: 'Target user not found or inactive.' });
        }

        if (equipment.checkouts.length > 0 || equipment.status !== 'Available') {
            return res.status(400).json({ error: `Equipment is not available (Status: ${equipment.status}).` });
        }

        const assignmentNote = notes
            ? `Assigned by user ${actorUserId}: ${String(notes).trim()}`
            : `Assigned by user ${actorUserId}`;

        const checkout = await prisma.equipment_Checkout.create({
            data: {
                equipment_id: equipmentId,
                user_id: targetUserId,
                status: 'Checked Out',
                notes: assignmentNote
            },
            include: {
                equipment: true,
                user: { select: { full_name: true, email: true } }
            }
        });

        await prisma.equipment_Inventory.update({
            where: { equipment_id: equipmentId },
            data: {
                status: 'Checked Out',
                assigned_to: targetUserId
            }
        });

        await checkAndNotifyLowInventory(equipment.name, req, {
            triggered_by: 'equipment_assign',
            actor_user_id: actorUserId,
            equipment_id: equipmentId,
            assigned_to_user_id: targetUserId
        });

        await createNotificationEvent(
            'NOTIFICATION_EQUIPMENT_ASSIGN',
            'LOW',
            'Equipment Assigned',
            `You have been assigned ${equipment.name}.`,
            req,
            {
                notification_type: 'equipment_assign',
                target_user_id: targetUserId,
                target_user_name: targetUser.full_name,
                equipment_id: equipmentId,
                equipment_name: equipment.name,
                qr_number: equipment.qr_number || null,
                assigned_by_user_id: actorUserId,
                assigned_by_name: req.userPermissions?.full_name || null,
                assigned_by_email: req.userPermissions?.email || null,
                notes: notes || null
            }
        );

        res.json({
            message: `Equipment assigned to ${targetUser.full_name}.`,
            checkout
        });
    } catch (error) {
        console.error('Assign Equipment Error:', error);
        res.status(500).json({ error: 'Failed to assign equipment.' });
    }
});

// Return Equipment - All authenticated users
app.post('/api/equipment/return', authenticateToken, async (req, res) => {
    const { qr_number, location_lat, location_lng, notes } = req.body;
    const userId = req.user.user_id;
    
    if (!qr_number) {
        return res.status(400).json({ error: "QR number is required" });
    }
    
    try {
        // Find equipment
        const equipment = await prisma.equipment_Inventory.findUnique({
            where: { qr_number: qr_number.toUpperCase() },
            include: {
                checkouts: {
                    where: { 
                        status: 'Checked Out',
                        user_id: userId
                    },
                    orderBy: { checkout_date: 'desc' },
                    take: 1
                }
            }
        });
        
        if (!equipment) {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'MEDIUM',
                `Return attempted with unknown QR code: ${qr_number}`,
                req,
                { actor_user_id: userId }
            );
            return res.status(404).json({ error: "Equipment not found" });
        }
        
        if (equipment.checkouts.length === 0) {
            await logSiemEvent(
                'SECURITY_EQUIPMENT_ANOMALY',
                'MEDIUM',
                `Return attempted without active checkout ownership for ${equipment.qr_number || equipment.equipment_id}`,
                req,
                { equipment_id: equipment.equipment_id, actor_user_id: userId }
            );
            return res.status(400).json({ 
                error: "No active checkout found for this equipment by you" 
            });
        }
        
        const checkout = equipment.checkouts[0];
        
        // Update checkout record
        await prisma.equipment_Checkout.update({
            where: { checkout_id: checkout.checkout_id },
            data: {
                status: 'Returned',
                return_date: new Date(),
                notes: notes ? `${checkout.notes || ''}\nReturn: ${notes}` : checkout.notes
            }
        });
        
        // Update equipment status
        await prisma.equipment_Inventory.update({
            where: { equipment_id: equipment.equipment_id },
            data: { 
                status: 'Available',
                assigned_to: null,
                current_location: location_lat && location_lng 
                    ? `${parseFloat(location_lat).toFixed(6)}, ${parseFloat(location_lng).toFixed(6)}`
                    : null
            }
        });
        
        res.json({ 
            message: "Equipment returned successfully"
        });
    } catch (error) {
        console.error("Return Error:", error);
        res.status(500).json({ error: "Failed to return equipment" });
    }
});

// Get My Equipment Checkouts - All authenticated users
app.get('/api/equipment/my-checkouts', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    try {
        const checkouts = await prisma.equipment_Checkout.findMany({
            where: { user_id: userId },
            include: {
                equipment: true
            },
            orderBy: { checkout_date: 'desc' }
        });
        
        res.json({ checkouts });
    } catch (error) {
        console.error("Get Checkouts Error:", error);
        res.status(500).json({ error: "Failed to retrieve checkouts" });
    }
});

// Get All Equipment Checkouts - Admin only
app.get('/api/equipment/all-checkouts', authenticateToken, requirePermission('can_view_all_attendance'), async (req, res) => {
    try {
        const checkouts = await prisma.equipment_Checkout.findMany({
            include: {
                equipment: true,
                user: { select: { full_name: true, email: true, contact_number: true } }
            },
            orderBy: { checkout_date: 'desc' }
        });
        
        res.json({ checkouts });
    } catch (error) {
        console.error("Get All Checkouts Error:", error);
        res.status(500).json({ error: "Failed to retrieve checkouts" });
    }
});

// ==========================================
// SECURITY ENDPOINTS
// ==========================================

// Get CSRF Token - Authenticated users only
app.get('/api/csrf-token', authenticateToken, getCsrfTokenEndpoint);

// Security Headers Test Endpoint
app.get('/api/security/headers', (req, res) => {
    res.json({
        message: 'Security headers active',
        headers: {
            'X-Frame-Options': res.getHeader('X-Frame-Options'),
            'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
            'Strict-Transport-Security': res.getHeader('Strict-Transport-Security'),
            'Content-Security-Policy': res.getHeader('Content-Security-Policy')
        }
    });
});

// ==========================================
// ATTENDANCE ROUTES (Granular Permissions)
// ==========================================

// Get Own Attendance - Requires can_view_own_attendance permission
app.get('/api/attendance/me', authenticateToken, requirePermission('can_view_own_attendance'), async (req, res) => {
    try {
        const attendance = await prisma.attendance_Log.findMany({
            where: { user_id: req.user.user_id },
            orderBy: { timestamp: 'desc' }
        });
        res.json({ attendance });
    } catch (error) {
        console.error("Fetch Own Attendance Error:", error);
        res.status(500).json({ error: "Failed to retrieve attendance." });
    }
});

// Get All Attendance - Requires can_view_all_attendance permission
app.get('/api/attendance', authenticateToken, requirePermission('can_view_all_attendance'), async (req, res) => {
    try {
        const attendanceRaw = await prisma.attendance_Log.findMany({
            include: {
                user: {
                    select: { full_name: true, email: true, profile_photo: true, user_id: true }
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        const attendance = attendanceRaw.map(log => ({
            ...log,
            user: log.user
                ? {
                    ...log.user,
                    profile_photo: resolveUserProfilePhoto(log.user.profile_photo, log.user.user_id)
                }
                : null
        }));

        res.json({ attendance });
    } catch (error) {
        console.error("Fetch All Attendance Error:", error);
        res.status(500).json({ error: "Failed to retrieve attendance." });
    }
});

// Get Single Attendance Log (with photo) - Requires can_view_all_attendance permission
app.get('/api/attendance/:log_id', authenticateToken, requirePermission('can_view_all_attendance'), async (req, res) => {
    const { log_id } = req.params;
    
    try {
        const logRaw = await prisma.attendance_Log.findUnique({
            where: { log_id: parseInt(log_id) },
            include: {
                user: {
                    select: { full_name: true, email: true, profile_photo: true, user_id: true }
                }
            }
        });

        if (!logRaw) {
            return res.status(404).json({ error: "Attendance log not found" });
        }

        const log = {
            ...logRaw,
            user: logRaw.user
                ? {
                    ...logRaw.user,
                    profile_photo: resolveUserProfilePhoto(logRaw.user.profile_photo, logRaw.user.user_id)
                }
                : null
        };
        
        res.json(log);
    } catch (error) {
        console.error("Fetch Attendance Log Error:", error);
        res.status(500).json({ error: "Failed to retrieve attendance log." });
    }
});

// Clock In/Out - All authenticated users can log attendance
app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { action, location_lat, location_lng } = req.body;
    
    if (!action || !['clock_in', 'clock_out'].includes(action)) {
        return res.status(400).json({ error: "Valid action required (clock_in or clock_out)." });
    }

    // GPS coordinates are required for attendance logging
    if (!location_lat || !location_lng) {
        return res.status(400).json({ 
            error: "GPS coordinates required",
            message: "Please enable location services to log attendance."
        });
    }

    try {
        const userLat = parseFloat(location_lat);
        const userLon = parseFloat(location_lng);

        // Validate coordinate format
        if (!isValidCoordinates(userLat, userLon)) {
            return res.status(400).json({ 
                error: "Invalid GPS coordinates",
                message: "Location coordinates are invalid. Please try again."
            });
        }

        // Fetch all active construction sites
        const sites = await prisma.construction_Site.findMany({
            where: { is_active: true }
        });

        if (sites.length === 0) {
            return res.status(503).json({ 
                error: "No construction sites configured",
                message: "Please contact administrator to set up construction sites."
            });
        }

        // Find nearest site and check if user is within geo-fence
        const nearestSite = findNearestSite(userLat, userLon, sites);
        const geoFenceCheck = isWithinGeoFence(
            userLat,
            userLon,
            parseFloat(nearestSite.center_lat),
            parseFloat(nearestSite.center_lng),
            nearestSite.geo_fence_radius_meters
        );

        // Reject if outside geo-fence
        if (!geoFenceCheck.isWithinFence) {
            return res.status(403).json({ 
                error: "Outside construction site perimeter",
                message: `You must be within ${geoFenceCheck.radiusMeters} meters of ${nearestSite.site_name} to log attendance.`,
                details: {
                    nearestSite: nearestSite.site_name,
                    yourDistance: `${geoFenceCheck.distance} meters`,
                    requiredDistance: `${geoFenceCheck.radiusMeters} meters`,
                    difference: `${geoFenceCheck.distance - geoFenceCheck.radiusMeters} meters too far`
                }
            });
        }

        // Log attendance with GPS coordinates and photo
        const log = await prisma.attendance_Log.create({
            data: {
                user_id: req.user.user_id,
                action,
                location_lat: userLat,
                location_lng: userLon,
                photo: req.body.photo || null  // Store base64 photo
            }
        });

        res.status(201).json({ 
            message: `${action.replace('_', '-')} recorded successfully.`,
            log,
            geoFence: {
                site: nearestSite.site_name,
                distance: `${geoFenceCheck.distance} meters from site center`,
                withinRadius: true
            }
        });
    } catch (error) {
        console.error("Attendance Log Error:", error);
        res.status(500).json({ error: "Failed to log attendance." });
    }
});

// Edit Attendance - Requires can_edit_attendance permission
app.put('/api/attendance/:log_id', authenticateToken, requirePermission('can_edit_attendance'), async (req, res) => {
    const { log_id } = req.params;
    const { action, timestamp } = req.body;

    try {
        const updatedLog = await prisma.attendance_Log.update({
            where: { log_id: parseInt(log_id) },
            data: { action, timestamp: timestamp ? new Date(timestamp) : undefined }
        });
        res.json({ message: "Attendance updated successfully.", log: updatedLog });
    } catch (error) {
        console.error("Update Attendance Error:", error);
        res.status(500).json({ error: "Failed to update attendance." });
    }
});

// Delete Attendance - Requires can_delete_attendance permission
app.delete('/api/attendance/:log_id', authenticateToken, requirePermission('can_delete_attendance'), async (req, res) => {
    const { log_id } = req.params;

    try {
        const attendanceLogId = parseInt(log_id);
        const existingLog = await prisma.attendance_Log.findUnique({
            where: { log_id: attendanceLogId }
        });

        if (!existingLog) {
            return res.status(404).json({ error: 'Attendance record not found.' });
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'ATTENDANCE_LOG',
                sourceTable: 'Attendance_Log',
                recordId: existingLog.log_id,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from attendance management',
                payload: existingLog
            });

            await tx.attendance_Log.delete({
                where: { log_id: attendanceLogId }
            });
        });

        res.json({ message: 'Attendance record moved to archives successfully.' });
    } catch (error) {
        console.error("Delete Attendance Error:", error);
        res.status(500).json({ error: "Failed to delete attendance." });
    }
});

// ==========================================
// CONSTRUCTION SITE MANAGEMENT (Geo-Fencing)
// ==========================================

// Get All Construction Sites
app.get('/api/sites', authenticateToken, async (req, res) => {
    try {
        const sites = await prisma.construction_Site.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.json(sites);
    } catch (error) {
        console.error("Get Sites Error:", error);
        res.status(500).json({ error: "Failed to fetch construction sites." });
    }
});

// Get Active Construction Sites (for attendance geo-fence checks)
app.get('/api/sites/active', authenticateToken, async (req, res) => {
    try {
        const sites = await prisma.construction_Site.findMany({
            where: { is_active: true },
            orderBy: { site_name: 'asc' }
        });
        res.json(sites);
    } catch (error) {
        console.error("Get Active Sites Error:", error);
        res.status(500).json({ error: "Failed to fetch active sites." });
    }
});

// Create Construction Site - Admin only
app.post('/api/sites', authenticateToken, requirePermission('can_manage_permissions'), async (req, res) => {
    const { site_name, site_address, center_lat, center_lng, geo_fence_radius_meters } = req.body;

    // Validation
    if (!site_name || !center_lat || !center_lng) {
        return res.status(400).json({ 
            error: "Missing required fields",
            message: "Site name, latitude, and longitude are required."
        });
    }

    const lat = parseFloat(center_lat);
    const lng = parseFloat(center_lng);

    if (!isValidCoordinates(lat, lng)) {
        return res.status(400).json({ 
            error: "Invalid coordinates",
            message: "Please provide valid latitude and longitude values."
        });
    }

    const radius = geo_fence_radius_meters ? parseInt(geo_fence_radius_meters) : 100;

    if (radius < 10 || radius > 10000) {
        return res.status(400).json({ 
            error: "Invalid radius",
            message: "Geo-fence radius must be between 10 and 10,000 meters."
        });
    }

    try {
        const site = await prisma.construction_Site.create({
            data: {
                site_name,
                site_address: site_address || null,
                center_lat: lat,
                center_lng: lng,
                geo_fence_radius_meters: radius
            }
        });
        
        res.status(201).json({ 
            message: "Construction site created successfully.",
            site
        });
    } catch (error) {
        console.error("Create Site Error:", error);
        res.status(500).json({ error: "Failed to create construction site." });
    }
});

// Update Construction Site - Admin only
app.put('/api/sites/:site_id', authenticateToken, requirePermission('can_manage_permissions'), async (req, res) => {
    const { site_id } = req.params;
    const { site_name, site_address, center_lat, center_lng, geo_fence_radius_meters, is_active } = req.body;

    const updateData = {};

    if (site_name !== undefined) updateData.site_name = site_name;
    if (site_address !== undefined) updateData.site_address = site_address;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (center_lat !== undefined && center_lng !== undefined) {
        const lat = parseFloat(center_lat);
        const lng = parseFloat(center_lng);

        if (!isValidCoordinates(lat, lng)) {
            return res.status(400).json({ 
                error: "Invalid coordinates",
                message: "Please provide valid latitude and longitude values."
            });
        }

        updateData.center_lat = lat;
        updateData.center_lng = lng;
    }

    if (geo_fence_radius_meters !== undefined) {
        const radius = parseInt(geo_fence_radius_meters);
        if (radius < 10 || radius > 10000) {
            return res.status(400).json({ 
                error: "Invalid radius",
                message: "Geo-fence radius must be between 10 and 10,000 meters."
            });
        }
        updateData.geo_fence_radius_meters = radius;
    }

    try {
        const site = await prisma.construction_Site.update({
            where: { site_id: parseInt(site_id) },
            data: updateData
        });
        
        res.json({ 
            message: "Construction site updated successfully.",
            site
        });
    } catch (error) {
        console.error("Update Site Error:", error);
        res.status(500).json({ error: "Failed to update construction site." });
    }
});

// Delete Construction Site - Admin only
app.delete('/api/sites/:site_id', authenticateToken, requirePermission('can_manage_permissions'), async (req, res) => {
    const { site_id } = req.params;

    try {
        const siteId = parseInt(site_id);
        const existingSite = await prisma.construction_Site.findUnique({
            where: { site_id: siteId }
        });

        if (!existingSite) {
            return res.status(404).json({ error: 'Construction site not found.' });
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'CONSTRUCTION_SITE',
                sourceTable: 'Construction_Site',
                recordId: existingSite.site_id,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from geo-fencing site management',
                payload: existingSite
            });

            await tx.construction_Site.delete({
                where: { site_id: siteId }
            });
        });
        
        res.json({ message: 'Construction site moved to archives successfully.' });
    } catch (error) {
        console.error("Delete Site Error:", error);
        res.status(500).json({ error: "Failed to delete construction site." });
    }
});

// Check if coordinates are within any active site (utility endpoint)
app.post('/api/sites/check-location', authenticateToken, async (req, res) => {
    const { location_lat, location_lng } = req.body;

    if (!location_lat || !location_lng) {
        return res.status(400).json({ 
            error: "GPS coordinates required"
        });
    }

    const userLat = parseFloat(location_lat);
    const userLon = parseFloat(location_lng);

    if (!isValidCoordinates(userLat, userLon)) {
        return res.status(400).json({ 
            error: "Invalid GPS coordinates"
        });
    }

    try {
        const sites = await prisma.construction_Site.findMany({
            where: { is_active: true }
        });

        if (sites.length === 0) {
            return res.json({ 
                withinSite: false,
                message: "No active construction sites configured."
            });
        }

        const nearestSite = findNearestSite(userLat, userLon, sites);
        const geoFenceCheck = isWithinGeoFence(
            userLat,
            userLon,
            parseFloat(nearestSite.center_lat),
            parseFloat(nearestSite.center_lng),
            nearestSite.geo_fence_radius_meters
        );

        res.json({
            withinSite: geoFenceCheck.isWithinFence,
            nearestSite: {
                site_id: nearestSite.site_id,
                site_name: nearestSite.site_name,
                distance: geoFenceCheck.distance,
                radiusMeters: geoFenceCheck.radiusMeters,
                message: geoFenceCheck.isWithinFence 
                    ? `You are within ${nearestSite.site_name}` 
                    : `You are ${geoFenceCheck.distance - geoFenceCheck.radiusMeters} meters outside ${nearestSite.site_name}`
            }
        });
    } catch (error) {
        console.error("Check Location Error:", error);
        res.status(500).json({ error: "Failed to check location." });
    }
});

// ==========================================
// PROJECT FILES ROUTES (Granular Permissions + Cloudinary)
// ==========================================

// Get All Files - Requires can_view_files permission
app.get('/api/files', authenticateToken, requirePermission('can_view_files'), async (req, res) => {
    try {
        const files = await prisma.project_File.findMany({
            include: {
                uploader: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { uploaded_at: 'desc' }
        });
        res.json({ files });
    } catch (error) {
        console.error("Fetch Files Error:", error);
        res.status(500).json({ error: "Failed to retrieve files." });
    }
});

// Sync Cloudinary folder assets into Project_File records
app.post('/api/files/sync-cloudinary', authenticateToken, requirePermission('can_upload_files'), async (req, res) => {
    try {
        const prefix = 'cicj-shcoms/project-files';
        const cloudinaryAssets = [];
        let nextCursor = undefined;

        do {
            const response = await cloudinary.api.resources({
                type: 'upload',
                resource_type: 'image',
                prefix,
                max_results: 100,
                next_cursor: nextCursor
            });

            const resources = Array.isArray(response?.resources) ? response.resources : [];
            cloudinaryAssets.push(...resources);
            nextCursor = response?.next_cursor;
        } while (nextCursor);

        const existingCloudFiles = await prisma.project_File.findMany({
            where: { storage_location: 'CLOUD' },
            select: {
                cloudinary_public_id: true,
                cloudinary_url: true
            }
        });

        const existingPublicIds = new Set(
            existingCloudFiles
                .map(file => String(file.cloudinary_public_id || '').trim())
                .filter(Boolean)
        );
        const existingUrls = new Set(
            existingCloudFiles
                .map(file => String(file.cloudinary_url || '').trim())
                .filter(Boolean)
        );

        const recordsToCreate = cloudinaryAssets
            .filter(asset => {
                const publicId = String(asset?.public_id || '').trim();
                const secureUrl = String(asset?.secure_url || '').trim();
                if (!publicId || !secureUrl) return false;
                return !existingPublicIds.has(publicId) && !existingUrls.has(secureUrl);
            })
            .map(asset => {
                const publicId = String(asset.public_id || '').trim();
                const secureUrl = String(asset.secure_url || '').trim();
                const format = String(asset.format || '').toLowerCase();
                const originalFilename = String(asset.filename || '').trim();
                const fallbackFilename = publicId.split('/').pop() || `cloudinary_${Date.now()}`;
                const baseName = originalFilename || fallbackFilename;
                const fileName = format && !baseName.toLowerCase().endsWith(`.${format}`)
                    ? `${baseName}.${format}`
                    : baseName;
                const fileType = format ? `image/${format}` : 'image/*';
                const fileSizeMb = Number(((Number(asset.bytes) || 0) / (1024 * 1024)).toFixed(2));

                return {
                    uploader_id: req.user.user_id,
                    file_name: fileName,
                    file_type: fileType,
                    file_size_mb: fileSizeMb,
                    storage_location: 'CLOUD',
                    cloudinary_url: secureUrl,
                    cloudinary_public_id: publicId,
                    local_ftp_path: null
                };
            });

        let imported = 0;
        if (recordsToCreate.length > 0) {
            const createResult = await prisma.project_File.createMany({
                data: recordsToCreate
            });
            imported = Number(createResult?.count || 0);
        }

        res.json({
            message: imported > 0
                ? `Imported ${imported} Cloudinary file${imported === 1 ? '' : 's'}.`
                : 'No new Cloudinary files found to import.',
            stats: {
                scanned: cloudinaryAssets.length,
                imported,
                skipped: Math.max(cloudinaryAssets.length - imported, 0),
                folder: prefix
            }
        });
    } catch (error) {
        console.error('Cloudinary Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync Cloudinary files.' });
    }
});

// Storage Summary - Cloudinary + Local FTP + Project DB totals
app.get('/api/files/storage-summary', authenticateToken, requirePermission('can_view_files'), async (req, res) => {
    try {
        const fileRows = await prisma.project_File.findMany({
            select: {
                storage_location: true,
                file_size_mb: true
            }
        });

        const projectCloudMb = fileRows
            .filter(f => f.storage_location === 'CLOUD')
            .reduce((sum, f) => sum + (Number(f.file_size_mb) || 0), 0);

        const projectFtpMb = fileRows
            .filter(f => f.storage_location === 'LOCAL_FTP')
            .reduce((sum, f) => sum + (Number(f.file_size_mb) || 0), 0);

        const projectTotalMb = projectCloudMb + projectFtpMb;

        let cloudinaryAccountMb = 0;
        try {
            const usage = await cloudinary.api.usage();
            cloudinaryAccountMb = ((usage?.storage?.used_bytes || 0) / (1024 * 1024));
        } catch (cloudErr) {
            console.warn('Cloudinary usage lookup warning:', cloudErr.message);
        }

        const ftpRoot = process.env.LOCAL_FTP_ROOT || path.join(__dirname, '..', 'ftp-storage');
        const localFtpDiskMb = getDirectorySizeBytes(ftpRoot) / (1024 * 1024);

        res.json({
            summary: {
                project: {
                    file_count: fileRows.length,
                    cloudinary_mb: Number(projectCloudMb.toFixed(2)),
                    local_ftp_mb: Number(projectFtpMb.toFixed(2)),
                    total_mb: Number(projectTotalMb.toFixed(2))
                },
                platform: {
                    cloudinary_mb: Number(cloudinaryAccountMb.toFixed(2)),
                    local_ftp_mb: Number(localFtpDiskMb.toFixed(2)),
                    total_mb: Number((cloudinaryAccountMb + localFtpDiskMb).toFixed(2))
                }
            }
        });
    } catch (error) {
        console.error('Storage Summary Error:', error);
        res.status(500).json({ error: 'Failed to retrieve storage summary.' });
    }
});

// Upload File - Supports images (→ Cloudinary) and documents (→ LOCAL_FTP metadata)
app.post('/api/files',
    authenticateToken,
    requirePermission('can_upload_files'),
    fileUpload.single('file'),
    async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided. Send a 'file' field in multipart/form-data." });
        }

        const { originalname, mimetype, size, buffer } = req.file;
        const fileSizeMb = parseFloat((size / (1024 * 1024)).toFixed(2));
        const storageLocation = resolveStorageLocation(mimetype, size);

        try {
            let cloudinaryUrl = null;
            let cloudinaryPublicId = null;
            let localFtpPath = null;

            if (storageLocation === 'CLOUD') {
                // Upload image to Cloudinary with auto optimization
                const result = await uploadToCloudinary(buffer, {
                    folder: 'cicj-shcoms/project-files',
                    resource_type: 'image',
                    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
                    public_id: `project_${Date.now()}_${originalname.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_')}`
                });
                cloudinaryUrl = result.secure_url;
                cloudinaryPublicId = result.public_id;
            } else {
                // Large files / documents → LOCAL_FTP path placeholder
                localFtpPath = `/ftp/project-files/${Date.now()}_${originalname}`;
            }

            const newFile = await prisma.project_File.create({
                data: {
                    file_name: originalname,
                    file_type: mimetype,
                    file_size_mb: fileSizeMb,
                    storage_location: storageLocation,
                    cloudinary_url: cloudinaryUrl,
                    cloudinary_public_id: cloudinaryPublicId,
                    local_ftp_path: localFtpPath,
                    uploader_id: req.user.user_id
                }
            });

            await notifyAdmins(
                'NOTIFICATION_FILE_UPLOAD',
                'LOW',
                'New Project File Uploaded',
                `${req.userPermissions?.full_name || 'A user'} uploaded "${originalname}" (${fileSizeMb} MB) to ${storageLocation}.`,
                req,
                {
                    file_id: newFile.file_id,
                    file_name: originalname,
                    storage_location: storageLocation,
                    uploader_id: req.user.user_id
                },
                `File Uploaded: ${originalname}`
            );

            res.status(201).json({
                message: "File uploaded successfully.",
                file: newFile,
                storage: storageLocation,
                url: cloudinaryUrl || localFtpPath
            });
        } catch (error) {
            console.error("Upload File Error:", error);
            res.status(500).json({ error: "Failed to upload file." });
        }
    }
);

// Get single file / download info
app.get('/api/files/:file_id/download', authenticateToken, requirePermission('can_download_files'), async (req, res) => {
    const { file_id } = req.params;
    try {
        const file = await prisma.project_File.findUnique({
            where: { file_id: parseInt(file_id) }
        });
        if (!file) return res.status(404).json({ error: "File not found." });

        res.json({
            message: "File ready.",
            file: {
                file_id: file.file_id,
                file_name: file.file_name,
                file_type: file.file_type,
                file_size_mb: file.file_size_mb,
                storage_location: file.storage_location,
                url: file.cloudinary_url || file.local_ftp_path,
                cloudinary_url: file.cloudinary_url,
                local_ftp_path: file.local_ftp_path
            }
        });
    } catch (error) {
        console.error("Download File Error:", error);
        res.status(500).json({ error: "Failed to retrieve file." });
    }
});

// Edit File Metadata - Requires can_edit_files permission
app.put('/api/files/:file_id', authenticateToken, requirePermission('can_edit_files'), async (req, res) => {
    const { file_id } = req.params;
    const { file_name } = req.body;
    try {
        const updatedFile = await prisma.project_File.update({
            where: { file_id: parseInt(file_id) },
            data: { file_name }
        });
        res.json({ message: "File metadata updated successfully.", file: updatedFile });
    } catch (error) {
        console.error("Update File Error:", error);
        res.status(500).json({ error: "Failed to update file." });
    }
});

// Delete File - Also removes from Cloudinary if stored there
app.delete('/api/files/:file_id', authenticateToken, requirePermission('can_delete_files'), async (req, res) => {
    const { file_id } = req.params;
    try {
        const fileId = parseInt(file_id);
        const file = await prisma.project_File.findUnique({
            where: { file_id: fileId }
        });
        if (!file) return res.status(404).json({ error: "File not found." });

        // Remove from Cloudinary if applicable
        if (file.cloudinary_public_id) {
            await deleteFromCloudinary(file.cloudinary_public_id, 'image').catch(err =>
                console.warn("Cloudinary delete warning:", err.message)
            );
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'PROJECT_FILE',
                sourceTable: 'Project_File',
                recordId: file.file_id,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from project files',
                payload: file
            });

            await tx.project_File.delete({ where: { file_id: fileId } });
        });

        res.json({ message: 'File moved to archives successfully.' });
    } catch (error) {
        console.error("Delete File Error:", error);
        res.status(500).json({ error: "Failed to delete file." });
    }
});

// ==========================================
// EQUIPMENT PHOTO UPLOAD (Cloudinary)
// ==========================================

// Upload / replace equipment photo
app.post('/api/equipment/:equipment_id/photo',
    authenticateToken,
    requirePermission('can_edit_equipment'),
    imageUpload.single('photo'),
    async (req, res) => {
        const { equipment_id } = req.params;
        if (!req.file) {
            return res.status(400).json({ error: "No photo provided. Send a 'photo' field in multipart/form-data." });
        }

        try {
            const equipment = await prisma.equipment_Inventory.findUnique({
                where: { equipment_id: parseInt(equipment_id) }
            });
            if (!equipment) return res.status(404).json({ error: "Equipment not found." });

            // Delete old photo from Cloudinary if one exists
            if (equipment.photo_public_id) {
                await deleteFromCloudinary(equipment.photo_public_id, 'image').catch(err =>
                    console.warn("Cloudinary delete old photo warning:", err.message)
                );
            }

            const result = await uploadToCloudinary(req.file.buffer, {
                folder: 'cicj-shcoms/equipment',
                resource_type: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' }],
                public_id: `equipment_${equipment.qr_number || equipment_id}_${Date.now()}`
            });

            const updated = await prisma.equipment_Inventory.update({
                where: { equipment_id: parseInt(equipment_id) },
                data: {
                    photo_url: result.secure_url,
                    photo_public_id: result.public_id
                }
            });

            res.json({
                message: "Equipment photo uploaded successfully.",
                photo_url: result.secure_url,
                equipment
            });
        } catch (error) {
            console.error("Equipment Photo Upload Error:", error);
            res.status(500).json({ error: "Failed to upload equipment photo." });
        }
    }
);

// ==========================================
// CLIENT INQUIRIES ROUTES (Granular Permissions)
// ==========================================

// Public inquiry submission rate limiter (stricter – no auth guarding it)
const publicInquiryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 submissions per IP per hour
    message: { error: 'Too many inquiry submissions. Please try again later.' }
});

// Submit Inquiry from Public Client Page (no auth required)
app.post('/api/inquiries/public', publicInquiryLimiter, async (req, res) => {
    const { client_name, client_email, phone_number, subject, message, recaptchaToken } = req.body;
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

    if (!recaptchaSecret) {
        return res.status(500).json({ error: 'Server misconfiguration. Please try again later.' });
    }
    if (!recaptchaToken) {
        return res.status(400).json({ error: 'Please complete the reCAPTCHA check.' });
    }

    try {
        const verifyPayload = new URLSearchParams({
            secret: recaptchaSecret,
            response: recaptchaToken,
            remoteip: req.ip
        });

        const verifyRes = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            verifyPayload,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 8000
            }
        );

        if (!verifyRes?.data?.success) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed. Please try again.' });
        }
    } catch (error) {
        console.error('reCAPTCHA Verify Error:', error);
        return res.status(500).json({ error: 'reCAPTCHA verification failed. Please try again.' });
    }

    if (!client_name || !client_email || !subject || !message) {
        return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    if (String(client_name).trim().length < 2 || String(client_name).trim().length > 100) {
        return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(client_email).trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(message).trim().length < 10) {
        return res.status(400).json({ error: 'Message must be at least 10 characters.' });
    }

    try {
        const newInquiry = await prisma.client_Inquiry.create({
            data: {
                client_name: String(client_name).trim(),
                client_email: String(client_email).trim().toLowerCase(),
                contact_number: phone_number ? String(phone_number).trim() : null,
                subject: String(subject).trim(),
                message_body: String(message).trim(),
                status: 'Pending'
            }
        });

        notifyAdmins(
            'NOTIFICATION_NEW_INQUIRY',
            'MEDIUM',
            'New Client Inquiry Submitted',
            `New inquiry from ${client_name} (${client_email}) submitted via the client page.`,
            req,
            { inquiry_id: newInquiry.inquiry_id, client_name, client_email, submitted_status: 'Pending' },
            `New Inquiry: ${client_name}`
        ).catch((notifyErr) => {
            console.warn('Notification warning (non-fatal):', notifyErr.message);
        });

        res.status(201).json({ message: 'Inquiry submitted successfully.', inquiry_id: newInquiry.inquiry_id });
    } catch (error) {
        console.error('Public Submit Inquiry Error:', error);
        res.status(500).json({ error: 'Failed to submit your inquiry. Please try again.' });
    }
});

// Get All Inquiries - Requires can_view_inquiries permission
app.get('/api/inquiries', authenticateToken, requirePermission('can_view_inquiries'), async (req, res) => {
    try {
        const inquiries = await prisma.client_Inquiry.findMany({
            include: {
                manager: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true
                    }
                }
            },
            orderBy: { submitted_at: 'desc' }
        });
        res.json({ inquiries });
    } catch (error) {
        console.error("Fetch Inquiries Error:", error);
        res.status(500).json({ error: "Failed to retrieve inquiries." });
    }
});

// Submit New Inquiry - Requires can_add_inquiries permission
app.post('/api/inquiries', authenticateToken, requirePermission('can_add_inquiries'), async (req, res) => {
    const { client_name, client_email, subject, message, status } = req.body;
    
    if (!client_name || !client_email || !subject || !message) {
        return res.status(400).json({ error: "Client name, email, subject, and message are required." });
    }

    try {
        const newInquiry = await prisma.client_Inquiry.create({
            data: {
                client_name,
                client_email,
                subject,
                message_body: message,
                status: status || 'Pending'
            }
        });

        await notifyAdmins(
            'NOTIFICATION_NEW_INQUIRY',
            'MEDIUM',
            'New Client Inquiry Submitted',
            `New inquiry from ${client_name} (${client_email}) has been submitted.`,
            req,
            {
                inquiry_id: newInquiry.inquiry_id,
                client_name,
                client_email,
                submitted_status: status || 'Pending'
            },
            `New Inquiry: ${client_name}`
        );

        res.status(201).json({ message: "Inquiry submitted successfully.", inquiry: newInquiry });
    } catch (error) {
        console.error("Submit Inquiry Error:", error);
        res.status(500).json({ error: "Failed to submit inquiry." });
    }
});

// Get assignable users for inquiry assignment - Requires can_assign_inquiries permission
app.get('/api/inquiries/assignable-users', authenticateToken, requirePermission('can_assign_inquiries'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: {
                is_active: true,
                role: 'EMPLOYEE'
            },
            select: {
                user_id: true,
                full_name: true,
                email: true
            },
            orderBy: { full_name: 'asc' }
        });

        res.json({ users });
    } catch (error) {
        console.error('Get Assignable Inquiry Users Error:', error);
        res.status(500).json({ error: 'Failed to retrieve assignable inquiry users.' });
    }
});

// Assign inquiry to team member - Requires can_assign_inquiries permission
app.post('/api/inquiries/:inquiry_id/assign', authenticateToken, requirePermission('can_assign_inquiries'), async (req, res) => {
    const inquiryId = Number.parseInt(req.params.inquiry_id, 10);
    const handledBy = Number.parseInt(req.body?.handled_by, 10);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
        return res.status(400).json({ error: 'Valid inquiry ID is required.' });
    }

    if (!Number.isFinite(handledBy) || handledBy <= 0) {
        return res.status(400).json({ error: 'Valid assignee user ID is required.' });
    }

    try {
        const [inquiry, assignee] = await Promise.all([
            prisma.client_Inquiry.findUnique({
                where: { inquiry_id: inquiryId }
            }),
            prisma.user.findFirst({
                where: {
                    user_id: handledBy,
                    is_active: true,
                    role: 'EMPLOYEE'
                },
                select: {
                    user_id: true,
                    full_name: true,
                    email: true
                }
            })
        ]);

        if (!inquiry) {
            return res.status(404).json({ error: 'Inquiry not found.' });
        }

        if (!assignee) {
            return res.status(400).json({ error: 'Selected user is not an active assignable employee.' });
        }

        const nextStatus = String(inquiry.status || '') === 'Pending' ? 'In Progress' : inquiry.status;
        const updatedInquiry = await prisma.client_Inquiry.update({
            where: { inquiry_id: inquiryId },
            data: {
                handled_by: handledBy,
                status: nextStatus
            },
            include: {
                manager: {
                    select: {
                        user_id: true,
                        full_name: true,
                        email: true
                    }
                }
            }
        });

        await createNotificationEvent(
            'NOTIFICATION_INQUIRY_ASSIGN',
            'LOW',
            'Inquiry Assigned',
            `A new inquiry has been assigned to you.`,
            req,
            {
                notification_type: 'inquiry_assign',
                target_user_id: assignee.user_id,
                target_user_name: assignee.full_name,
                inquiry_id: inquiryId,
                subject: inquiry.subject || null,
                client_name: inquiry.client_name || null,
                client_email: inquiry.client_email || null,
                message_body: inquiry.message_body || null,
                assigned_by_user_id: req.user.user_id,
                assigned_by_name: req.userPermissions?.full_name || null,
                assigned_by_email: req.userPermissions?.email || null,
                next_status: updatedInquiry.status || null
            }
        );

        res.json({
            message: `Inquiry assigned to ${assignee.full_name}.`,
            inquiry: updatedInquiry
        });
    } catch (error) {
        console.error('Assign Inquiry Error:', error);
        res.status(500).json({ error: 'Failed to assign inquiry.' });
    }
});

// Notification feed for in-system alerts
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 25;
        const scope = String(req.query.scope || '').toLowerCase();

        const logs = await prisma.system_Health_Log.findMany({
            where: {
                event_type: {
                    startsWith: 'NOTIFICATION_'
                }
            },
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let notifications = logs.map(log => {
            const severityMatch = String(log.description || '').match(/\[NOTIFICATION\]\[(LOW|MEDIUM|HIGH)\]/i);
            const context = extractNotificationContext(log.description || '');
            return {
                id: log.sys_log_id,
                event_type: log.event_type,
                severity: (severityMatch?.[1] || 'LOW').toUpperCase(),
                description: log.description,
                ip_address: log.ip_address,
                timestamp: log.timestamp,
                context
            };
        });

        const targetUserId = Number(req.user?.user_id || 0);
        const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';
        const canManageEquipment = Boolean(req.userPermissions?.can_manage_equipment);

        notifications = notifications.filter(item => {
            const context = item.context || {};
            const isTargeted = Number(context.target_user_id || 0) === targetUserId;
            const isLowInventory = String(context.notification_type || '').toLowerCase() === 'low_inventory';
            const hasEquipmentAccess = isAdmin || canManageEquipment;
            return isTargeted || (isLowInventory && hasEquipmentAccess);
        });

        const unreadCount = notifications.filter(item => new Date(item.timestamp) >= twentyFourHoursAgo).length;

        res.json({
            notifications,
            unread_count: unreadCount
        });
    } catch (error) {
        console.error('Fetch Notifications Error:', error);
        res.status(500).json({ error: 'Failed to retrieve notifications.' });
    }
});

// Update Inquiry Status - Requires can_update_inquiries permission
app.put('/api/inquiries/:inquiry_id', authenticateToken, requirePermission('can_update_inquiries'), async (req, res) => {
    const { inquiry_id } = req.params;
    const { status } = req.body;

    if (!status || !['Pending', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
        return res.status(400).json({ error: "Valid status required (Pending, In Progress, Resolved, Closed)." });
    }

    try {
        const updatedInquiry = await prisma.client_Inquiry.update({
            where: { inquiry_id: parseInt(inquiry_id) },
            data: { status }
        });
        res.json({ message: "Inquiry updated successfully.", inquiry: updatedInquiry });
    } catch (error) {
        console.error("Update Inquiry Error:", error);
        res.status(500).json({ error: "Failed to update inquiry." });
    }
});

// Delete Inquiry - Requires can_delete_inquiries permission
app.delete('/api/inquiries/:inquiry_id', authenticateToken, requirePermission('can_delete_inquiries'), async (req, res) => {
    const { inquiry_id } = req.params;

    try {
        const inquiryId = parseInt(inquiry_id);
        const existingInquiry = await prisma.client_Inquiry.findUnique({
            where: { inquiry_id: inquiryId }
        });

        if (!existingInquiry) {
            return res.status(404).json({ error: 'Inquiry not found.' });
        }

        const archiveActor = getArchiveActorFromRequest(req);
        const deletedIp = getClientIp(req);

        await prisma.$transaction(async (tx) => {
            await archiveDeletedRecord(tx, {
                entityType: 'CLIENT_INQUIRY',
                sourceTable: 'Client_Inquiry',
                recordId: existingInquiry.inquiry_id,
                ...archiveActor,
                deletedIp,
                deleteReason: 'Deleted from client inquiries',
                payload: existingInquiry
            });

            await tx.client_Inquiry.delete({
                where: { inquiry_id: inquiryId }
            });
        });

        res.json({ message: 'Inquiry moved to archives successfully.' });
    } catch (error) {
        console.error("Delete Inquiry Error:", error);
        res.status(500).json({ error: "Failed to delete inquiry." });
    }
});

// ==========================================
// ADMIN REPORTS (CSV/PDF)
// ==========================================

function resolveReportFormat(req, res) {
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!['csv', 'pdf'].includes(format)) {
        res.status(400).json({ error: 'Invalid format. Use csv or pdf.' });
        return null;
    }
    return format;
}

// Weekly Attendance Logs Report
app.get('/api/reports/attendance', authenticateToken, requirePermission('can_export_attendance'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 7);
        const logs = await prisma.attendance_Log.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                user: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['Timestamp', 'Employee', 'Email', 'Action', 'Latitude', 'Longitude'];
        const rows = logs.map(log => [
            formatDateTime(log.timestamp),
            log.user?.full_name || 'Unknown',
            log.user?.email || '-',
            log.action,
            log.location_lat ?? '',
            log.location_lng ?? ''
        ]);

        const fileName = `weekly_attendance_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total logs: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Weekly Attendance Logs',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Weekly Attendance Logs', headers, rows, summary);
    } catch (error) {
        console.error('Attendance report error:', error);
        res.status(500).json({ error: 'Failed to generate attendance report.' });
    }
});

// Equipment Usage History Report
app.get('/api/reports/equipment-usage', authenticateToken, requirePermission('can_view_equipment'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const checkouts = await prisma.equipment_Checkout.findMany({
            where: {
                checkout_date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                equipment: {
                    select: { name: true, qr_number: true }
                },
                user: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { checkout_date: 'desc' }
        });

        const headers = ['Checkout Date', 'Return Date', 'Equipment', 'QR Number', 'User', 'Status', 'Notes'];
        const rows = checkouts.map(record => [
            formatDateTime(record.checkout_date),
            formatDateTime(record.return_date),
            record.equipment?.name || 'Unknown',
            record.equipment?.qr_number || '-',
            record.user?.full_name || 'Unknown',
            record.status,
            record.notes || ''
        ]);

        const fileName = `equipment_usage_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total checkout records: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Equipment Usage History',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Equipment Usage History', headers, rows, summary);
    } catch (error) {
        console.error('Equipment usage report error:', error);
        res.status(500).json({ error: 'Failed to generate equipment usage report.' });
    }
});

// Inquiry Resolution Statistics Report
app.get('/api/reports/inquiry-resolution', authenticateToken, requirePermission('can_view_inquiries'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const inquiries = await prisma.client_Inquiry.findMany({
            where: {
                submitted_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { submitted_at: 'desc' }
        });

        const statusCounts = {
            Pending: 0,
            'In Progress': 0,
            Resolved: 0,
            Closed: 0
        };

        inquiries.forEach(inquiry => {
            if (statusCounts[inquiry.status] !== undefined) {
                statusCounts[inquiry.status] += 1;
            }
        });

        const total = inquiries.length;
        const resolvedClosed = statusCounts.Resolved + statusCounts.Closed;
        const resolutionRate = total === 0 ? 0 : ((resolvedClosed / total) * 100).toFixed(2);

        const headers = ['Metric', 'Value'];
        const rows = [
            ['Total Inquiries', total],
            ['Pending', statusCounts.Pending],
            ['In Progress', statusCounts['In Progress']],
            ['Resolved', statusCounts.Resolved],
            ['Closed', statusCounts.Closed],
            ['Resolved/Closed Rate (%)', resolutionRate]
        ];

        const fileName = `inquiry_resolution_stats_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Resolution rate: ${resolutionRate}%`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Inquiry Resolution Statistics',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Inquiry Resolution Statistics', headers, rows, summary);
    } catch (error) {
        console.error('Inquiry stats report error:', error);
        res.status(500).json({ error: 'Failed to generate inquiry resolution report.' });
    }
});

// Users Directory Report
app.get('/api/reports/users-directory', authenticateToken, requirePermission('can_view_users'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 90);
        const users = await prisma.user.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const headers = ['User ID', 'Name', 'Email', 'Role', 'Contact', 'Status', 'Created At'];
        const rows = users.map(user => [
            user.user_id,
            user.full_name,
            user.email,
            user.role,
            user.contact_number || '',
            user.is_active ? 'Active' : 'Inactive',
            formatDateTime(user.created_at)
        ]);

        const activeCount = users.filter(user => user.is_active).length;
        const fileName = `users_directory_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total users: ${rows.length}`,
            `Active users: ${activeCount}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Users Directory',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Users Directory', headers, rows, summary);
    } catch (error) {
        console.error('Users directory report error:', error);
        res.status(500).json({ error: 'Failed to generate users directory report.' });
    }
});

// User Access Matrix Report
app.get('/api/reports/user-access', authenticateToken, requirePermission('can_manage_permissions'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const users = await prisma.user.findMany({ orderBy: { created_at: 'desc' } });

        const permissionKeys = [
            'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
            'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
            'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
            'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
            'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
            'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database'
        ];

        const headers = ['User ID', 'Name', 'Email', 'Role', 'Status', ...permissionKeys];
        const rows = users.map(user => [
            user.user_id,
            user.full_name,
            user.email,
            user.role,
            user.is_active ? 'Active' : 'Inactive',
            ...permissionKeys.map(key => (user[key] ? 'Yes' : 'No'))
        ]);

        const fileName = `user_access_matrix_${new Date().toISOString().slice(0, 10)}`;
        const summary = [`Total users: ${rows.length}`];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'User Access Matrix',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'User Access Matrix', headers, rows, summary);
    } catch (error) {
        console.error('User access report error:', error);
        res.status(500).json({ error: 'Failed to generate user access report.' });
    }
});

// Equipment Inventory Report
app.get('/api/reports/equipment-inventory', authenticateToken, requirePermission('can_view_equipment'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 90);
        const equipment = await prisma.equipment_Inventory.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const headers = ['Equipment ID', 'Name', 'QR Number', 'Quantity', 'Condition', 'Status', 'Location', 'Created At', 'Last Updated'];
        const rows = equipment.map(item => [
            item.equipment_id,
            item.name,
            item.qr_number || '-',
            item.quantity,
            item.condition,
            item.status,
            item.current_location || '-',
            formatDateTime(item.created_at),
            formatDateTime(item.last_updated)
        ]);

        const fileName = `equipment_inventory_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total items: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Equipment Inventory',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Equipment Inventory', headers, rows, summary);
    } catch (error) {
        console.error('Equipment inventory report error:', error);
        res.status(500).json({ error: 'Failed to generate equipment inventory report.' });
    }
});

// Attendance Sites Report
app.get('/api/reports/attendance-sites', authenticateToken, requireAnyPermission(['can_view_all_attendance', 'can_edit_attendance']), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 365);
        const sites = await prisma.construction_Site.findMany({
            where: {
                created_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const headers = ['Site ID', 'Name', 'Address', 'Latitude', 'Longitude', 'Radius (m)', 'Active', 'Created At', 'Updated At'];
        const rows = sites.map(site => [
            site.site_id,
            site.site_name,
            site.site_address || '-',
            site.center_lat,
            site.center_lng,
            site.geo_fence_radius_meters,
            site.is_active ? 'Active' : 'Inactive',
            formatDateTime(site.created_at),
            formatDateTime(site.updated_at)
        ]);

        const fileName = `attendance_sites_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total sites: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Attendance Sites',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Attendance Sites', headers, rows, summary);
    } catch (error) {
        console.error('Attendance sites report error:', error);
        res.status(500).json({ error: 'Failed to generate attendance sites report.' });
    }
});

// Inquiry Detail Report
app.get('/api/reports/inquiries-detail', authenticateToken, requirePermission('can_view_inquiries'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const inquiries = await prisma.client_Inquiry.findMany({
            where: {
                submitted_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                manager: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { submitted_at: 'desc' }
        });

        const headers = ['Submitted At', 'Client', 'Email', 'Contact', 'Status', 'Assigned To', 'Assigned Email', 'Message'];
        const rows = inquiries.map(inquiry => [
            formatDateTime(inquiry.submitted_at),
            inquiry.client_name,
            inquiry.client_email,
            inquiry.contact_number || '-',
            inquiry.status,
            inquiry.manager?.full_name || '-',
            inquiry.manager?.email || '-',
            inquiry.message_body || ''
        ]);

        const fileName = `inquiry_details_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total inquiries: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Inquiry Details',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Inquiry Details', headers, rows, summary);
    } catch (error) {
        console.error('Inquiry detail report error:', error);
        res.status(500).json({ error: 'Failed to generate inquiry detail report.' });
    }
});

// Project Files Report
app.get('/api/reports/files', authenticateToken, requirePermission('can_view_files'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 90);
        const files = await prisma.project_File.findMany({
            where: {
                uploaded_at: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                uploader: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { uploaded_at: 'desc' }
        });

        const headers = ['Uploaded At', 'File Name', 'Type', 'Size (MB)', 'Storage', 'Uploader', 'Uploader Email'];
        const rows = files.map(file => [
            formatDateTime(file.uploaded_at),
            file.file_name,
            file.file_type,
            Number(file.file_size_mb || 0),
            file.storage_location,
            file.uploader?.full_name || '-',
            file.uploader?.email || '-'
        ]);

        const fileName = `project_files_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total files: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Project Files',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Project Files', headers, rows, summary);
    } catch (error) {
        console.error('Project files report error:', error);
        res.status(500).json({ error: 'Failed to generate project files report.' });
    }
});

// System Health SIEM Report
app.get('/api/reports/health-siem', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_export_health_logs']), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const logs = await prisma.system_Health_Log.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate
                },
                OR: [
                    { description: { startsWith: '[SIEM]' } },
                    { event_type: { startsWith: 'SECURITY_' } }
                ]
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['Timestamp', 'Event Type', 'Description', 'IP Address'];
        const rows = logs.map(log => [
            formatDateTime(log.timestamp),
            log.event_type,
            log.description,
            log.ip_address
        ]);

        const fileName = `siem_alerts_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total alerts: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'SIEM Alerts',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'SIEM Alerts', headers, rows, summary);
    } catch (error) {
        console.error('SIEM report error:', error);
        res.status(500).json({ error: 'Failed to generate SIEM report.' });
    }
});

// System Health Backup Report
app.get('/api/reports/health-backups', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_export_health_logs', 'can_backup_database']), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 90);
        const logs = await prisma.system_Health_Log.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate
                },
                event_type: { startsWith: 'BACKUP_' }
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['Timestamp', 'Event Type', 'Description', 'IP Address'];
        const rows = logs.map(log => [
            formatDateTime(log.timestamp),
            log.event_type,
            log.description,
            log.ip_address
        ]);

        const fileName = `backup_history_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total backups: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'Backup History',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Backup History', headers, rows, summary);
    } catch (error) {
        console.error('Backup report error:', error);
        res.status(500).json({ error: 'Failed to generate backup report.' });
    }
});

// System Health Audit Trail Report (all logs)
app.get('/api/reports/health-audit', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_view_audit_trail', 'can_export_health_logs']), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const logs = await prisma.system_Health_Log.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['Timestamp', 'Event Type', 'Description', 'IP Address'];
        const rows = logs.map(log => [
            formatDateTime(log.timestamp),
            log.event_type,
            log.description,
            log.ip_address
        ]);

        const fileName = `health_audit_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total events: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'System Health Audit Trail',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'System Health Audit Trail', headers, rows, summary);
    } catch (error) {
        console.error('Health audit report error:', error);
        res.status(500).json({ error: 'Failed to generate health audit report.' });
    }
});

// System Health Activity Report (non-SIEM and non-backup)
app.get('/api/reports/health-activity', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_view_audit_trail', 'can_export_health_logs']), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 30);
        const logs = await prisma.system_Health_Log.findMany({
            where: {
                timestamp: {
                    gte: startDate,
                    lte: endDate
                },
                AND: [
                    { event_type: { not: { startsWith: 'BACKUP_' } } },
                    { description: { not: { startsWith: '[SIEM]' } } }
                ]
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['Timestamp', 'Event Type', 'Description', 'IP Address'];
        const rows = logs.map(log => [
            formatDateTime(log.timestamp),
            log.event_type,
            log.description,
            log.ip_address
        ]);

        const fileName = `health_activity_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total events: ${rows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, rows, {
                title: 'System Health Activity Logs',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'System Health Activity Logs', headers, rows, summary);
    } catch (error) {
        console.error('Health activity report error:', error);
        res.status(500).json({ error: 'Failed to generate health activity report.' });
    }
});

// Archives Report
app.get('/api/reports/archives', authenticateToken, requirePermission('can_view_audit_trail'), async (req, res) => {
    try {
        const format = resolveReportFormat(req, res);
        if (!format) return;

        const { startDate, endDate } = parseDateRange(req.query, 90);
        const rows = await prisma.$queryRawUnsafe(
            `
            SELECT
                archive_id,
                entity_type,
                source_table,
                record_id,
                deleted_by_name,
                deleted_by_email,
                deleted_by_role,
                deleted_ip,
                delete_reason,
                payload_json,
                deleted_at
            FROM archive_records
            WHERE deleted_at >= ? AND deleted_at <= ?
            ORDER BY deleted_at DESC
            `,
            startDate,
            endDate
        );

        const headers = ['Archived At', 'Entity', 'Source Table', 'Record ID', 'Deleted By', 'Deleted Email', 'Role', 'IP Address', 'Reason', 'Payload'];
        const dataRows = (rows || []).map(row => [
            formatDateTime(row.deleted_at),
            row.entity_type,
            row.source_table,
            row.record_id,
            row.deleted_by_name || '-',
            row.deleted_by_email || '-',
            row.deleted_by_role || '-',
            row.deleted_ip || '-',
            row.delete_reason || '-',
            row.payload_json || ''
        ]);

        const fileName = `archives_${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
        const summary = [
            `Range: ${startDate.toDateString()} to ${endDate.toDateString()}`,
            `Total archived records: ${dataRows.length}`
        ];

        if (format === 'csv') {
            return sendCsvReport(res, fileName, headers, dataRows, {
                title: 'Archives Report',
                summaryLines: summary
            });
        }

        return sendPdfReport(res, fileName, 'Archives Report', headers, dataRows, summary);
    } catch (error) {
        console.error('Archives report error:', error);
        res.status(500).json({ error: 'Failed to generate archives report.' });
    }
});

// ==========================================
// SYSTEM HEALTH & ADMINISTRATION (Granular Permissions)
// ==========================================

function formatRelativeTime(dateValue) {
    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute(s) ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour(s) ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day(s) ago`;
}

function formatUptime(seconds) {
    const s = Math.floor(seconds);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// Get system health summary/cards + backup history
app.get('/api/system/summary', authenticateToken, requirePermission('can_view_health_logs'), async (req, res) => {
    try {
        let dbConnected = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbConnected = true;
        } catch (dbError) {
            dbConnected = false;
        }

        const logs = await prisma.system_Health_Log.findMany({
            orderBy: { timestamp: 'desc' },
            take: 500
        });

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const securityLogs24h = logs.filter(log => {
            return /^SECURITY_/i.test(log.event_type) && new Date(log.timestamp) >= twentyFourHoursAgo;
        });

        const failedLoginAttempts = securityLogs24h.filter(log => {
            return log.event_type === 'SECURITY_LOGIN_FAILURE' || log.event_type === 'SECURITY_BRUTE_FORCE_SUSPECTED';
        }).length;

        const unauthorizedAccessAttempts = securityLogs24h.filter(log => {
            return /^SECURITY_UNAUTHORIZED_/i.test(log.event_type);
        }).length;

        const abnormalEquipmentActivity = securityLogs24h.filter(log => {
            return log.event_type === 'SECURITY_EQUIPMENT_ANOMALY';
        }).length;

        const latestSecurityAlerts = securityLogs24h
            .slice(0, 10)
            .map(log => ({
                id: log.sys_log_id,
                event_type: log.event_type,
                description: log.description,
                ip_address: log.ip_address,
                timestamp: log.timestamp
            }));

        const backupLogs = logs.filter(log => /^BACKUP_/i.test(log.event_type));
        const latestBackup = backupLogs[0] || null;

        // Approximate currently active users by distinct LOGIN_SUCCESS events in the last 15 minutes.
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeUsersSet = new Set();
        logs.forEach(log => {
            if (log.event_type !== 'LOGIN_SUCCESS') return;
            if (new Date(log.timestamp) < fifteenMinutesAgo) return;

            const emailMatch = (log.description || '').match(/\(([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\)/i);
            if (emailMatch?.[1]) activeUsersSet.add(emailMatch[1].toLowerCase());
        });

        let dbSizeMb = 0;
        try {
            const dbSizeRows = await prisma.$queryRaw`
                SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
                FROM information_schema.tables
                WHERE table_schema = DATABASE();
            `;
            const bytesValue = Number(dbSizeRows?.[0]?.bytes || 0);
            dbSizeMb = bytesValue / (1024 * 1024);
        } catch (sizeError) {
            dbSizeMb = 0;
        }

        const backupHistory = backupLogs.slice(0, 20).map(log => {
            const sizeMatch = (log.description || '').match(/(\d+(?:\.\d+)?)\s*MB/i);
            const storageMatch = (log.description || '').match(/\b(LOCAL_FTP|CLOUD)\b/i);
            const typeMatch = (log.event_type || '').includes('TRIGGERED') ? 'Manual' : 'Automated';

            return {
                backup_id: `BK-${String(log.sys_log_id).padStart(4, '0')}`,
                timestamp: log.timestamp,
                type: typeMatch,
                size_mb: Number(sizeMatch?.[1] || dbSizeMb.toFixed(2)),
                status: 'Success',
                storage: (storageMatch?.[1] || 'LOCAL_FTP').toUpperCase()
            };
        });

        res.json({
            summary: {
                server_uptime: formatUptime(process.uptime()),
                db_status: dbConnected ? 'connected' : 'disconnected',
                active_users: activeUsersSet.size,
                last_backup: latestBackup
                    ? {
                        at: latestBackup.timestamp,
                        relative: formatRelativeTime(latestBackup.timestamp)
                    }
                    : null,
                backup_history: backupHistory,
                security_monitoring: {
                    failed_login_attempts_24h: failedLoginAttempts,
                    unauthorized_access_attempts_24h: unauthorizedAccessAttempts,
                    abnormal_equipment_activity_24h: abnormalEquipmentActivity,
                    latest_alerts: latestSecurityAlerts
                }
            }
        });
    } catch (error) {
        console.error('System Summary Error:', error);
        res.status(500).json({ error: 'Failed to retrieve system summary.' });
    }
});

// Get System Health Logs - Requires can_view_health_logs OR can_view_audit_trail permission
app.get('/api/system/health-logs', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_view_audit_trail']), async (req, res) => {
    try {
        const logs = await prisma.system_Health_Log.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100 // Last 100 logs
        });
        res.json({ logs });
    } catch (error) {
        console.error("Fetch Health Logs Error:", error);
        res.status(500).json({ error: "Failed to retrieve health logs." });
    }
});

// Get Activity Audit Logs (not covered by SIEM/Backups/Notifications)
app.get('/api/system/activity-logs', authenticateToken, requireAnyPermission(['can_view_health_logs', 'can_view_audit_trail']), async (req, res) => {
    try {
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 300)
            : 200;

        const logs = await prisma.system_Health_Log.findMany({
            where: {
                AND: [
                    { event_type: { not: { startsWith: 'SECURITY_' } } },
                    { event_type: { not: { startsWith: 'BACKUP_' } } },
                    { description: { not: { startsWith: '[SIEM]' } } },
                    { description: { not: { startsWith: '[NOTIFICATION]' } } }
                ]
            },
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        res.json({ logs });
    } catch (error) {
        console.error('Fetch Activity Logs Error:', error);
        res.status(500).json({ error: 'Failed to retrieve activity logs.' });
    }
});

// Read Archive Records - Requires can_view_audit_trail permission
app.get('/api/archives', authenticateToken, requirePermission('can_view_audit_trail'), async (req, res) => {
    try {
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 500)
            : 200;

        const entityType = String(req.query.entityType || 'ALL').trim().toUpperCase();
        const actorType = String(req.query.actorType || 'ALL').trim().toUpperCase();
        const search = String(req.query.search || '').trim();

        let sql = `
            SELECT
                archive_id,
                entity_type,
                source_table,
                record_id,
                deleted_by_user_id,
                deleted_by_name,
                deleted_by_email,
                deleted_by_role,
                delete_reason,
                deleted_ip,
                payload_json,
                deleted_at,
                is_immutable
            FROM archive_records
            WHERE 1=1
        `;
        const params = [];

        if (entityType !== 'ALL') {
            sql += ' AND entity_type = ?';
            params.push(entityType);
        }

        if (actorType === 'SYSTEM') {
            sql += ' AND deleted_by_user_id IS NULL';
        } else if (actorType === 'ADMIN' || actorType === 'EMPLOYEE') {
            sql += ' AND UPPER(COALESCE(deleted_by_role, \"\")) = ?';
            params.push(actorType);
        }

        if (search) {
            sql += ' AND (record_id LIKE ? OR deleted_by_name LIKE ? OR deleted_by_email LIKE ? OR source_table LIKE ? OR payload_json LIKE ?)';
            const wildcard = `%${search}%`;
            params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
        }

        sql += ' ORDER BY deleted_at DESC LIMIT ?';
        params.push(limit);

        const rows = await prisma.$queryRawUnsafe(sql, ...params);

        const archives = (rows || []).map((row) => ({
            archive_id: Number(row.archive_id),
            entity_type: row.entity_type,
            source_table: row.source_table,
            record_id: row.record_id,
            deleted_by_user_id: row.deleted_by_user_id,
            deleted_by_name: row.deleted_by_name,
            deleted_by_email: row.deleted_by_email,
            deleted_by_role: row.deleted_by_role,
            delete_reason: row.delete_reason,
            deleted_ip: row.deleted_ip,
            deleted_at: row.deleted_at,
            is_immutable: Boolean(row.is_immutable),
            payload: parseArchivePayload(row.payload_json)
        }));

        const summary = {
            total_records: archives.length,
            last_archived_at: archives.length > 0 ? archives[0].deleted_at : null,
            unique_entities: new Set(archives.map(item => item.entity_type)).size
        };

        res.json({ archives, summary });
    } catch (error) {
        console.error('Fetch Archives Error:', error);
        res.status(500).json({ error: 'Failed to retrieve archives.' });
    }
});

// Immutable Archive Guard - archive data cannot be deleted by any account.
app.delete('/api/archives/:archive_id', authenticateToken, async (req, res) => {
    await logSiemEvent(
        'SECURITY_ARCHIVE_DELETE_ATTEMPT_BLOCKED',
        'HIGH',
        `Blocked delete attempt for archive_id=${req.params.archive_id}`,
        req,
        {
            archive_id: req.params.archive_id,
            requester_user_id: req.user?.user_id || null
        }
    );

    return res.status(403).json({
        error: 'Archives are immutable and cannot be deleted.'
    });
});

app.put('/api/archives/:archive_id', authenticateToken, async (req, res) => {
    await logSiemEvent(
        'SECURITY_ARCHIVE_MUTATION_ATTEMPT_BLOCKED',
        'HIGH',
        `Blocked update attempt for archive_id=${req.params.archive_id}`,
        req,
        {
            archive_id: req.params.archive_id,
            requester_user_id: req.user?.user_id || null
        }
    );

    return res.status(403).json({
        error: 'Archives are immutable and cannot be modified.'
    });
});

// Export Health Logs (CSV) - Requires can_export_health_logs permission
app.get('/api/system/export-logs', authenticateToken, requirePermission('can_export_health_logs'), async (req, res) => {
    try {
        const logs = await prisma.system_Health_Log.findMany({
            orderBy: { timestamp: 'desc' }
        });
        
        // Convert to CSV format
        const csvHeaders = 'sys_log_id,event_type,description,ip_address,timestamp\n';
        const csvRows = logs.map(log => 
            `${log.sys_log_id},"${log.event_type}","${log.description}","${log.ip_address || 'N/A'}","${log.timestamp.toISOString()}"`
        ).join('\n');
        
        const csv = csvHeaders + csvRows;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="system_health_logs_${Date.now()}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error("Export Logs Error:", error);
        res.status(500).json({ error: "Failed to export logs." });
    }
});

// Trigger Database Backup - Requires can_backup_database permission
app.post('/api/system/backup', authenticateToken, requirePermission('can_backup_database'), async (req, res) => {
    try {
        let dbSizeMb = 0;
        try {
            const dbSizeRows = await prisma.$queryRaw`
                SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes
                FROM information_schema.tables
                WHERE table_schema = DATABASE();
            `;
            dbSizeMb = Number(dbSizeRows?.[0]?.bytes || 0) / (1024 * 1024);
        } catch (sizeError) {
            dbSizeMb = 0;
        }

        // Log backup event to System_Health_Log
        const backupLog = await prisma.system_Health_Log.create({
            data: {
                event_type: 'BACKUP_CREATED',
                description: `Manual database backup created by ${req.userPermissions.full_name} (${req.userPermissions.email}) - ${dbSizeMb.toFixed(2)} MB - LOCAL_FTP`,
                ip_address: req.ip || req.connection.remoteAddress
            }
        });
        
        res.json({ 
            message: "Database backup created successfully.",
            backup_id: backupLog.sys_log_id,
            timestamp: backupLog.timestamp,
            size_mb: Number(dbSizeMb.toFixed(2)),
            storage: 'LOCAL_FTP'
        });
    } catch (error) {
        console.error("Backup Trigger Error:", error);
        res.status(500).json({ error: "Failed to trigger backup." });
    }
});

// Get User Permissions (Self) - All authenticated users
app.get('/api/users/me/permissions', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { user_id: req.user.user_id },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                
                // User Management
                can_view_users: true,
                can_add_users: true,
                can_edit_users: true,
                can_delete_users: true,
                can_activate_users: true,
                
                // Attendance
                can_view_own_attendance: true,
                can_view_all_attendance: true,
                can_edit_attendance: true,
                can_delete_attendance: true,
                can_export_attendance: true,
                
                // Equipment
                can_view_equipment: true,
                can_add_equipment: true,
                can_edit_equipment: true,
                can_delete_equipment: true,
                can_assign_equipment: true,
                
                // Files
                can_view_files: true,
                can_upload_files: true,
                can_edit_files: true,
                can_delete_files: true,
                can_download_files: true,
                
                // Inquiries
                can_view_inquiries: true,
                can_add_inquiries: true,
                can_update_inquiries: true,
                can_delete_inquiries: true,
                can_assign_inquiries: true,
                
                // System Admin
                can_view_health_logs: true,
                can_export_health_logs: true,
                can_manage_permissions: true,
                can_view_audit_trail: true,
                can_backup_database: true
            }
        });
        
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }
        
        res.json({ permissions: user });
    } catch (error) {
        console.error("Fetch Permissions Error:", error);
        res.status(500).json({ error: "Failed to retrieve permissions." });
    }
});

// Health Check Endpoint (for Docker/Kubernetes health monitoring)
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'CICJ-SHCOMS API is running.'
    });
});

app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

app.post('/admin/seed', async (req, res) => {
    try {
        if (!SEED_ADMIN_TOKEN) {
            return res.status(403).json({ error: 'Seed token not configured.' });
        }

        const token = req.headers['x-seed-token'];
        if (token !== SEED_ADMIN_TOKEN) {
            return res.status(403).json({ error: 'Invalid seed token.' });
        }

        const email = process.env.SEED_ADMIN_EMAIL;
        const password = process.env.SEED_ADMIN_PASSWORD;
        const fullName = process.env.SEED_ADMIN_NAME || 'System Admin';

        if (!email || !password) {
            return res.status(400).json({ error: 'Seed admin env vars missing.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const permissions = buildAdminPermissions();

        const admin = await prisma.user.upsert({
            where: { email },
            update: {
                full_name: fullName,
                role: 'ADMIN',
                is_active: true,
                password_hash: passwordHash,
                ...permissions
            },
            create: {
                full_name: fullName,
                email,
                role: 'ADMIN',
                is_active: true,
                password_hash: passwordHash,
                ...permissions
            }
        });

        return res.status(200).json({ status: 'ok', email: admin.email });
    } catch (error) {
        console.error('Seed Admin Error:', error);
        return res.status(500).json({ error: 'Seed failed.' });
    }
});

// Initialize email transporter on startup
initializeEmailTransporter();

// Startup env-var check (values masked, only SET/MISSING shown)
console.log('[ENV] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
console.log('[ENV] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'MISSING');
console.log('[ENV] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
console.log('[ENV] GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');
console.log('[ENV] MFA_ENABLED:', process.env.MFA_ENABLED || 'MISSING');

async function startServer() {
    try {
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
        ensureArchiveStore().catch((error) => {
            console.error('Archive store init failed:', error);
        });
    } catch (error) {
        console.error('Startup Error:', error);
        process.exit(1);
    }
}

startServer();
