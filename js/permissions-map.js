/**
 * ==========================================
 * PERMISSION-TO-FEATURE MAPPING (AUTOMATED)
 * ==========================================
 * Automatically maps database permissions to dashboard features
 * All permissions from the User model are checked dynamically
 */

// ===== ADMIN DASHBOARD FEATURES =====
const DASHBOARD_FEATURES = [
    {
        id: 'overview-tab',
        name: 'Dashboard Overview',
        icon: 'bi-speedometer2',
        requiredPermissions: [], // Always visible if user has admin access
        order: 1
    },
    {
        id: 'user-tab',
        name: 'User Management',
        icon: 'bi-people-fill',
        requiredPermissions: ['can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users', 'can_manage_permissions'],
        anyPermission: true, // Show if user has ANY user management permission
        order: 2
    },
    {
        id: 'attendance-tab',
        name: 'Attendance Management',
        icon: 'bi-calendar-check',
        requiredPermissions: ['can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance'],
        anyPermission: true, // Show if user has ANY admin attendance permission
        order: 3
    },
    {
        id: 'equipment-tab',
        name: 'Equipment Inventory',
        icon: 'bi-tools',
        requiredPermissions: ['can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment'],
        anyPermission: true, // Show if user has ANY equipment management permission
        order: 4
    },
    {
        id: 'portfolio-tab',
        name: 'Project Files',
        icon: 'bi-folder-fill',
        requiredPermissions: ['can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files'],
        anyPermission: true, // Show if user has ANY file management permission
        order: 5
    },
    {
        id: 'inquiry-tab',
        name: 'Client Inquiries',
        icon: 'bi-envelope-fill',
        requiredPermissions: ['can_view_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries'],
        anyPermission: true, // Show if user has ANY inquiry management permission
        order: 6
    },
    {
        id: 'health-tab',
        name: 'System Health',
        icon: 'bi-heart-pulse-fill',
        requiredPermissions: ['can_view_health_logs', 'can_export_health_logs', 'can_view_audit_trail', 'can_backup_database'],
        anyPermission: true, // Show if user has ANY system management permission
        order: 7
    },
    {
        id: 'reports-tab',
        name: 'Reports',
        icon: 'bi-file-earmark-bar-graph-fill',
        requiredPermissions: ['can_export_attendance', 'can_view_equipment', 'can_view_inquiries'],
        anyPermission: true,
        order: 8
    }
];

// ===== EMPLOYEE DASHBOARD FEATURES =====
const EMPLOYEE_FEATURES = [
    {
        id: 'user-tab',
        name: 'User Management',
        icon: 'bi-people-fill',
        requiredPermissions: ['can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users'],
        anyPermission: true,
        order: 1
    },
    {
        id: 'attendance-tab',
        name: 'Attendance Management',
        icon: 'bi-calendar-check',
        requiredPermissions: ['can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance'],
        anyPermission: true,
        order: 2
    },
    {
        id: 'equipment-tab',
        name: 'Equipment Inventory',
        icon: 'bi-tools',
        requiredPermissions: ['can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment'],
        anyPermission: true,
        order: 3
    },
    {
        id: 'files-tab',
        name: 'Project Files',
        icon: 'bi-folder-fill',
        requiredPermissions: ['can_view_files', 'can_download_files', 'can_upload_files', 'can_edit_files', 'can_delete_files'],
        anyPermission: true,
        order: 4
    },
    {
        id: 'inquiry-tab',
        name: 'Client Inquiries',
        icon: 'bi-envelope-fill',
        requiredPermissions: ['can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries'],
        anyPermission: true,
        order: 5
    },
    {
        id: 'system-tab',
        name: 'System Health',
        icon: 'bi-heart-pulse-fill',
        requiredPermissions: ['can_view_health_logs', 'can_export_health_logs', 'can_view_audit_trail', 'can_backup_database'],
        anyPermission: true,
        order: 6
    }
];

/**
 * Check if user has permission to access a feature
 * @param {Object} user - User object with permissions
 * @param {Object} feature - Feature definition
 * @returns {boolean}
 */
function hasFeatureAccess(user, feature) {
    // If no permissions required, always grant access
    if (!feature.requiredPermissions || feature.requiredPermissions.length === 0) {
        return true;
    }

    // If anyPermission is true, check if user has ANY of the required permissions
    if (feature.anyPermission) {
        const hasAccess = feature.requiredPermissions.some(perm => Boolean(user?.[perm]));
        console.log(`[Permissions] Feature "${feature.name}": ${hasAccess ? 'ACCESSIBLE' : 'BLOCKED'} (needs ANY of: ${feature.requiredPermissions.join(', ')})`);
        return hasAccess;
    }

    // Otherwise, user must have ALL required permissions
    const hasAccess = feature.requiredPermissions.every(perm => Boolean(user?.[perm]));
    console.log(`[Permissions] Feature "${feature.name}": ${hasAccess ? 'ACCESSIBLE' : 'BLOCKED'} (needs ALL of: ${feature.requiredPermissions.join(', ')})`);
    return hasAccess;
}

/**
 * Get available features for a user based on their permissions
 * @param {Object} user - User object with permissions
 * @param {boolean} isAdminDashboard - Whether this is for admin or employee dashboard
 * @returns {Array} Array of available features
 */
function getAvailableFeatures(user, isAdminDashboard = true) {
    const features = isAdminDashboard ? DASHBOARD_FEATURES : EMPLOYEE_FEATURES;
    
    return features
        .filter(feature => hasFeatureAccess(user, feature))
        .sort((a, b) => a.order - b.order);
}

