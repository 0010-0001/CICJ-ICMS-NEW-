const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * ==========================================
 * JWT AUTHENTICATION MIDDLEWARE
 * ==========================================
 * Verifies JWT token and extracts user info
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expected format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ 
            error: "Access denied. No token provided.",
            hint: "Include 'Authorization: Bearer <token>' header" 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                error: "Invalid or expired token.",
                details: err.message 
            });
        }
        
        // Attach decoded user info to request
        req.user = decoded; // { user_id, role, iat, exp }
        next();
    });
};

/**
 * ==========================================
 * ROLE-BASED AUTHORIZATION (Basic)
 * ==========================================
 * Checks if user has specific role (ADMIN or EMPLOYEE)
 * NOTE: Use requirePermission for granular control
 */
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required." });
        }

        if (req.user.role !== role) {
            return res.status(403).json({ 
                error: "Forbidden: Insufficient role privileges.",
                required: role,
                current: req.user.role
            });
        }
        next();
    };
};

/**
 * ==========================================
 * GRANULAR PERMISSION-BASED AUTHORIZATION
 * ==========================================
 * Fetches user from database and checks specific permission flag
 * 
 * Usage:
 *   app.post('/api/users', authenticateToken, requirePermission('can_add_users'), handler);
 *   app.get('/api/equipment', authenticateToken, requirePermission('can_view_equipment'), handler);
 * 
 * Available Permissions (30 total):
 *   - User Management: can_view_users, can_add_users, can_edit_users, can_delete_users, can_activate_users
 *   - Attendance: can_view_own_attendance, can_view_all_attendance, can_edit_attendance, can_delete_attendance, can_export_attendance
 *   - Equipment: can_view_equipment, can_add_equipment, can_edit_equipment, can_delete_equipment, can_assign_equipment
 *   - Files: can_view_files, can_upload_files, can_edit_files, can_delete_files, can_download_files
 *   - Inquiries: can_view_inquiries, can_add_inquiries, can_update_inquiries, can_delete_inquiries, can_assign_inquiries
 *   - System Admin: can_view_health_logs, can_export_health_logs, can_manage_permissions, can_view_audit_trail, can_backup_database
 */
const requirePermission = (permissionFlag) => {
    return async (req, res, next) => {
        try {
            // Ensure user is authenticated first
            if (!req.user || !req.user.user_id) {
                return res.status(401).json({ 
                    error: "Authentication required. Use authenticateToken middleware first." 
                });
            }

            // Fetch full user data with all permission flags from database
            const user = await prisma.user.findUnique({
                where: { user_id: req.user.user_id },
                select: {
                    user_id: true,
                    full_name: true,
                    email: true,
                    role: true,
                    is_active: true,
                    
                    // User Management Permissions
                    can_view_users: true,
                    can_add_users: true,
                    can_edit_users: true,
                    can_delete_users: true,
                    can_activate_users: true,
                    
                    // Attendance Permissions
                    can_view_own_attendance: true,
                    can_view_all_attendance: true,
                    can_edit_attendance: true,
                    can_delete_attendance: true,
                    can_export_attendance: true,
                    
                    // Equipment Permissions
                    can_view_equipment: true,
                    can_add_equipment: true,
                    can_edit_equipment: true,
                    can_delete_equipment: true,
                    can_assign_equipment: true,
                    
                    // Project Files Permissions
                    can_view_files: true,
                    can_upload_files: true,
                    can_edit_files: true,
                    can_delete_files: true,
                    can_download_files: true,
                    
                    // Client Inquiries Permissions
                    can_view_inquiries: true,
                    can_add_inquiries: true,
                    can_update_inquiries: true,
                    can_delete_inquiries: true,
                    can_assign_inquiries: true,
                    
                    // System Administration Permissions
                    can_view_health_logs: true,
                    can_export_health_logs: true,
                    can_manage_permissions: true,
                    can_view_audit_trail: true,
                    can_backup_database: true
                }
            });

            // Check if user exists and is active
            if (!user) {
                return res.status(404).json({ 
                    error: "User not found.",
                    user_id: req.user.user_id 
                });
            }

            if (!user.is_active) {
                return res.status(403).json({ 
                    error: "Account is deactivated. Contact administrator." 
                });
            }

            // Check if the specific permission flag is TRUE
            if (!user[permissionFlag]) {
                return res.status(403).json({ 
                    error: "Forbidden: Insufficient permissions.",
                    required_permission: permissionFlag,
                    current_permissions: Object.keys(user)
                        .filter(key => key.startsWith('can_') && user[key] === true)
                        .join(', ') || 'none',
                    hint: "Contact administrator to request permission elevation."
                });
            }

            // Attach full user permissions to request for downstream use
            req.userPermissions = user;
            next();

        } catch (error) {
            console.error('Permission Check Error:', error);
            return res.status(500).json({ 
                error: "Permission verification failed.",
                details: error.message 
            });
        }
    };
};

