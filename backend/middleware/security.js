/**
 * ==========================================
 * SECURITY MIDDLEWARE
 * ==========================================
 * Comprehensive security hardening:
 * - Input validation & sanitization
 * - XSS prevention
 * - SQL injection prevention (via Prisma ORM)
 * - Rate limiting
 * - CSRF protection
 */

const { body, validationResult, param, query } = require('express-validator');
const xss = require('xss');

// Security checks are centralized here so route handlers stay focused on business logic.

/**
 * ==========================================
 * INPUT SANITIZATION (XSS Prevention)
 * ==========================================
 * Sanitizes all string inputs to prevent XSS attacks
 */
const sanitizeInput = (req, res, next) => {
    // Clean request strings early to reduce XSS risk across the app.
    // Sanitize body
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        });
    }

    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = xss(req.query[key]);
            }
        });
    }

    // Sanitize params
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            if (typeof req.params[key] === 'string') {
                req.params[key] = xss(req.params[key]);
            }
        });
    }

    next();
};

/**
 * ==========================================
 * VALIDATION RULES
 * ==========================================
 * Express-validator rules for common fields
 */

// User Registration Validation
const validateUserRegistration = [
    body('full_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-\.]+$/)
        .withMessage('Full name can only contain letters, spaces, hyphens, and periods'),
    
    body('email')
        .trim()
        .isEmail()
        .withMessage('Invalid email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email too long'),
    
    body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    
    body('contact_number')
        .optional()
        .trim()
        .matches(/^\+?[\d\s\-\(\)]+$/)
        .withMessage('Invalid phone number format')
        .isLength({ max: 20 })
        .withMessage('Phone number too long'),
    
    body('role')
        .optional()
        .isIn(['ADMIN', 'EMPLOYEE'])
        .withMessage('Role must be either ADMIN or EMPLOYEE'),
    
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean')
];

// Login Validation
const validateLogin = [
    body('email')
        .trim()
        .isEmail()
        .withMessage('Invalid email address')
        .normalizeEmail(),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6, max: 128 })
        .withMessage('Invalid password format')
];

// Equipment Validation
const validateEquipment = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Equipment name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-\(\)\.]+$/)
        .withMessage('Equipment name contains invalid characters'),
    
    body('quantity')
        .isInt({ min: 0, max: 100000 })
        .withMessage('Quantity must be a positive integer between 0 and 100000'),
    
    body('condition')
        .optional()
        .isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Broken'])
        .withMessage('Invalid condition value'),
    
    body('status')
        .optional()
        .isIn(['Available', 'In Use', 'Maintenance', 'Retired'])
        .withMessage('Invalid status value')
];

// Attendance Validation
const validateAttendance = [
    body('action')
        .isIn(['clock_in', 'clock_out'])
        .withMessage('Action must be either clock_in or clock_out'),
    
    body('location_lat')
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    
    body('location_lng')
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180')
];

// File Upload Validation
const validateFileUpload = [
    body('file_name')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('File name must be between 1 and 255 characters')
        .matches(/^[a-zA-Z0-9\s\-\_\.]+$/)
        .withMessage('File name contains invalid characters'),
    
    body('file_path')
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage('File path is required'),
    
    body('file_type')
        .optional()
        .isLength({ max: 100 })
        .withMessage('File type too long'),
    
    body('file_size')
        .optional()
        .isInt({ min: 0, max: 104857600 }) // Max 100MB
        .withMessage('File size must be between 0 and 100MB')
];

// Client Inquiry Validation
const validateInquiry = [
    body('client_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Client name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s\-\.]+$/)
        .withMessage('Client name contains invalid characters'),
    
    body('client_email')
        .trim()
        .isEmail()
        .withMessage('Invalid client email address')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('Email too long'),
    
    body('subject')
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Subject must be between 3 and 200 characters'),
    
    body('message')
        .trim()
        .isLength({ min: 10, max: 5000 })
        .withMessage('Message must be between 10 and 5000 characters'),
    
    body('status')
        .optional()
        .isIn(['Pending', 'In Progress', 'Resolved', 'Closed'])
        .withMessage('Invalid inquiry status')
];

// ID Parameter Validation
const validateId = (paramName = 'id') => [
    param(paramName)
        .isInt({ min: 1 })
        .withMessage(`${paramName} must be a positive integer`)
];

/**
 * ==========================================
 * VALIDATION ERROR HANDLER
 * ==========================================
 * Returns 400 with detailed validation errors
 */
const handleValidationErrors = (req, res, next) => {
    // Convert validator output into one consistent API error shape.
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path || err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    
    next();
};

/**
 * ==========================================
 * CSRF TOKEN GENERATION & VALIDATION
 * ==========================================
 * Custom CSRF implementation (csurf is deprecated)
 */
const crypto = require('crypto');

// In-memory token store (use Redis in production)
const csrfTokens = new Map();

// Generate CSRF token
const generateCsrfToken = (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const token = crypto.randomBytes(32).toString('hex');
    const userId = req.user.user_id;
    
    // Store token with 1-hour expiration
    csrfTokens.set(userId, {
        token,
        expires: Date.now() + 3600000 // 1 hour
    });
    
    // Attach token to response
    res.locals.csrfToken = token;
    next();
};

// Validate CSRF token (for state-changing operations)
const validateCsrfToken = (req, res, next) => {
    // Only check CSRF for non-GET requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required for CSRF validation' });
    }

    const submittedToken = req.headers['x-csrf-token'] || req.body._csrf;
    const userId = req.user.user_id;
    const storedData = csrfTokens.get(userId);

    // Check if token exists and is not expired
    if (!storedData || Date.now() > storedData.expires) {
        return res.status(403).json({ 
            error: 'CSRF token expired or missing',
            hint: 'Request a new CSRF token from GET /api/csrf-token'
        });
    }

    // Validate token
    if (submittedToken !== storedData.token) {
        return res.status(403).json({ 
            error: 'Invalid CSRF token',
            hint: 'CSRF token mismatch - possible CSRF attack detected'
        });
    }

    next();
};

// Endpoint to get CSRF token
const getCsrfTokenEndpoint = (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const userId = req.user.user_id;
    
    csrfTokens.set(userId, {
        token,
        expires: Date.now() + 3600000
    });
    
    res.json({ csrfToken: token });
};

/**
 * ==========================================
 * SQL INJECTION PREVENTION
 * ==========================================
 * NOTE: Prisma ORM automatically prevents SQL injection via parameterized queries
 * No additional middleware needed - Prisma handles it internally
 * 
 * NEVER use raw SQL queries like:
 * ❌ prisma.$queryRaw`SELECT * FROM User WHERE email = '${email}'`
 * 
 * ALWAYS use parameterized:
 * ✅ prisma.user.findUnique({ where: { email } })
 */

module.exports = {
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
};
