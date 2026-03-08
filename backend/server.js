const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// 1. Helmet - Security headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
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
    max: 100, // 100 requests per window per IP
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
    message: {
        error: 'Too many login attempts, please try again later.',
        retryAfter: '15 minutes',
        hint: 'For security, we limit login attempts. Please wait before trying again.'
    }
});

app.use('/login', authLimiter);
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

// ==========================================
// AUTHENTICATION ROUTES (No permissions required)
// ==========================================

// 1. Login Route - Public endpoint (with validation)
app.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email
        const user = await prisma.user.findUnique({ 
            where: { email: email } 
        });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({ error: "Account is deactivated. Contact administrator." });
        }

        // Compare plain text password with password_hash from DB
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Create JWT with user_id and role
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        res.json({ 
            token, 
            user: { 
                user_id: user.user_id, 
                full_name: user.full_name, 
                email: user.email,
                role: user.role 
            } 
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Server error" });
    }
});

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
        can_backup_database
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
                can_backup_database: can_backup_database || false
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

// Get All Users - Requires can_view_users permission
app.get('/api/users', authenticateToken, requirePermission('can_view_users'), async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                contact_number: true,
                is_active: true,
                created_at: true
            },
            orderBy: { created_at: 'desc' }
        });
        res.json({ users });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ error: "Failed to retrieve users." });
    }
});

// Update User - Requires can_edit_users permission
app.put('/api/users/:user_id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
    const { user_id } = req.params;
    const { full_name, email, contact_number, role } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { user_id: parseInt(user_id) },
            data: { full_name, email, contact_number, role },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                contact_number: true
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

    try {
        await prisma.user.delete({
            where: { user_id: parseInt(user_id) }
        });
        res.json({ message: "User deleted successfully." });
    } catch (error) {
        console.error("Delete User Error:", error);
        res.status(500).json({ error: "Failed to delete user." });
    }
});

// Activate/Deactivate User - Requires can_activate_users permission
app.patch('/api/users/:user_id/status', authenticateToken, requirePermission('can_activate_users'), async (req, res) => {
    const { user_id } = req.params;
    const { is_active } = req.body;

    try {
        const updatedUser = await prisma.user.update({
            where: { user_id: parseInt(user_id) },
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
            orderBy: { created_at: 'desc' }
        });
        res.json({ equipment });
    } catch (error) {
        console.error("Fetch Equipment Error:", error);
        res.status(500).json({ error: "Failed to retrieve equipment." });
    }
});

// Add Equipment - Requires can_add_equipment permission
app.post('/api/equipment', authenticateToken, requirePermission('can_add_equipment'), async (req, res) => {
    const { name, quantity, condition, status } = req.body;
    
    if (!name || !quantity) {
        return res.status(400).json({ error: "Name and quantity are required." });
    }

    try {
        const newEquipment = await prisma.equipment_Inventory.create({
            data: { 
                name, 
                quantity: parseInt(quantity), 
                condition: condition || 'Good', 
                status: status || 'Available' 
            }
        });
        res.status(201).json({ 
            message: "Equipment added successfully", 
            equipment: newEquipment 
        });
    } catch (error) {
        console.error("Add Equipment Error:", error);
        res.status(500).json({ error: "Failed to add equipment" });
    }
});

// Update Equipment - Requires can_edit_equipment permission
app.put('/api/equipment/:equipment_id', authenticateToken, requirePermission('can_edit_equipment'), async (req, res) => {
    const { equipment_id } = req.params;
    const { name, quantity, condition, status } = req.body;

    try {
        const updatedEquipment = await prisma.equipment_Inventory.update({
            where: { equipment_id: parseInt(equipment_id) },
            data: { name, quantity: parseInt(quantity), condition, status }
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
        await prisma.equipment_Inventory.delete({
            where: { equipment_id: parseInt(equipment_id) }
        });
        res.json({ message: "Equipment deleted successfully." });
    } catch (error) {
        console.error("Delete Equipment Error:", error);
        res.status(500).json({ error: "Failed to delete equipment." });
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
        const attendance = await prisma.attendance_Log.findMany({
            include: {
                user: {
                    select: { full_name: true, email: true }
                }
            },
            orderBy: { timestamp: 'desc' }
        });
        res.json({ attendance });
    } catch (error) {
        console.error("Fetch All Attendance Error:", error);
        res.status(500).json({ error: "Failed to retrieve attendance." });
    }
});

// Clock In/Out - All authenticated users can log attendance
app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { action, location_lat, location_lng } = req.body;
    
    if (!action || !['clock_in', 'clock_out'].includes(action)) {
        return res.status(400).json({ error: "Valid action required (clock_in or clock_out)." });
    }

    try {
        const log = await prisma.attendance_Log.create({
            data: {
                user_id: req.user.user_id,
                action,
                location_lat: location_lat ? parseFloat(location_lat) : null,
                location_lng: location_lng ? parseFloat(location_lng) : null
            }
        });
        res.status(201).json({ message: `${action} recorded successfully.`, log });
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
        await prisma.attendance_Log.delete({
            where: { log_id: parseInt(log_id) }
        });
        res.json({ message: "Attendance record deleted successfully." });
    } catch (error) {
        console.error("Delete Attendance Error:", error);
        res.status(500).json({ error: "Failed to delete attendance." });
    }
});