/**
 * ==========================================
 * REQUIRE MULTIPLE PERMISSIONS (ALL)
 * ==========================================
 * User must have ALL specified permissions
 * 
 * Usage:
 *   requireAllPermissions(['can_edit_users', 'can_activate_users'])
 */
const requireAllPermissions = (permissionFlags) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.user_id) {
                return res.status(401).json({ error: "Authentication required." });
            }

            const user = await prisma.user.findUnique({
                where: { user_id: req.user.user_id }
            });

            if (!user || !user.is_active) {
                return res.status(403).json({ error: "User account invalid or inactive." });
            }

            // Check if user has ALL required permissions
            const missingPermissions = permissionFlags.filter(flag => !user[flag]);
            
            if (missingPermissions.length > 0) {
                return res.status(403).json({ 
                    error: "Insufficient permissions.",
                    missing: missingPermissions
                });
            }

            req.userPermissions = user;
            next();

        } catch (error) {
            console.error('Multi-Permission Check Error:', error);
            return res.status(500).json({ error: "Permission verification failed." });
        }
    };
};

/**
 * ==========================================
 * REQUIRE ANY PERMISSION (OR)
 * ==========================================
 * User needs at least ONE of the specified permissions
 * 
 * Usage:
 *   requireAnyPermission(['can_view_all_attendance', 'can_export_attendance'])
 */
const requireAnyPermission = (permissionFlags) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.user_id) {
                return res.status(401).json({ error: "Authentication required." });
            }

            const user = await prisma.user.findUnique({
                where: { user_id: req.user.user_id }
            });

            if (!user || !user.is_active) {
                return res.status(403).json({ error: "User account invalid or inactive." });
            }

            // Check if user has AT LEAST ONE of the required permissions
            const hasAnyPermission = permissionFlags.some(flag => user[flag] === true);
            
            if (!hasAnyPermission) {
                return res.status(403).json({ 
                    error: "Insufficient permissions. Require at least one of:",
                    required_any: permissionFlags
                });
            }

            req.userPermissions = user;
            next();

        } catch (error) {
            console.error('Any-Permission Check Error:', error);
            return res.status(500).json({ error: "Permission verification failed." });
        }
    };
};

/**
 * ==========================================
 * OWNERSHIP VERIFICATION
 * ==========================================
 * Allows action only if user owns the resource OR has admin permission
 * 
 * Usage:
 *   requireOwnershipOrPermission('user_id', 'can_edit_users')
 *   - First param: field name in request params containing owner ID
 *   - Second param: admin bypass permission
 */
const requireOwnershipOrPermission = (ownerField, bypassPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.user_id) {
                return res.status(401).json({ error: "Authentication required." });
            }

            const resourceOwnerId = parseInt(req.params[ownerField]);
            const currentUserId = req.user.user_id;

            // Check if user is the owner
            if (resourceOwnerId === currentUserId) {
                return next(); // User owns the resource, allow access
            }

            // If not owner, check if user has bypass permission
            const user = await prisma.user.findUnique({
                where: { user_id: currentUserId }
            });

            if (!user || !user.is_active) {
                return res.status(403).json({ error: "User account invalid." });
            }

            if (user[bypassPermission]) {
                req.userPermissions = user;
                return next(); // User has admin bypass permission
            }

            return res.status(403).json({ 
                error: "Forbidden: You can only modify your own resources.",
                hint: `Require ${bypassPermission} permission to modify others' resources.`
            });

        } catch (error) {
            console.error('Ownership Check Error:', error);
            return res.status(500).json({ error: "Ownership verification failed." });
        }
    };
};

module.exports = { 
    authenticateToken, 
    authorizeRole,
    requirePermission,
    requireAllPermissions,
    requireAnyPermission,
    requireOwnershipOrPermission
};