/**
 * Render sidebar navigation based on user permissions
 * @param {Object} user - User object with permissions
 * @param {HTMLElement} navContainer - Navigation container element
 * @param {boolean} isAdminDashboard - Whether this is for admin or employee dashboard
 */
function renderDynamicNavigation(user, navContainer, isAdminDashboard = true) {
    const availableFeatures = getAvailableFeatures(user, isAdminDashboard);
    
    // DEBUG: Log what features are available
    console.log('[Permissions] DEBUG - renderDynamicNavigation:', {
        isAdminDashboard,
        availableFeaturesCount: availableFeatures.length,
        availableFeatures: availableFeatures.map(f => f.name),
        userPermissions: Object.keys(user).filter(k => k.startsWith('can_') && Boolean(user[k]))
    });
    
    if (availableFeatures.length === 0) {
        console.warn('[Permissions] WARNING: No features available! Showing fallback message.');
        navContainer.innerHTML = '<p style="color: #9ca3af; padding: 16px; text-align: center;">No features available</p>';
        return;
    }

    const adminSections = [
        {
            title: 'Menu',
            featureIds: ['overview-tab', 'user-tab', 'attendance-tab', 'equipment-tab', 'portfolio-tab', 'inquiry-tab']
        },
        {
            title: 'System',
            featureIds: ['reports-tab', 'health-tab']
        }
    ];

    if (isAdminDashboard) {
        const availableFeatureById = new Map(availableFeatures.map(feature => [feature.id, feature]));
        let isFirstRenderedLink = true;
        const sectionsHtml = [];

        adminSections.forEach(section => {
            const sectionFeatures = section.featureIds
                .map(featureId => availableFeatureById.get(featureId))
                .filter(Boolean);

            if (sectionFeatures.length === 0) return;

            sectionsHtml.push(`<div class="nav-section-title">${section.title}</div>`);

            sectionFeatures.forEach(feature => {
                const isActive = isFirstRenderedLink ? 'class="active"' : '';
                sectionsHtml.push(`<a href="#" ${isActive} data-target="${feature.id}">
            <i class="${feature.icon}"></i> ${feature.name}
        </a>`);
                isFirstRenderedLink = false;
            });
        });

        navContainer.innerHTML = sectionsHtml.join('');
    } else {
        navContainer.innerHTML = availableFeatures.map((feature, index) => {
            const isActive = index === 0 ? 'class="active"' : '';
            return `<a href="#" ${isActive} data-target="${feature.id}">
            <i class="${feature.icon}"></i> ${feature.name}
        </a>`;
        }).join('');
    }

    // Hide all tabs first
    const allTabs = document.querySelectorAll('.tab-section');
    allTabs.forEach(tab => tab.classList.add('hidden'));

    // Show first available tab by default
    if (availableFeatures.length > 0) {
        const firstTab = document.getElementById(availableFeatures[0].id);
        if (firstTab) {
            firstTab.classList.remove('hidden');
            
            // Update page title if it exists
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) {
                pageTitle.textContent = availableFeatures[0].name;
            }
        } else {
            console.error('[Permissions] ERROR: First tab element not found:', availableFeatures[0].id);
        }
    }
}

/**
 * Check if user should access admin dashboard
 * Strictly role-based: only ADMIN role can access admin dashboard
 * @param {Object} user - User object
 * @returns {boolean}
 */
function hasAdminAccess(user) {
    return user?.role === 'ADMIN';
}

/**
 * Get detailed permission analysis for a user
 * Useful for debugging and logging
 * @param {Object} user - User object
 * @returns {Object} Analysis of user permissions
 */
function analyzeUserPermissions(user) {
    const allPermissions = Object.keys(user).filter(key => key.startsWith('can_'));
    const grantedPermissions = allPermissions.filter(perm => Boolean(user?.[perm]));
    const deniedPermissions = allPermissions.filter(perm => !Boolean(user?.[perm]));
    
    const adminFeatures = getAvailableFeatures(user, true);
    const employeeFeatures = getAvailableFeatures(user, false);
    
    return {
        role: user.role,
        hasAdminAccess: hasAdminAccess(user),
        totalPermissions: allPermissions.length,
        grantedCount: grantedPermissions.length,
        deniedCount: deniedPermissions.length,
        grantedPermissions,
        deniedPermissions,
        availableAdminFeatures: adminFeatures.map(f => f.name),
        availableEmployeeFeatures: employeeFeatures.map(f => f.name)
    };
}

/**
 * Log permission changes for debugging
 * @param {Object} oldUser - Previous user state
 * @param {Object} newUser - New user state
 */
function logPermissionChanges(oldUser, newUser) {
    const oldPerms = Object.keys(oldUser).filter(k => k.startsWith('can_') && Boolean(oldUser[k]));
    const newPerms = Object.keys(newUser).filter(k => k.startsWith('can_') && Boolean(newUser[k]));
    
    const added = newPerms.filter(p => !oldPerms.includes(p));
    const removed = oldPerms.filter(p => !newPerms.includes(p));
    
    if (added.length > 0 || removed.length > 0) {
        console.log('[Permissions] Permission Changes Detected:', {
            user: newUser.email,
            added: added.length > 0 ? added : 'none',
            removed: removed.length > 0 ? removed : 'none',
            totalBefore: oldPerms.length,
            totalAfter: newPerms.length
        });
    }
    
    return { added, removed };
}