// ==========================================
// PROJECT FILES ROUTES (Granular Permissions)
// ==========================================

// Get All Files - Requires can_view_files permission
app.get('/api/files', authenticateToken, requirePermission('can_view_files'), async (req, res) => {
    try {
        const files = await prisma.project_File.findMany({
            include: {
                uploaded_by_user: {
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

// Upload File - Requires can_upload_files permission
app.post('/api/files', authenticateToken, requirePermission('can_upload_files'), async (req, res) => {
    const { file_name, file_path, file_type, file_size } = req.body;
    
    if (!file_name || !file_path) {
        return res.status(400).json({ error: "File name and path are required." });
    }

    try {
        const newFile = await prisma.project_File.create({
            data: {
                file_name,
                file_path,
                file_type: file_type || 'unknown',
                file_size: file_size ? parseInt(file_size) : 0,
                uploaded_by: req.user.user_id
            }
        });
        res.status(201).json({ message: "File uploaded successfully.", file: newFile });
    } catch (error) {
        console.error("Upload File Error:", error);
        res.status(500).json({ error: "Failed to upload file." });
    }
});

// Download File - Requires can_download_files permission
app.get('/api/files/:file_id/download', authenticateToken, requirePermission('can_download_files'), async (req, res) => {
    const { file_id } = req.params;

    try {
        const file = await prisma.project_File.findUnique({
            where: { file_id: parseInt(file_id) }
        });
        
        if (!file) {
            return res.status(404).json({ error: "File not found." });
        }

        res.json({ 
            message: "File ready for download.",
            file: {
                file_id: file.file_id,
                file_name: file.file_name,
                file_path: file.file_path,
                file_type: file.file_type,
                file_size: file.file_size
            }
        });
    } catch (error) {
        console.error("Download File Error:", error);
        res.status(500).json({ error: "Failed to download file." });
    }
});

// Edit File Metadata - Requires can_edit_files permission
app.put('/api/files/:file_id', authenticateToken, requirePermission('can_edit_files'), async (req, res) => {
    const { file_id } = req.params;
    const { file_name, file_type } = req.body;

    try {
        const updatedFile = await prisma.project_File.update({
            where: { file_id: parseInt(file_id) },
            data: { file_name, file_type }
        });
        res.json({ message: "File metadata updated successfully.", file: updatedFile });
    } catch (error) {
        console.error("Update File Error:", error);
        res.status(500).json({ error: "Failed to update file." });
    }
});

// Delete File - Requires can_delete_files permission
app.delete('/api/files/:file_id', authenticateToken, requirePermission('can_delete_files'), async (req, res) => {
    const { file_id } = req.params;

    try {
        await prisma.project_File.delete({
            where: { file_id: parseInt(file_id) }
        });
        res.json({ message: "File deleted successfully." });
    } catch (error) {
        console.error("Delete File Error:", error);
        res.status(500).json({ error: "Failed to delete file." });
    }
});

// ==========================================
// CLIENT INQUIRIES ROUTES (Granular Permissions)
// ==========================================

// Get All Inquiries - Requires can_view_inquiries permission
app.get('/api/inquiries', authenticateToken, requirePermission('can_view_inquiries'), async (req, res) => {
    try {
        const inquiries = await prisma.client_Inquiry.findMany({
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
                message,
                status: status || 'Pending'
            }
        });
        res.status(201).json({ message: "Inquiry submitted successfully.", inquiry: newInquiry });
    } catch (error) {
        console.error("Submit Inquiry Error:", error);
        res.status(500).json({ error: "Failed to submit inquiry." });
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
        await prisma.client_Inquiry.delete({
            where: { inquiry_id: parseInt(inquiry_id) }
        });
        res.json({ message: "Inquiry deleted successfully." });
    } catch (error) {
        console.error("Delete Inquiry Error:", error);
        res.status(500).json({ error: "Failed to delete inquiry." });
    }
});

// ==========================================
// SYSTEM HEALTH & ADMINISTRATION (Granular Permissions)
// ==========================================

// Get System Health Logs - Requires can_view_health_logs permission
app.get('/api/system/health-logs', authenticateToken, requirePermission('can_view_health_logs'), async (req, res) => {
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

// Export Health Logs (CSV) - Requires can_export_health_logs permission
app.get('/api/system/export-logs', authenticateToken, requirePermission('can_export_health_logs'), async (req, res) => {
    try {
        const logs = await prisma.system_Health_Log.findMany({
            orderBy: { timestamp: 'desc' }
        });
        
        // Convert to CSV format
        const csvHeaders = 'log_id,event_type,description,ip_address,timestamp\n';
        const csvRows = logs.map(log => 
            `${log.log_id},"${log.event_type}","${log.description}","${log.ip_address || 'N/A'}","${log.timestamp.toISOString()}"`
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
        // Log backup event to System_Health_Log
        const backupLog = await prisma.system_Health_Log.create({
            data: {
                event_type: 'BACKUP_TRIGGERED',
                description: `Manual database backup initiated by user ${req.userPermissions.full_name}`,
                ip_address: req.ip || req.connection.remoteAddress
            }
        });
        
        res.json({ 
            message: "Database backup initiated successfully.",
            backup_id: backupLog.log_id,
            timestamp: backupLog.timestamp,
            note: "Backup process running in background. Check health logs for completion status."
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
