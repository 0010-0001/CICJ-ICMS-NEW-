document.addEventListener('DOMContentLoaded', async () => {
    // Employee dashboard bootstrap: auth check, permission sync, then bind UI features.
    // --- 1. AUTHENTICATION CHECK ---
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        window.location.href = 'index.html';
        return;
    }

    let user = JSON.parse(userStr);

    function getCurrentPageName() {
        const path = window.location.pathname || '';
        const name = path.split('/').pop() || 'employee.html';
        return String(name).toLowerCase();
    }

    function redirectToAuthorizedDashboard(userData, reason = 'permission routing') {
        // Route strictly by role: EMPLOYEE users should always remain on employee portal.
        const targetPage = userData?.role === 'ADMIN' ? 'admin.html' : 'employee.html';
        const currentPage = getCurrentPageName();

        if (currentPage !== targetPage) {
            console.log(`[Employee Dashboard] Redirecting to ${targetPage} (${reason})`);
            window.location.href = targetPage;
            return true;
        }

        return false;
    }
    
    // DEBUG: Show what's in localStorage
    console.log('[Employee Dashboard] DEBUG - User from localStorage:', {
        email: user.email,
        role: user.role,
        allKeys: Object.keys(user),
        permissionKeys: Object.keys(user).filter(k => k.startsWith('can_')),
        truePermissions: Object.keys(user).filter(k => k.startsWith('can_') && Boolean(user[k]))
    });

    // --- 2. FETCH FRESH PERMISSIONS FROM SERVER ---
    async function refreshUserPermissions() {
        // Always ask server for latest permission flags before rendering controls.
        console.log('[Employee Dashboard] Fetching fresh permissions from server...');
        try {
            const response = await fetch('http://localhost:5000/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('[Employee Dashboard] API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                const freshUser = data.user;
                
                console.log('[Employee Dashboard] Fresh user data received:', {
                    email: freshUser.email,
                    role: freshUser.role,
                    permissionCount: Object.keys(freshUser).filter(k => k.startsWith('can_') && freshUser[k]).length
                });
                
                // Update localStorage with fresh permissions
                localStorage.setItem('user', JSON.stringify(freshUser));
                user = freshUser;

                if (redirectToAuthorizedDashboard(freshUser, 'fresh permission fetch')) {
                    return freshUser;
                }
                
                console.log('[Employee Dashboard] Permissions refreshed successfully');

                return freshUser;
            } else {
                console.error('[Employee Dashboard] API returned error:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('[Employee Dashboard] Permission refresh failed:', error);
            // Continue with cached permissions if refresh fails
        }
        console.log('[Employee Dashboard] Using cached permissions (fallback)');
        return user;
    }
    
    // Refresh permissions and wait for result
    user = await refreshUserPermissions();
    if (!user) return;
    if (redirectToAuthorizedDashboard(user, 'post-refresh check')) return;

    // Collect topbar controls once so all handlers share the same references.
    const topbarThemeRoot = document.getElementById('topbar-theme-root');
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    const topbarThemeBtnIcon = document.getElementById('topbar-theme-btn-icon');
    const topbarThemeMenu = document.getElementById('topbar-theme-menu');
    const topbarThemeOptions = document.querySelectorAll('.topbar-theme-option');
    const topbarNotificationRoot = document.getElementById('topbar-notification-root');
    const topbarNotificationBtn = document.getElementById('topbar-notification-btn');
    const topbarNotificationBadge = document.getElementById('topbar-notification-badge');
    const topbarNotificationMenu = document.getElementById('topbar-notification-menu');
    const topbarNotificationList = document.getElementById('topbar-notification-list');
    const topbarNotificationRefreshBtn = document.getElementById('topbar-notification-refresh-btn');
    // Local storage key for employee theme preference.
    const THEME_STORAGE_KEY = 'cicj_employee_theme_mode';

    function normalizeThemeMode(mode) {
        const value = String(mode || '').toLowerCase().trim();
        if (value === 'light' || value === 'dark' || value === 'neutral') return value;
        return 'neutral';
    }

    function applyThemeMode(mode, persist = true) {
        // Theme switcher for neutral/light/dark modes.
        const normalized = normalizeThemeMode(mode);
        document.body.classList.remove('theme-light', 'theme-dark');

        if (normalized === 'light') {
            document.body.classList.add('theme-light');
        } else if (normalized === 'dark') {
            document.body.classList.add('theme-dark');
        }

        if (topbarThemeBtnIcon) {
            if (normalized === 'light') {
                topbarThemeBtnIcon.className = 'bi bi-sun';
            } else if (normalized === 'dark') {
                topbarThemeBtnIcon.className = 'bi bi-moon-stars';
            } else {
                topbarThemeBtnIcon.className = 'bi bi-circle-half';
            }
        }

        topbarThemeOptions.forEach(option => {
            const isActive = option.dataset.themeMode === normalized;
            option.classList.toggle('active', isActive);
            option.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        if (persist) {
            localStorage.setItem(THEME_STORAGE_KEY, normalized);
        }
    }

    applyThemeMode(localStorage.getItem(THEME_STORAGE_KEY) || 'neutral', false);

    // --- 3. RENDER DYNAMIC NAVIGATION WITH FRESH PERMISSIONS ---
    const sidebarNav = document.getElementById('sidebar-nav');

    function hasPermission(permissionKey) {
        if (user?.role === 'ADMIN') return true;
        return Boolean(user?.[permissionKey]);
    }

    function setEmployeeTabPermissionNotice(tabId, shouldShow, message) {
        // Friendly notice for sections that are visible but restricted.
        const tab = document.getElementById(tabId);
        if (!tab) return;

        const noticeId = `${tabId}-permission-notice`;
        let notice = document.getElementById(noticeId);

        if (!shouldShow) {
            if (notice) notice.remove();
            return;
        }

        if (!notice) {
            notice = document.createElement('div');
            notice.id = noticeId;
            notice.className = 'table-container employee-permission-notice-shell';
            tab.appendChild(notice);
        }

        notice.innerHTML = `
            <div class="employee-permission-notice-card">
                <div class="employee-permission-notice-icon"><i class="bi bi-shield-lock"></i></div>
                <div class="employee-permission-notice-title">Limited access for this section</div>
                <div class="employee-permission-notice-message">${message}</div>
            </div>
        `;
    }

    const PERMISSION_GROUPS = [
        {
            title: 'User Management',
            items: [
                { key: 'can_view_users', label: 'View Users' },
                { key: 'can_add_users', label: 'Add Users' },
                { key: 'can_edit_users', label: 'Edit Users' },
                { key: 'can_delete_users', label: 'Delete Users' },
                { key: 'can_activate_users', label: 'Activate/Deactivate' }
            ]
        },
        {
            title: 'Attendance',
            items: [
                { key: 'can_view_own_attendance', label: 'View Own Attendance' },
                { key: 'can_view_all_attendance', label: 'View All Attendance' },
                { key: 'can_edit_attendance', label: 'Edit/Correct Logs' },
                { key: 'can_delete_attendance', label: 'Delete Logs' },
                { key: 'can_export_attendance', label: 'Export Reports' }
            ]
        },
        {
            title: 'Equipment',
            items: [
                { key: 'can_view_equipment', label: 'View Inventory' },
                { key: 'can_add_equipment', label: 'Add Equipment' },
                { key: 'can_edit_equipment', label: 'Edit Equipment' },
                { key: 'can_delete_equipment', label: 'Delete Equipment' },
                { key: 'can_assign_equipment', label: 'Assign to Workers' }
            ]
        },
        {
            title: 'Project Files',
            items: [
                { key: 'can_view_files', label: 'View Files' },
                { key: 'can_upload_files', label: 'Upload Files' },
                { key: 'can_edit_files', label: 'Edit Metadata' },
                { key: 'can_delete_files', label: 'Delete Files' },
                { key: 'can_download_files', label: 'Download Files' }
            ]
        },
        {
            title: 'Client Inquiries',
            items: [
                { key: 'can_view_inquiries', label: 'View Inquiries' },
                { key: 'can_add_inquiries', label: 'Submit Inquiries' },
                { key: 'can_update_inquiries', label: 'Update Status' },
                { key: 'can_delete_inquiries', label: 'Delete Inquiries' },
                { key: 'can_assign_inquiries', label: 'Assign to Team' }
            ]
        },
        {
            title: 'System Admin',
            items: [
                { key: 'can_view_health_logs', label: 'View Health Logs' },
                { key: 'can_export_health_logs', label: 'Export Logs (SAM)' },
                { key: 'can_view_audit_trail', label: 'View Audit Trail' },
                { key: 'can_backup_database', label: 'Database Backups' }
            ]
        }
    ];

    function renderEmployeePermissionMatrix() {
        // Build a readable granted/not-granted matrix from can_* permission flags.
        const matrixContainer = document.getElementById('employee-permission-matrix');
        const grantedCountEl = document.getElementById('permissions-granted-count');
        const deniedCountEl = document.getElementById('permissions-denied-count');
        const totalCountEl = document.getElementById('permissions-total-count');
        if (!matrixContainer) return;

        const permissionKeys = PERMISSION_GROUPS.flatMap(group => group.items.map(item => item.key));
        const grantedCount = permissionKeys.filter(key => Boolean(user?.[key])).length;
        const totalCount = permissionKeys.length;

        if (grantedCountEl) grantedCountEl.textContent = String(grantedCount);
        if (deniedCountEl) deniedCountEl.textContent = String(totalCount - grantedCount);
        if (totalCountEl) totalCountEl.textContent = String(totalCount);

        matrixContainer.innerHTML = PERMISSION_GROUPS.map(group => {
            const itemsHtml = group.items.map(item => {
                const isGranted = Boolean(user?.[item.key]);
                const icon = isGranted ? 'bi-check-square-fill' : 'bi-square';
                const stateClass = isGranted ? 'granted' : 'denied';
                const stateText = isGranted ? 'Granted' : 'Not Granted';

                return `
                    <div class="permission-item-row ${stateClass}">
                        <div class="permission-item-main">
                            <i class="bi ${icon}" aria-hidden="true"></i>
                            <span>${item.label}</span>
                        </div>
                        <span class="permission-state-pill ${stateClass}">${stateText}</span>
                    </div>
                `;
            }).join('');

            return `
                <article class="permission-group-card">
                    <h3>${group.title}</h3>
                    <div class="permission-group-items">
                        ${itemsHtml}
                    </div>
                </article>
            `;
        }).join('');
    }

    function enforceEmployeePermissionUi() {
        // Main permission gate for employee portal actions and tab data access.
        const canViewUsers = hasPermission('can_view_users');
        const canAddUsers = hasPermission('can_add_users');
        const canEditUsers = hasPermission('can_edit_users');
        const canDeleteUsers = hasPermission('can_delete_users');
        const canActivateUsers = hasPermission('can_activate_users');
        const canViewOwnAttendance = hasPermission('can_view_own_attendance');
        const canViewAllAttendance = hasPermission('can_view_all_attendance');
        const canEditAttendance = hasPermission('can_edit_attendance');
        const canDeleteAttendance = hasPermission('can_delete_attendance');
        const canExportAttendance = hasPermission('can_export_attendance');
        const canViewEquipment = hasPermission('can_view_equipment');
        const canAddEquipment = hasPermission('can_add_equipment');
        const canEditEquipment = hasPermission('can_edit_equipment');
        const canDeleteEquipment = hasPermission('can_delete_equipment');
        const canAssignEquipment = hasPermission('can_assign_equipment');
        const canViewFiles = hasPermission('can_view_files');
        const canDownloadFiles = hasPermission('can_download_files');
        const canUploadFiles = hasPermission('can_upload_files');
        const canEditFiles = hasPermission('can_edit_files');
        const canDeleteFiles = hasPermission('can_delete_files');
        const canViewInquiries = hasPermission('can_view_inquiries');
        const canAddInquiries = hasPermission('can_add_inquiries');
        const canUpdateInquiries = hasPermission('can_update_inquiries');
        const canDeleteInquiries = hasPermission('can_delete_inquiries');
        const canAssignInquiries = hasPermission('can_assign_inquiries');
        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canExportHealthLogs = hasPermission('can_export_health_logs');
        const canManagePermissions = hasPermission('can_manage_permissions');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');
        const canBackupDatabase = hasPermission('can_backup_database');

        const employeeAddUserBtn = document.getElementById('employee-add-user-btn');
        const employeeUsersTableBody = document.getElementById('employee-users-table-body');
        const attendanceExportBtn = document.getElementById('attendance-export-btn');
        const teamAttendanceShell = document.getElementById('team-attendance-shell');
        const addEquipmentBtn = document.getElementById('add-equipment-btn');
        const equipmentInventoryShell = document.getElementById('equipment-inventory-shell');
        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const attendanceTableBody = document.getElementById('attendance-table-body');
        const scanEquipmentBtn = document.getElementById('scan-equipment-btn');
        const equipmentTableBody = document.getElementById('equipment-table-body');
        const filesSearchInput = document.getElementById('files-search-input');
        const filesStorageFilter = document.getElementById('files-storage-filter');
        const openFileUploadBtn = document.getElementById('open-file-upload-btn');
        const projectFileInput = document.getElementById('project-file-input');
        const projectFileCategory = document.getElementById('project-file-category');
        const submitFileUploadBtn = document.getElementById('submit-file-upload-btn');
        const inquiryCreateShell = document.getElementById('inquiry-create-shell');
        const inquirySubmitBtn = document.getElementById('admin-inquiry-submit-btn');
        const inquirySearchInput = document.getElementById('inquiry-search-input');
        const inquiryStatusFilter = document.getElementById('inquiry-status-filter');
        const inquiryClientNameInput = document.getElementById('admin-inquiry-client-name');
        const inquiryClientEmailInput = document.getElementById('admin-inquiry-client-email');
        const inquirySubjectInput = document.getElementById('admin-inquiry-subject');
        const inquiryMessageInput = document.getElementById('admin-inquiry-message');
        const exportLogsBtn = document.getElementById('export-logs-btn');
        const triggerBackupBtn = document.getElementById('trigger-backup-btn');
        const healthOverviewShell = document.getElementById('health-overview-shell');
        const healthSiemShell = document.getElementById('health-siem-shell');
        const healthBackupShell = document.getElementById('health-backup-shell');
        const healthAuditShell = document.getElementById('health-audit-shell');

        if (employeeAddUserBtn) employeeAddUserBtn.classList.toggle('hidden', !canAddUsers);
        if (attendanceExportBtn) attendanceExportBtn.classList.toggle('hidden', !canExportAttendance);
        if (teamAttendanceShell) teamAttendanceShell.classList.toggle('hidden', !canViewAllAttendance);
        if (addEquipmentBtn) addEquipmentBtn.classList.toggle('hidden', !canAddEquipment);
        if (equipmentInventoryShell) equipmentInventoryShell.classList.toggle('hidden', !canViewEquipment && !canAddEquipment && !canEditEquipment && !canDeleteEquipment && !canAssignEquipment);
        if (inquiryCreateShell) inquiryCreateShell.classList.toggle('hidden', !canAddInquiries);
        if (inquirySubmitBtn) inquirySubmitBtn.disabled = !canAddInquiries;
        if (inquirySearchInput) inquirySearchInput.disabled = !canViewInquiries;
        if (inquiryStatusFilter) inquiryStatusFilter.disabled = !canViewInquiries;
        if (inquiryClientNameInput) inquiryClientNameInput.disabled = !canAddInquiries;
        if (inquiryClientEmailInput) inquiryClientEmailInput.disabled = !canAddInquiries;
        if (inquirySubjectInput) inquirySubjectInput.disabled = !canAddInquiries;
        if (inquiryMessageInput) inquiryMessageInput.disabled = !canAddInquiries;
        if (exportLogsBtn) exportLogsBtn.classList.toggle('hidden', !canExportHealthLogs);
        if (triggerBackupBtn) triggerBackupBtn.classList.toggle('hidden', !canBackupDatabase);
        if (healthOverviewShell) healthOverviewShell.classList.toggle('hidden', !canViewHealthLogs);
        if (healthSiemShell) healthSiemShell.classList.toggle('hidden', !canViewHealthLogs);
        if (healthBackupShell) healthBackupShell.classList.toggle('hidden', !canViewHealthLogs && !canBackupDatabase);
        // Audit trail panel is controlled only by audit-trail permission.
        if (healthAuditShell) healthAuditShell.classList.toggle('hidden', !canViewAuditTrail);
        if (clockInBtn) clockInBtn.disabled = !canViewOwnAttendance;
        if (clockOutBtn) clockOutBtn.disabled = !canViewOwnAttendance;
        if (scanEquipmentBtn) scanEquipmentBtn.disabled = !canViewEquipment && !canAssignEquipment;
        if (filesSearchInput) filesSearchInput.disabled = !canViewFiles && !canDownloadFiles && !canEditFiles && !canDeleteFiles;
        if (filesStorageFilter) filesStorageFilter.disabled = !canViewFiles && !canDownloadFiles;
        if (openFileUploadBtn) openFileUploadBtn.classList.toggle('hidden', !canUploadFiles);
        if (projectFileInput) projectFileInput.disabled = !canUploadFiles;
        if (projectFileCategory) projectFileCategory.disabled = !canUploadFiles;
        if (submitFileUploadBtn) submitFileUploadBtn.disabled = !canUploadFiles;

        if (!canViewUsers && employeeUsersTableBody) {
            employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view users.</td></tr>';
        }

        if (!canViewOwnAttendance && attendanceTableBody) {
            attendanceTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view attendance records.</td></tr>';
        }

        if (!canViewEquipment && equipmentTableBody) {
            equipmentTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view equipment records.</td></tr>';
        }

        setEmployeeTabPermissionNotice('user-tab', !canViewUsers && !canAddUsers && !canEditUsers && !canDeleteUsers && !canActivateUsers, 'You do not have permission to access user management features.');
        setEmployeeTabPermissionNotice('attendance-tab', !canViewOwnAttendance && !canViewAllAttendance && !canEditAttendance && !canDeleteAttendance && !canExportAttendance, 'You do not have permission to access attendance features.');
        setEmployeeTabPermissionNotice('equipment-tab', !canViewEquipment && !canAddEquipment && !canEditEquipment && !canDeleteEquipment && !canAssignEquipment, 'You do not have permission to access equipment features.');
        setEmployeeTabPermissionNotice('files-tab', !canViewFiles && !canDownloadFiles && !canUploadFiles && !canEditFiles && !canDeleteFiles, 'You do not have permission to access project files.');
        setEmployeeTabPermissionNotice('inquiry-tab', !canViewInquiries && !canAddInquiries && !canUpdateInquiries && !canDeleteInquiries && !canAssignInquiries, 'You do not have permission to access inquiry features.');
        setEmployeeTabPermissionNotice('system-tab', !canViewHealthLogs && !canExportHealthLogs && !canViewAuditTrail && !canBackupDatabase, 'You do not have permission to access system health features.');
    }

    // On employee page, always render employee features only.
    renderDynamicNavigation(user, sidebarNav, false);
    enforceEmployeePermissionUi();
    renderEmployeePermissionMatrix();
    
    // Log initial permission analysis
    console.log('[Employee Dashboard] Employee Dashboard Loaded:', analyzeUserPermissions(user));
    
    // --- 4. PERIODIC PERMISSION REFRESH (Check every 5 seconds for changes) ---
    setInterval(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch('http://localhost:5000/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const freshUser = data.user;

                if (redirectToAuthorizedDashboard(freshUser, 'background permission sync')) {
                    return;
                }
                
                // Get old and new permissions
                const oldPerms = Object.keys(user).filter(k => k.startsWith('can_') && Boolean(user[k]));
                const newPerms = Object.keys(freshUser).filter(k => k.startsWith('can_') && Boolean(freshUser[k]));
                
                // Check if any permissions changed
                const permsChanged = oldPerms.length !== newPerms.length || 
                                   !oldPerms.every(p => newPerms.includes(p)) ||
                                   !newPerms.every(p => oldPerms.includes(p));
                
                if (permsChanged) {
                    // Use new logging utility
                    const changes = logPermissionChanges(user, freshUser);
                    
                    // Update localStorage
                    localStorage.setItem('user', JSON.stringify(freshUser));
                    user = freshUser;
                    
                    // Re-render navigation (employee feature set only on this page)
                    renderDynamicNavigation(freshUser, sidebarNav, false);
                    enforceEmployeePermissionUi();
                    renderEmployeePermissionMatrix();
                    
                    // Show notification based on what changed
                    let message;
                    if (changes.added.length > 0 && changes.removed.length === 0) {
                        message = `New permissions granted! ${changes.added.length} new feature(s) available.`;
                    } else if (changes.removed.length > 0 && changes.added.length === 0) {
                        message = `WARNING: Permissions removed. ${changes.removed.length} feature(s) no longer available.`;
                    } else {
                        message = `Permissions updated. Check your dashboard for changes.`;
                    }
                    
                    // Create notification
                    const notification = document.createElement('div');
                    notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#2dad50;color:white;padding:15px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:10000;animation:slideIn 0.3s ease;';
                    notification.textContent = message;
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.style.animation = 'slideOut 0.3s ease';
                        setTimeout(() => notification.remove(), 300);
                    }, 5000);
                }
            }
        } catch (error) {
            console.warn('[Employee Dashboard] Background permission check failed:', error);
        }
    }, 5000); // Check every 5 seconds for faster updates

    // --- 3. POPULATE USER INFO ---
    document.getElementById('welcome-message').textContent = `Welcome, ${user.full_name}`;
    document.getElementById('profile-name').textContent = user.full_name;
    document.getElementById('profile-email').textContent = user.email || 'N/A';
    document.getElementById('profile-role').textContent = user.role;
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserRole = document.getElementById('sidebar-user-role');
    const sidebarProfileAvatar = document.getElementById('sidebar-profile-avatar');
    const sidebarProfileAvatarImage = document.getElementById('sidebar-profile-avatar-image');
    const sidebarProfileMenuBtn = document.getElementById('sidebar-profile-menu-btn');

    if (sidebarUserName) {
        sidebarUserName.textContent = user.full_name || 'Employee User';
    }
    if (sidebarUserRole) {
        const roleText = String(user.role || 'employee');
        sidebarUserRole.textContent = roleText.charAt(0).toUpperCase() + roleText.slice(1).toLowerCase();
    }
    const inlineProfileContact = document.getElementById('profile-contact');
    if (inlineProfileContact) {
        inlineProfileContact.textContent = user.contact_number || user.contact || 'N/A';
    }

    // --- 3A. PROFILE MODAL ---
    const profileModal = document.getElementById('profile-modal');
    const profileModalCloseBtn = document.getElementById('profile-modal-close-btn');
    const profileModalCloseActionBtn = document.getElementById('profile-modal-close-action-btn');
    const profileModalAvatar = document.getElementById('profile-modal-avatar');
    const profileModalAvatarImage = document.getElementById('profile-modal-avatar-image');
    const profileModalName = document.getElementById('profile-modal-name');
    const profileModalRole = document.getElementById('profile-modal-role');
    const profileModalEmail = document.getElementById('profile-modal-email');
    const profileModalContact = document.getElementById('profile-modal-contact');
    const profileModalCreatedAt = document.getElementById('profile-modal-created-at');
    const profileModalTabButtons = document.querySelectorAll('.profile-modal-tab-btn');
    const profileModalPanels = document.querySelectorAll('.profile-modal-panel');
    const profilePhotoPreview = document.getElementById('profile-photo-preview');
    const profilePhotoPreviewImage = document.getElementById('profile-photo-preview-image');
    const profilePhotoInput = document.getElementById('profile-photo-input');
    const profilePhotoChooseBtn = document.getElementById('profile-photo-choose-btn');
    const profilePhotoSaveBtn = document.getElementById('profile-photo-save-btn');
    const profilePhotoRemoveBtn = document.getElementById('profile-photo-remove-btn');
    const profilePhotoStatus = document.getElementById('profile-photo-status');
    const profileRecordsTotal = document.getElementById('profile-records-total');
    const profileRecordsCheckins = document.getElementById('profile-records-checkins');
    const profileRecordsCheckouts = document.getElementById('profile-records-checkouts');
    const profileRecordsList = document.getElementById('profile-records-list');
    const profileActivityList = document.getElementById('profile-activity-list');
    let profilePhotoDraftDataUrl = null;

    function formatRoleLabel(role) {
        if (!role) return '-';
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return '-';
        return dt.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function formatRelativeTime(value) {
        if (!value) return 'Unknown time';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return 'Unknown time';

        const diffMs = Date.now() - dt.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;

        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;

        return dt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function getCurrentUserProfilePhoto() {
        const value = typeof user?.profile_photo === 'string' ? user.profile_photo.trim() : '';
        return value || '';
    }

    function setProfilePhotoStatus(message, tone = 'neutral') {
        if (!profilePhotoStatus) return;
        profilePhotoStatus.textContent = message;
        profilePhotoStatus.classList.remove('success', 'error');
        if (tone === 'success') profilePhotoStatus.classList.add('success');
        if (tone === 'error') profilePhotoStatus.classList.add('error');
    }

    function applyProfilePhoto(photoDataUrl) {
        const hasPhoto = Boolean(photoDataUrl);

        if (sidebarProfileAvatarImage) {
            sidebarProfileAvatarImage.src = hasPhoto ? photoDataUrl : '';
        }
        if (profileModalAvatarImage) {
            profileModalAvatarImage.src = hasPhoto ? photoDataUrl : '';
        }
        if (profilePhotoPreviewImage) {
            profilePhotoPreviewImage.src = hasPhoto ? photoDataUrl : '';
        }

        if (sidebarProfileAvatar) {
            sidebarProfileAvatar.classList.toggle('has-image', hasPhoto);
        }
        if (profileModalAvatar) {
            profileModalAvatar.classList.toggle('has-image', hasPhoto);
        }
        if (profilePhotoPreview) {
            profilePhotoPreview.classList.toggle('has-image', hasPhoto);
        }
    }

    function loadProfilePhotoFromUser() {
        const savedPhoto = getCurrentUserProfilePhoto();
        profilePhotoDraftDataUrl = savedPhoto || null;
        applyProfilePhoto(savedPhoto || '');
    }

    function setProfileModalTab(tabName) {
        profileModalTabButtons.forEach(button => {
            const isActive = button.dataset.profileTab === tabName;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        profileModalPanels.forEach(panel => {
            const isActive = panel.dataset.profilePanel === tabName;
            panel.classList.toggle('active', isActive);
            panel.hidden = !isActive;
        });
    }

    function renderProfileUserInfo() {
        if (profileModalName) profileModalName.textContent = user.full_name || '-';
        if (profileModalRole) profileModalRole.textContent = formatRoleLabel(user.role);
        if (profileModalEmail) profileModalEmail.textContent = user.email || '-';
        if (profileModalContact) profileModalContact.textContent = user.contact_number || user.contact || '-';
        if (profileModalCreatedAt) profileModalCreatedAt.textContent = formatDateTime(user.created_at);
    }

    function renderAttendanceRecords(attendance) {
        if (!profileRecordsList) return;
        const records = Array.isArray(attendance) ? attendance : [];
        const checkIns = records.filter(item => item.action === 'clock_in').length;
        const checkOuts = records.filter(item => item.action === 'clock_out').length;

        if (profileRecordsTotal) profileRecordsTotal.textContent = String(records.length);
        if (profileRecordsCheckins) profileRecordsCheckins.textContent = String(checkIns);
        if (profileRecordsCheckouts) profileRecordsCheckouts.textContent = String(checkOuts);

        if (records.length === 0) {
            profileRecordsList.innerHTML = '<div class="profile-records-empty">No attendance records found for your account.</div>';
            return;
        }

        profileRecordsList.innerHTML = records.slice(0, 30).map(record => {
            const action = record.action === 'clock_out' ? 'clock_out' : 'clock_in';
            const actionLabel = action === 'clock_out' ? 'Clock Out' : 'Clock In';
            const latitude = record.location_lat ? Number(record.location_lat).toFixed(5) : null;
            const longitude = record.location_lng ? Number(record.location_lng).toFixed(5) : null;
            const locationText = latitude && longitude
                ? `Lat ${latitude}, Lng ${longitude}`
                : 'No location captured';

            return `
                <article class="profile-record-item">
                    <div class="profile-record-item-top">
                        <span class="profile-record-badge ${action === 'clock_out' ? 'clock-out' : 'clock-in'}">${actionLabel}</span>
                        <span class="profile-record-time">${escapeHtml(formatDateTime(record.timestamp))}</span>
                    </div>
                    <p class="profile-record-meta">${escapeHtml(locationText)}</p>
                </article>
            `;
        }).join('');
    }

    function renderProfileActivity(items) {
        if (!profileActivityList) return;
        const feedItems = Array.isArray(items) ? items : [];

        if (feedItems.length === 0) {
            profileActivityList.innerHTML = '<div class="profile-activity-empty">No recent activity available.</div>';
            return;
        }

        profileActivityList.innerHTML = feedItems.slice(0, 20).map(item => {
            const title = item.title || 'System Activity';
            const message = item.message || 'Recent update available.';
            const severity = ['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'low';

            return `
                <article class="profile-activity-item">
                    <div class="profile-activity-item-top">
                        <strong>${escapeHtml(title)}</strong>
                        <span class="profile-activity-severity ${severity}">${severity.toUpperCase()}</span>
                    </div>
                    <p class="profile-activity-message">${escapeHtml(message)}</p>
                    <span class="profile-activity-time">${escapeHtml(formatRelativeTime(item.timestamp))}</span>
                </article>
            `;
        }).join('');
    }

    async function loadProfileAttendanceRecords() {
        if (!profileRecordsList) return [];
        profileRecordsList.innerHTML = '<div class="profile-records-empty">Loading records...</div>';

        try {
            const response = await fetch('http://localhost:5000/api/attendance/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                profileRecordsList.innerHTML = '<div class="profile-records-empty">You do not currently have access to view attendance records.</div>';
                if (profileRecordsTotal) profileRecordsTotal.textContent = '0';
                if (profileRecordsCheckins) profileRecordsCheckins.textContent = '0';
                if (profileRecordsCheckouts) profileRecordsCheckouts.textContent = '0';
                return [];
            }

            if (!response.ok) {
                throw new Error(`Attendance request failed (${response.status})`);
            }

            const data = await response.json();
            const records = data.attendance || [];
            renderAttendanceRecords(records);
            return records;
        } catch (error) {
            console.warn('Profile attendance load failed:', error.message);
            profileRecordsList.innerHTML = '<div class="profile-records-empty">Unable to load attendance records right now.</div>';
            if (profileRecordsTotal) profileRecordsTotal.textContent = '0';
            if (profileRecordsCheckins) profileRecordsCheckins.textContent = '0';
            if (profileRecordsCheckouts) profileRecordsCheckouts.textContent = '0';
            return [];
        }
    }

    async function loadProfileActivityFeed(attendanceRecords = []) {
        try {
            const response = await fetch('http://localhost:5000/api/notifications?limit=20', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const notifications = Array.isArray(data.notifications) ? data.notifications : [];
                const mapped = notifications.map(item => ({
                    title: 'System Notification',
                    message: String(item.description || 'A system update was recorded.'),
                    timestamp: item.timestamp,
                    severity: 'low'
                }));
                renderProfileActivity(mapped);
                return;
            }
        } catch (error) {
            console.warn('Profile notifications unavailable, using local activity fallback:', error.message);
        }

        const fallback = [];
        const todayStatusText = (document.getElementById('today-status')?.textContent || 'Not Clocked In').trim();
        fallback.push({
            title: 'Attendance Status',
            message: `Today's status is ${todayStatusText}.`,
            timestamp: new Date().toISOString(),
            severity: 'low'
        });

        const checkedOutText = (document.getElementById('equipment-checked-out')?.textContent || '0').trim();
        fallback.push({
            title: 'Equipment Summary',
            message: `You currently have ${checkedOutText} equipment item(s) checked out.`,
            timestamp: new Date().toISOString(),
            severity: 'low'
        });

        if (attendanceRecords.length > 0) {
            const latest = attendanceRecords[0];
            const latestAction = latest?.action === 'clock_out' ? 'Clock Out' : 'Clock In';
            fallback.push({
                title: 'Latest Attendance Record',
                message: `${latestAction} recorded at ${formatDateTime(latest?.timestamp)}.`,
                timestamp: latest?.timestamp,
                severity: 'medium'
            });
        }

        renderProfileActivity(fallback);
    }

    async function openProfileModal() {
        if (!profileModal) return;
        renderProfileUserInfo();
        loadProfilePhotoFromUser();
        setProfileModalTab('profile');
        setProfilePhotoStatus('Your profile photo is synced across the system.');
        profileModal.classList.add('active');
        const records = await loadProfileAttendanceRecords();
        await loadProfileActivityFeed(records);
    }

    function closeProfileModal() {
        if (!profileModal) return;
        profileModal.classList.remove('active');
    }

    renderProfileUserInfo();
    loadProfilePhotoFromUser();

    if (sidebarProfileMenuBtn && profileModal) {
        sidebarProfileMenuBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await openProfileModal();
        });
    }

    profileModalTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            setProfileModalTab(button.dataset.profileTab || 'profile');
        });
    });

    if (profilePhotoChooseBtn && profilePhotoInput) {
        profilePhotoChooseBtn.addEventListener('click', () => {
            profilePhotoInput.click();
        });
    }

    if (profilePhotoInput) {
        profilePhotoInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const isImage = file.type.startsWith('image/');
            if (!isImage) {
                setProfilePhotoStatus('Please choose an image file.', 'error');
                profilePhotoInput.value = '';
                return;
            }

            const maxFileSizeBytes = 4 * 1024 * 1024;
            if (file.size > maxFileSizeBytes) {
                setProfilePhotoStatus('Image must be 4 MB or smaller.', 'error');
                profilePhotoInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                profilePhotoDraftDataUrl = String(reader.result || '');
                applyProfilePhoto(profilePhotoDraftDataUrl);
                setProfilePhotoStatus('Preview updated. Click Save Photo to keep this image.', 'success');
            };
            reader.onerror = () => {
                setProfilePhotoStatus('Unable to preview this image. Try another file.', 'error');
            };
            reader.readAsDataURL(file);
            profilePhotoInput.value = '';
        });
    }

    if (profilePhotoSaveBtn) {
        profilePhotoSaveBtn.addEventListener('click', async () => {
            if (!profilePhotoDraftDataUrl) {
                setProfilePhotoStatus('Choose an image before saving.', 'error');
                return;
            }

            try {
                profilePhotoSaveBtn.disabled = true;
                const response = await fetch('http://localhost:5000/api/me/profile-photo', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ photo_data_url: profilePhotoDraftDataUrl })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || `Save failed (${response.status})`);
                }

                user.profile_photo = data.profile_photo || null;
                localStorage.setItem('user', JSON.stringify(user));
                loadProfilePhotoFromUser();
                setProfilePhotoStatus('Profile photo saved and synced system-wide.', 'success');
            } catch (error) {
                setProfilePhotoStatus(error.message || 'Failed to save profile photo.', 'error');
            } finally {
                profilePhotoSaveBtn.disabled = false;
            }
        });
    }

    if (profilePhotoRemoveBtn) {
        profilePhotoRemoveBtn.addEventListener('click', async () => {
            const hasSavedPhoto = Boolean(getCurrentUserProfilePhoto());
            const hasDraftPhoto = Boolean(profilePhotoDraftDataUrl);
            if (!hasSavedPhoto && !hasDraftPhoto) {
                setProfilePhotoStatus('No profile photo to remove.', 'error');
                return;
            }

            const shouldRemove = await openSharedConfirmModal({
                title: 'Remove Profile Photo',
                subtitle: 'This updates your account across the system.',
                message: 'Are you sure you want to remove your profile photo?',
                confirmText: 'Remove',
                danger: true
            });
            if (!shouldRemove) {
                return;
            }

            try {
                profilePhotoRemoveBtn.disabled = true;
                const response = await fetch('http://localhost:5000/api/me/profile-photo', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ photo_data_url: null })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || `Remove failed (${response.status})`);
                }

                user.profile_photo = null;
                profilePhotoDraftDataUrl = null;
                localStorage.setItem('user', JSON.stringify(user));
                applyProfilePhoto('');
                setProfilePhotoStatus('Profile photo removed system-wide.', 'success');
            } catch (error) {
                setProfilePhotoStatus(error.message || 'Failed to remove profile photo.', 'error');
            } finally {
                profilePhotoRemoveBtn.disabled = false;
            }
        });
    }

    if (profileModalCloseBtn) {
        profileModalCloseBtn.addEventListener('click', closeProfileModal);
    }

    if (profileModalCloseActionBtn) {
        profileModalCloseActionBtn.addEventListener('click', closeProfileModal);
    }

    if (profileModal) {
        profileModal.addEventListener('click', (event) => {
            if (event.target === profileModal) {
                closeProfileModal();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && profileModal?.classList.contains('active')) {
            closeProfileModal();
        }
    });

    // --- 4. LOGOUT FUNCTIONALITY ---
    const logoutModal = document.getElementById('logout-modal');
    const logoutBtn = document.getElementById('logout-btn');
    const logoutCancelBtn = document.getElementById('logout-cancel-btn');
    const logoutConfirmBtn = document.getElementById('logout-confirm-btn');
    const logoutUserName = document.getElementById('logout-user-name');
    const logoutUserRole = document.getElementById('logout-user-role');

    // Set user info in logout modal
    logoutUserName.textContent = user.full_name;
    logoutUserRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase();

    // Open logout modal
    logoutBtn.addEventListener('click', () => {
        logoutModal.classList.add('active');
    });

    function getTopbarNotificationSeverity(notification = {}) {
        const description = String(notification.description || '');
        const match = description.match(/\[NOTIFICATION\]\[([A-Z]+)\]/i);
        const severity = String(match?.[1] || notification.severity || 'LOW').toLowerCase();
        if (severity === 'high' || severity === 'medium') return severity;
        return 'low';
    }

    function formatTopbarNotificationDetails(rawMessage = '') {
        const text = String(rawMessage || '').trim();
        const jsonStart = text.indexOf('{');
        if (jsonStart === -1) return text;

        const prefix = text.slice(0, jsonStart).replace(/[|:-]\s*$/, '').trim();
        const jsonText = text.slice(jsonStart).trim();

        try {
            const payload = JSON.parse(jsonText);
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                return text;
            }

            const parts = [];
            if (payload.equipment_name) parts.push(`Equipment: ${payload.equipment_name}`);
            if (payload.available_count !== undefined) parts.push(`Available: ${payload.available_count}`);
            if (payload.total_count !== undefined) parts.push(`Total: ${payload.total_count}`);
            if (payload.total_quantity !== undefined) parts.push(`Total: ${payload.total_quantity}`);
            if (payload.minimum_threshold !== undefined) parts.push(`Minimum: ${payload.minimum_threshold}`);
            if (payload.minimum_required !== undefined) parts.push(`Minimum: ${payload.minimum_required}`);

            if (!parts.length) {
                const scalarParts = Object.entries(payload)
                    .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
                    .slice(0, 3)
                    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
                parts.push(...scalarParts);
            }

            if (!parts.length) {
                return prefix || text;
            }

            const details = parts.join(' | ');
            if (prefix.toLowerCase() === 'equipment') return details;
            return prefix ? `${prefix} - ${details}` : details;
        } catch {
            return text;
        }
    }

    function parseTopbarNotificationText(description = '') {
        const cleaned = String(description)
            .replace(/^\[NOTIFICATION\]\[[A-Z]+\]\s*/i, '')
            .replace(/\s+\|\s*context=.*$/i, '')
            .trim();

        const separatorIndex = cleaned.indexOf(' | ');
        if (separatorIndex === -1) {
            const message = formatTopbarNotificationDetails(cleaned || 'A new system notification was received.');
            return { title: 'System Notification', message };
        }

        const title = cleaned.slice(0, separatorIndex).trim() || 'System Notification';
        const messageRaw = cleaned.slice(separatorIndex + 3).trim() || 'A new system notification was received.';
        const message = formatTopbarNotificationDetails(messageRaw);
        return { title, message };
    }

    function renderTopbarNotifications(items) {
        if (!topbarNotificationList) return;
        const notifications = Array.isArray(items) ? items : [];

        if (!notifications.length) {
            topbarNotificationList.innerHTML = '<div class="topbar-notification-empty">No notifications yet.</div>';
            if (topbarNotificationBadge) {
                topbarNotificationBadge.classList.add('hidden');
                topbarNotificationBadge.textContent = '0';
            }
            return;
        }
        topbarNotificationList.innerHTML = notifications.slice(0, 20).map(item => {
            const parsed = parseTopbarNotificationText(item.description || '');
            const severity = getTopbarNotificationSeverity(item);
            const timestamp = item.timestamp
                ? new Date(item.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '--';

            return `
                <article class="topbar-notification-item">
                    <div class="topbar-notification-item-head">
                        <h4 class="topbar-notification-title">${escapeHtml(parsed.title)}</h4>
                        <span class="topbar-notification-severity ${severity}">${severity.toUpperCase()}</span>
                    </div>
                    <p class="topbar-notification-message">${escapeHtml(parsed.message)}</p>
                    <time class="topbar-notification-time">${escapeHtml(timestamp)}</time>
                </article>
            `;
        }).join('');

        if (topbarNotificationBadge) {
            const count = notifications.length;
            topbarNotificationBadge.textContent = String(Math.min(count, 99));
            topbarNotificationBadge.classList.toggle('hidden', count <= 0);
        }
    }

    async function loadTopbarNotifications() {
        if (!topbarNotificationList) return;
        try {
            const response = await fetch('http://localhost:5000/api/notifications?limit=20', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Notifications unavailable (${response.status})`);
            const data = await response.json();
            const notifications = Array.isArray(data.notifications) ? data.notifications : [];
            renderTopbarNotifications(notifications);
            if (topbarNotificationBadge) {
                const unread = Number(data.unread_count);
                const badgeCount = Number.isFinite(unread) ? unread : notifications.length;
                topbarNotificationBadge.textContent = badgeCount > 99 ? '99+' : String(Math.max(0, badgeCount));
                topbarNotificationBadge.classList.toggle('hidden', badgeCount <= 0);
            }
        } catch (error) {
            console.warn('Topbar notifications unavailable:', error.message);
            renderTopbarNotifications([]);
        }
    }

    if (topbarThemeBtn && topbarThemeRoot) {
        topbarThemeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (topbarNotificationRoot) {
                topbarNotificationRoot.classList.remove('open');
            }
            if (topbarNotificationBtn) {
                topbarNotificationBtn.setAttribute('aria-expanded', 'false');
            }
            const isOpen = topbarThemeRoot.classList.toggle('open');
            topbarThemeBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    if (topbarNotificationBtn && topbarNotificationRoot) {
        topbarNotificationBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (topbarThemeRoot) {
                topbarThemeRoot.classList.remove('open');
            }
            if (topbarThemeBtn) {
                topbarThemeBtn.setAttribute('aria-expanded', 'false');
            }
            const isOpen = topbarNotificationRoot.classList.toggle('open');
            topbarNotificationBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                await loadTopbarNotifications();
            }
        });
    }

    topbarThemeOptions.forEach(option => {
        option.addEventListener('click', (event) => {
            event.preventDefault();
            const selectedMode = option.dataset.themeMode || 'neutral';
            applyThemeMode(selectedMode, true);
            if (topbarThemeRoot) {
                topbarThemeRoot.classList.remove('open');
            }
            if (topbarThemeBtn) {
                topbarThemeBtn.setAttribute('aria-expanded', 'false');
            }
        });
    });

    if (topbarThemeMenu) {
        topbarThemeMenu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    if (topbarNotificationMenu) {
        topbarNotificationMenu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    if (topbarNotificationRefreshBtn) {
        topbarNotificationRefreshBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await loadTopbarNotifications();
        });
    }

    document.addEventListener('click', () => {
        if (topbarThemeRoot) {
            topbarThemeRoot.classList.remove('open');
        }
        if (topbarThemeBtn) {
            topbarThemeBtn.setAttribute('aria-expanded', 'false');
        }
        if (topbarNotificationRoot) {
            topbarNotificationRoot.classList.remove('open');
        }
        if (topbarNotificationBtn) {
            topbarNotificationBtn.setAttribute('aria-expanded', 'false');
        }
    });

    loadTopbarNotifications();
    setInterval(loadTopbarNotifications, 30000);

    // Cancel logout
    logoutCancelBtn.addEventListener('click', () => {
        logoutModal.classList.remove('active');
    });

    // Close modal on overlay click
    logoutModal.addEventListener('click', (e) => {
        if (e.target === logoutModal) {
            logoutModal.classList.remove('active');
        }
    });

    // Confirm logout
    logoutConfirmBtn.addEventListener('click', () => {
        const savedThemeMode = localStorage.getItem(THEME_STORAGE_KEY);
        localStorage.clear();
        if (savedThemeMode) {
            localStorage.setItem(THEME_STORAGE_KEY, savedThemeMode);
        }
        window.location.href = 'index.html';
    });

    // --- 5. TAB SWITCHING LOGIC (using event delegation for dynamic links) ---
    const pageTitle = document.getElementById('page-title');

    function loadEmployeeTabData(targetId) {
        if (targetId === 'user-tab') {
            window.loadEmployeeUsersData?.();
        }

        if (targetId === 'attendance-tab') {
            window.loadTeamAttendanceData?.();
        }

        if (targetId === 'equipment-tab') {
            window.loadEquipmentData?.();
            window.loadEquipmentInventoryData?.();
        }

        if (targetId === 'files-tab') {
            window.loadEmployeeFilesData?.();
        }

        if (targetId === 'inquiry-tab') {
            window.loadEmployeeInquiriesData?.();
        }

        if (targetId === 'system-tab') {
            window.loadSystemAdminData?.();
        }
    }

    function activateEmployeeTab(targetId, link) {
        const targetTab = document.getElementById(targetId);
        if (!targetTab) {
            console.warn('[Employee Dashboard] Tab target not found:', targetId);
            return;
        }

        const navLinks = sidebarNav.querySelectorAll('a');
        const tabSections = document.querySelectorAll('.tab-section');

        navLinks.forEach(l => l.classList.remove('active'));
        tabSections.forEach(tab => tab.classList.add('hidden'));

        if (link) {
            link.classList.add('active');
            pageTitle.textContent = link.textContent.trim();
        }

        targetTab.classList.remove('hidden');
        loadEmployeeTabData(targetId);
    }

    sidebarNav.addEventListener('click', (e) => {
        e.preventDefault();
        const link = e.target.closest('a');
        if (!link) return;
        const targetId = link.getAttribute('data-target');
        activateEmployeeTab(targetId, link);
    });
    
    // Set initial page title
    const firstLink = sidebarNav.querySelector('a');
    if (firstLink) {
        const firstTargetId = firstLink.getAttribute('data-target');
        activateEmployeeTab(firstTargetId, firstLink);
        console.log('[Employee Dashboard] First tab activated:', firstTargetId);
    }

    // --- 6. CLOCK IN/OUT WITH GPS GEO-FENCING ---
    const clockInBtn = document.getElementById('clock-in-btn');
    const clockOutBtn = document.getElementById('clock-out-btn');
    const todayStatus = document.getElementById('today-status');
    const timeInDisplay = document.getElementById('time-in');
    const timeOutDisplay = document.getElementById('time-out');
    
    console.log('[Attendance] Attendance elements:', {
        clockInBtn: !!clockInBtn,
        clockOutBtn: !!clockOutBtn,
        todayStatus: !!todayStatus,
        timeInDisplay: !!timeInDisplay,
        timeOutDisplay: !!timeOutDisplay
    });

    // Get user's current GPS position
    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let errorMessage = 'Unable to retrieve your location';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location permission denied. Please enable GPS in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'The request to get your location timed out.';
                            break;
                    }
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // Submit Attendance with Photo
    async function submitAttendance(action, photoData) {
        console.log('[submitAttendance] Called:', { action, hasPhoto: !!photoData });
        
        // Re-select elements to ensure we have fresh references
        const clockInBtn = document.getElementById('clock-in-btn');
        const clockOutBtn = document.getElementById('clock-out-btn');
        const todayStatusElement = document.getElementById('today-status');
        const timeInElement = document.getElementById('time-in');
        const timeOutElement = document.getElementById('time-out');
        
        console.log('[Attendance] Element check in submitAttendance:', {
            clockInBtn: !!clockInBtn,
            clockOutBtn: !!clockOutBtn,
            todayStatus: !!todayStatusElement,
            timeIn: !!timeInElement,
            timeOut: !!timeOutElement
        });
        
        const btn = action === 'clock_in' ? clockInBtn : clockOutBtn;
        
        try {
            btn.disabled = true;
            btn.textContent = action === 'clock_in' ? 'Getting GPS...' : 'Getting GPS...';

            // Get GPS coordinates
            const position = await getCurrentPosition();
            
            if (position.accuracy > 50) {
                const proceed = await showConfirm(
                    `GPS accuracy is low (±${Math.round(position.accuracy)}m).\n` +
                    `This might affect geo-fence validation.\n\n` +
                    `Continue anyway?`,
                    'GPS Accuracy Warning'
                );
                if (!proceed) {
                    btn.disabled = false;
                    btn.textContent = action === 'clock_in' ? 'Clock In' : 'Clock Out';
                    return;
                }
            }

            btn.textContent = action === 'clock_in' ? 'Clocking In...' : 'Clocking Out...';

            // Send attendance request with GPS and photo
            const response = await fetch('http://localhost:5000/api/attendance', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    action,
                    location_lat: position.latitude,
                    location_lng: position.longitude,
                    photo: photoData
                })
            });

            const data = await response.json();

            if (response.ok) {
                const timestamp = new Date(data.log.timestamp);
                const timeString = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                
                console.log('[submitAttendance] Attendance submitted successfully:', {
                    action,
                    timestamp: data.log.timestamp,
                    timeString,
                    log_id: data.log.log_id
                });

                // IMMEDIATE UI UPDATE - Update display elements right away
                console.log('[Attendance] Immediate UI update starting...');
                if (action === 'clock_in') {
                    if (timeInElement) {
                        timeInElement.textContent = timeString;
                        console.log('[submitAttendance] Set Time In:', timeString, '- Element:', timeInElement);
                    } else {
                        console.error('[Attendance] ERROR: timeInElement not found!');
                    }
                    if (todayStatusElement) {
                        todayStatusElement.textContent = 'Clocked In';
                        todayStatusElement.style.color = '#10b981';
                        console.log('[submitAttendance] Set Status: Clocked In - Element:', todayStatusElement);
                    } else {
                        console.error('[Attendance] ERROR: todayStatusElement not found!');
                    }
                    // Hide clock in, show clock out
                    if (clockInBtn) clockInBtn.classList.add('hidden');
                    if (clockOutBtn) clockOutBtn.classList.remove('hidden');
                } else if (action === 'clock_out') {
                    if (timeOutElement) {
                        timeOutElement.textContent = timeString;
                        console.log('[submitAttendance] Set Time Out:', timeString, '- Element:', timeOutElement);
                    } else {
                        console.error('[Attendance] ERROR: timeOutElement not found!');
                    }
                    if (todayStatusElement) {
                        todayStatusElement.textContent = 'Complete';
                        todayStatusElement.style.color = '#10b981';
                        console.log('[submitAttendance] Set Status: Complete - Element:', todayStatusElement);
                    } else {
                        console.error('[Attendance] ERROR: todayStatusElement not found!');
                    }
                    // Hide clock out, show clock in
                    if (clockOutBtn) clockOutBtn.classList.add('hidden');
                    if (clockInBtn) clockInBtn.classList.remove('hidden');
                }
                
                console.log('[Attendance] After immediate update:', {
                    timeIn: timeInElement?.textContent,
                    timeOut: timeOutElement?.textContent,
                    status: todayStatusElement?.textContent
                });
                
                // Force DOM repaint to ensure visual update
                if (timeInElement) timeInElement.offsetHeight;
                if (timeOutElement) timeOutElement.offsetHeight;
                if (todayStatusElement) todayStatusElement.offsetHeight;

                let successMessage = `SUCCESS: ${action === 'clock_in' ? 'Clocked in' : 'Clocked out'} successfully at ${timeString}!\n\n`;
                
                if (data.geoFence) {
                    successMessage += `Site: ${data.geoFence.site}\n`;
                    successMessage += `Distance: ${data.geoFence.distance}`;
                }

                showAlert(successMessage);
                
                // Immediately refresh attendance to show updated status in table
                console.log('[submitAttendance] Refreshing attendance history for table update...');
                await loadAttendanceHistory();
                
                // Final verification of UI state
                console.log('[Attendance] FINAL UI STATE:', {
                    timeIn: document.getElementById('time-in')?.textContent,
                    timeOut: document.getElementById('time-out')?.textContent,
                    status: document.getElementById('today-status')?.textContent,
                    statusColor: document.getElementById('today-status')?.style.color
                });
            } else {
                if (response.status === 403) {
                    let errorMessage = `ERROR: ${data.error}\n\n`;
                    if (data.details) {
                        errorMessage += `Nearest Site: ${data.details.nearestSite}\n`;
                        errorMessage += `Your Distance: ${data.details.yourDistance}\n`;
                        errorMessage += `Required: Within ${data.details.requiredDistance}\n`;
                        errorMessage += `You are ${data.details.difference}`;
                    }
                    showAlert(errorMessage);
                } else if (response.status === 503) {
                    showAlert('WARNING: No construction sites configured.\n\nPlease contact your administrator.');
                } else {
                    showAlert(`Error: ${data.error || data.message || 'Attendance submission failed'}`);
                }
            }
        } catch (error) {
            console.error('Attendance error:', error);
            showAlert(`ERROR: Failed:\n\n${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = action === 'clock_in' ? 'Clock In' : 'Clock Out';
        }
    }

    // Camera functionality
    let cameraStream = null;
    let capturedPhotoData = null;
    let currentAction = null;  // 'clock_in' or 'clock_out'

    const cameraModal = document.getElementById('camera-modal');
    const closeCameraModal = document.getElementById('close-camera-modal');
    const cameraPreview = document.getElementById('camera-preview');
    const photoCanvas = document.getElementById('photo-canvas');
    const capturedPhoto = document.getElementById('captured-photo');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const retakePhotoBtn = document.getElementById('retake-photo-btn');
    const confirmPhotoBtn = document.getElementById('confirm-photo-btn');
    const cameraLoading = document.getElementById('camera-loading');

    async function openCamera(action) {
        console.log('[Camera] openCamera called:', action);
        currentAction = action;
        capturedPhotoData = null;
        cameraModal.classList.remove('hidden');
        
        // Show loading indicator
        if (cameraLoading) {
            cameraLoading.style.display = 'block';
        }
        
        // Reset UI
        cameraPreview.style.display = 'none';
        capturedPhoto.style.display = 'none';
        capturePhotoBtn.style.display = 'none';
        retakePhotoBtn.style.display = 'none';
        confirmPhotoBtn.style.display = 'none';

        try {
            console.log('[Camera] Requesting camera access...');
            cameraStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            });
            cameraPreview.srcObject = cameraStream;
            console.log('[Camera] Camera access granted');
            
            // Hide loading, show camera preview
            if (cameraLoading) {
                cameraLoading.style.display = 'none';
            }
            cameraPreview.style.display = 'block';
            capturePhotoBtn.style.display = 'flex';
            
        } catch (error) {
            console.error('[Camera] ERROR: Camera access error:', error);
            showAlert('ERROR: Camera access denied or not available.\n\nPlease enable camera permissions in your browser settings.');
            cameraModal.classList.add('hidden');
            if (cameraLoading) {
                cameraLoading.style.display = 'none';
            }
        }
    }

    function closeCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }
        cameraModal.classList.add('hidden');
        currentAction = null;
        capturedPhotoData = null;
    }

    if (closeCameraModal) {
        closeCameraModal.addEventListener('click', closeCamera);
    }

    // Close modal when clicking outside the modal content
    if (cameraModal) {
        cameraModal.addEventListener('click', (e) => {
            if (e.target === cameraModal) {
                closeCamera();
            }
        });
    }

    if (capturePhotoBtn) {
        capturePhotoBtn.addEventListener('click', () => {
            console.log('[Camera] Capture photo button clicked');
            const context = photoCanvas.getContext('2d');
            photoCanvas.width = cameraPreview.videoWidth;
            photoCanvas.height = cameraPreview.videoHeight;
            context.drawImage(cameraPreview, 0, 0);
            
            // Convert to base64
            capturedPhotoData = photoCanvas.toDataURL('image/jpeg', 0.8);
            console.log('[Camera] Photo captured, size:', capturedPhotoData.length, 'bytes');
            
            // Show captured photo
            capturedPhoto.src = capturedPhotoData;
            capturedPhoto.style.display = 'block';
            cameraPreview.style.display = 'none';
            
            // Update buttons
            capturePhotoBtn.style.display = 'none';
            retakePhotoBtn.style.display = 'inline-block';
            confirmPhotoBtn.style.display = 'inline-block';
        });
    }

    if (retakePhotoBtn) {
        retakePhotoBtn.addEventListener('click', () => {
            capturedPhotoData = null;
            cameraPreview.style.display = 'block';
            capturedPhoto.style.display = 'none';
            capturePhotoBtn.style.display = 'flex';
            retakePhotoBtn.style.display = 'none';
            confirmPhotoBtn.style.display = 'none';
        });
    }

    if (confirmPhotoBtn) {
        confirmPhotoBtn.addEventListener('click', async () => {
            console.log('[Camera] Confirm photo button clicked');
            if (!capturedPhotoData) {
                showAlert('Please capture a photo first!');
                return;
            }
            
            console.log('[Attendance] Closing camera and submitting attendance...');
            console.log('[Attendance] currentAction:', currentAction);
            
            // Store action BEFORE closing camera (closeCamera sets currentAction to null)
            const actionToSubmit = currentAction;
            const photoToSubmit = capturedPhotoData;
            
            closeCamera();
            
            // Proceed with attendance submission using stored values
            if (actionToSubmit === 'clock_in') {
                console.log('[Attendance] Calling submitAttendance for clock_in');
                await submitAttendance('clock_in', photoToSubmit);
            } else if (actionToSubmit === 'clock_out') {
                console.log('[Attendance] Calling submitAttendance for clock_out');
                await submitAttendance('clock_out', photoToSubmit);
            }
        });
    }

    // Clock In Handler - Now opens camera first
    if (clockInBtn) {
        clockInBtn.addEventListener('click', async () => {
            console.log('[Attendance] Clock In button clicked');
            openCamera('clock_in');
        });
    } else {
        console.error('[Attendance] ERROR: Clock In button not found!');
    }

    // Clock Out Handler - Now opens camera first
    if (clockOutBtn) {
        clockOutBtn.addEventListener('click', async () => {
            console.log('[Attendance] Clock Out button clicked');
            openCamera('clock_out');
        });
    } else {
        console.error('[Attendance] ERROR: Clock Out button not found!');
    }

    // Load Attendance History
    async function loadAttendanceHistory() {
        console.log('[Attendance] Loading attendance history...');
        console.log('[Attendance] Elements check:', {
            tbody: !!document.getElementById('attendance-table-body'),
            timeInDisplay: !!timeInDisplay,
            timeOutDisplay: !!timeOutDisplay,
            todayStatus: !!todayStatus
        });
        
        try {
            const response = await fetch('http://localhost:5000/api/attendance/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const logs = data.attendance || [];
                const tbody = document.getElementById('attendance-table-body');
                
                console.log('[Attendance] Attendance data received:', {
                    totalLogs: logs.length,
                    logs: logs.map(l => ({ action: l.action, timestamp: l.timestamp }))
                });
                
                if (logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan=\"4\" style=\"text-align: center; padding: 24px; color: #9ca3af;\">No attendance records yet</td></tr>';
                    console.log('[Attendance] WARNING: No attendance records found');
                    return;
                }

                // Group by date and find the latest action for each date
                const grouped = {};
                logs.forEach(log => {
                    const date = new Date(log.timestamp).toLocaleDateString('en-US');
                    if (!grouped[date]) {
                        grouped[date] = { 
                            clock_in: null, 
                            clock_out: null,
                            lastAction: null,
                            lastTimestamp: null
                        };
                    }
                    
                    const logTime = new Date(log.timestamp);
                    
                    // Track latest clock in
                    if (log.action === 'clock_in') {
                        if (!grouped[date].clock_in || logTime > new Date(grouped[date].clock_in)) {
                            grouped[date].clock_in = log.timestamp;
                        }
                    } 
                    // Track latest clock out
                    else if (log.action === 'clock_out') {
                        if (!grouped[date].clock_out || logTime > new Date(grouped[date].clock_out)) {
                            grouped[date].clock_out = log.timestamp;
                        }
                    }
                    
                    // Track the very last action of the day
                    if (!grouped[date].lastTimestamp || logTime > new Date(grouped[date].lastTimestamp)) {
                        grouped[date].lastAction = log.action;
                        grouped[date].lastTimestamp = log.timestamp;
                    }
                });

                tbody.innerHTML = Object.entries(grouped).map(([date, times]) => {
                    const timeIn = times.clock_in ? new Date(times.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const timeOut = times.clock_out ? new Date(times.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    // Status based on last action: if last action was clock_out, then Complete, otherwise Incomplete
                    const status = times.lastAction === 'clock_out' 
                        ? '<span class="badge success">Complete</span>' 
                        : '<span class="badge warning">Incomplete</span>';
                    
                    return `<tr>
                        <td>${date}</td>
                        <td>${timeIn}</td>
                        <td>${timeOut}</td>
                        <td>${status}</td>
                    </tr>`;
                }).join('');

                // Update today's status - use same locale format as grouping
                const today = new Date().toLocaleDateString('en-US');
                console.log('[Attendance] Today\'s date:', today);
                console.log('[Attendance] Grouped dates:', Object.keys(grouped));
                
                if (grouped[today]) {
                    console.log('[Attendance] Found today\'s attendance:', grouped[today]);
                    
                    const timeIn = grouped[today].clock_in 
                        ? new Date(grouped[today].clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
                        : '--:--';
                    const timeOut = grouped[today].clock_out 
                        ? new Date(grouped[today].clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) 
                        : '--:--';
                    
                    // Determine status based on the LAST action of the day
                    const isCurrentlyClockedIn = grouped[today].lastAction === 'clock_in';
                    
                    console.log('[Attendance] Setting UI based on last action:', { 
                        lastAction: grouped[today].lastAction,
                        isCurrentlyIn: isCurrentlyClockedIn,
                        timeIn, 
                        timeOut 
                    });
                    
                    if (timeInDisplay) timeInDisplay.textContent = timeIn;
                    if (timeOutDisplay) timeOutDisplay.textContent = timeOut;
                    
                    if (todayStatus) {
                        if (isCurrentlyClockedIn) {
                            todayStatus.textContent = 'Clocked In';
                            todayStatus.style.color = '#10b981';
                            console.log('[Attendance] Status set to: Clocked In');
                            // Hide clock in, show clock out
                            if (clockInBtn) clockInBtn.classList.add('hidden');
                            if (clockOutBtn) clockOutBtn.classList.remove('hidden');
                        } else {
                            todayStatus.textContent = 'Complete';
                            todayStatus.style.color = '#10b981';
                            console.log('[Attendance] Status set to: Complete');
                            // Hide clock out, show clock in
                            if (clockOutBtn) clockOutBtn.classList.add('hidden');
                            if (clockInBtn) clockInBtn.classList.remove('hidden');
                        }
                    }
                    
                    console.log('[Attendance] UI Updated:', {
                        timeInText: timeInDisplay?.textContent,
                        timeOutText: timeOutDisplay?.textContent,
                        statusText: todayStatus?.textContent,
                        statusColor: todayStatus?.style.color
                    });
                } else {
                    console.log('[Attendance] WARNING: No attendance found for today');
                    console.log('[Attendance] WARNING: Resetting UI to defaults');
                    if (timeInDisplay) timeInDisplay.textContent = '--:--';
                    if (timeOutDisplay) timeOutDisplay.textContent = '--:--';
                    if (todayStatus) {
                        todayStatus.textContent = 'Not Clocked In';
                        todayStatus.style.color = '';
                    }
                    // Show clock in, hide clock out
                    if (clockInBtn) clockInBtn.classList.remove('hidden');
                    if (clockOutBtn) clockOutBtn.classList.add('hidden');
                }
            } else {
                console.error('[Attendance] ERROR: Failed to load attendance:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Failed to load attendance history:', error);
        }
    }

    // Load attendance history on page load
    loadAttendanceHistory();

    const attendanceExportBtn = document.getElementById('attendance-export-btn');
    const teamAttendanceTableBody = document.getElementById('team-attendance-table-body');
    const teamAttendanceSearchInput = document.getElementById('team-attendance-search-input');
    let employeeAttendanceSitesCache = [];
    let employeeTeamAttendanceLogsCache = [];

    function toRadiansEmployeeAttendance(degrees) {
        return (degrees * Math.PI) / 180;
    }

    function calculateEmployeeAttendanceDistanceMeters(lat1, lng1, lat2, lng2) {
        const earthRadiusMeters = 6371000;
        const dLat = toRadiansEmployeeAttendance(lat2 - lat1);
        const dLng = toRadiansEmployeeAttendance(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadiansEmployeeAttendance(lat1)) * Math.cos(toRadiansEmployeeAttendance(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMeters * c;
    }

    function parseEmployeeAttendanceCoordinate(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function resolveEmployeeAttendanceSiteName(lat, lng) {
        const latitude = parseEmployeeAttendanceCoordinate(lat);
        const longitude = parseEmployeeAttendanceCoordinate(lng);

        if (latitude === null || longitude === null) {
            return 'No GPS';
        }

        if (!employeeAttendanceSitesCache.length) {
            return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }

        const activeSites = employeeAttendanceSitesCache.filter(site => site.is_active);
        const candidateSites = activeSites.length ? activeSites : employeeAttendanceSitesCache;

        let nearestSite = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        candidateSites.forEach(site => {
            const siteLat = parseEmployeeAttendanceCoordinate(site.center_lat);
            const siteLng = parseEmployeeAttendanceCoordinate(site.center_lng);
            if (siteLat === null || siteLng === null) return;

            const distance = calculateEmployeeAttendanceDistanceMeters(latitude, longitude, siteLat, siteLng);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestSite = site;
            }
        });

        return nearestSite?.site_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }

    async function ensureEmployeeAttendanceSitesLoaded() {
        if (employeeAttendanceSitesCache.length > 0) return;

        try {
            const response = await fetch('http://localhost:5000/api/sites', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;
            const sites = await response.json();
            employeeAttendanceSitesCache = Array.isArray(sites) ? sites : [];
        } catch (error) {
            console.error('Failed to preload sites for employee attendance labels:', error);
        }
    }

    function toEmployeeAttendanceDateTimeLocalValue(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function showEmployeeAttendanceEditModal(currentAction, currentTimestamp) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay attendance-edit-overlay';

            const safeAction = currentAction === 'clock_out' ? 'clock_out' : 'clock_in';
            const timestampValue = toEmployeeAttendanceDateTimeLocalValue(currentTimestamp);

            modal.innerHTML = `
                <div class="modal-content modern-modal attendance-edit-modal" role="dialog" aria-modal="true" aria-label="Edit attendance log">
                    <div class="modal-header attendance-edit-header">
                        <div class="modal-header-content">
                            <div class="modal-icon"><i class="bi bi-pencil-square"></i></div>
                            <div>
                                <h2 class="modal-title">Edit/Correct Attendance Log</h2>
                                <p class="modal-subtitle">Update action and timestamp using form controls.</p>
                            </div>
                        </div>
                        <span class="close-modal" id="employee-attendance-edit-close">&times;</span>
                    </div>
                    <form id="employee-attendance-edit-form" class="attendance-edit-form" novalidate>
                        <div class="attendance-edit-field">
                            <label for="employee-attendance-edit-action">Action</label>
                            <select id="employee-attendance-edit-action" class="modern-select" required>
                                <option value="clock_in" ${safeAction === 'clock_in' ? 'selected' : ''}>Clock In</option>
                                <option value="clock_out" ${safeAction === 'clock_out' ? 'selected' : ''}>Clock Out</option>
                            </select>
                        </div>
                        <div class="attendance-edit-field">
                            <label for="employee-attendance-edit-timestamp">Timestamp</label>
                            <input id="employee-attendance-edit-timestamp" class="modern-input" type="datetime-local" value="${timestampValue}">
                        </div>
                        <div class="attendance-edit-actions">
                            <button type="button" class="attendance-photo-close-btn employee-attendance-edit-cancel">Cancel</button>
                            <button type="submit" class="btn-primary attendance-edit-submit">Confirm</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('#employee-attendance-edit-close');
            const cancelBtn = modal.querySelector('.employee-attendance-edit-cancel');
            const form = modal.querySelector('#employee-attendance-edit-form');
            const actionSelect = modal.querySelector('#employee-attendance-edit-action');
            const timestampInput = modal.querySelector('#employee-attendance-edit-timestamp');

            const closeModal = (result = null) => {
                modal.remove();
                resolve(result);
            };

            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(null));
            if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(null));

            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeModal(null);
            });

            if (form) {
                form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const action = String(actionSelect?.value || '').trim().toLowerCase();
                    if (action !== 'clock_in' && action !== 'clock_out') {
                        showAlert('ERROR: Please choose a valid action.');
                        return;
                    }

                    closeModal({
                        action,
                        timestampValue: String(timestampInput?.value || '').trim()
                    });
                });
            }
        });
    }

    async function editEmployeeAttendanceLog(logId, currentAction, currentTimestamp) {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to edit attendance logs.');
            return false;
        }

        if (!logId) return false;

        const editInput = await showEmployeeAttendanceEditModal(currentAction, currentTimestamp);
        if (!editInput) return false;

        const parsedTimestamp = editInput.timestampValue ? new Date(editInput.timestampValue) : null;
        if (editInput.timestampValue && Number.isNaN(parsedTimestamp?.getTime())) {
            showAlert('ERROR: Invalid timestamp. Please use the date/time picker.');
            return false;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: editInput.action,
                    ...(parsedTimestamp ? { timestamp: parsedTimestamp.toISOString() } : {})
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `Failed to update attendance log (${response.status})`);
            }

            showAlert('Attendance log corrected successfully.');
            await window.loadTeamAttendanceData();
            return true;
        } catch (error) {
            console.error('Failed to update employee attendance log:', error);
            showAlert(error.message || 'Failed to update attendance log.');
            return false;
        }
    }

    async function deleteEmployeeAttendanceLog(logId) {
        if (!hasPermission('can_delete_attendance')) {
            showAlert('You do not have permission to delete attendance logs.');
            return false;
        }

        if (!logId) return false;

        const approved = await openSharedConfirmModal({
            title: 'Delete Attendance Log',
            subtitle: 'This action is permanent.',
            message: 'Delete this attendance log?',
            confirmText: 'Delete',
            danger: true
        });
        if (!approved) return false;

        try {
            const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || `Failed to delete attendance log (${response.status})`);
            }

            showAlert('Attendance log deleted successfully.');
            await window.loadTeamAttendanceData();
            return true;
        } catch (error) {
            console.error('Failed to delete employee attendance log:', error);
            showAlert(error.message || 'Failed to delete attendance log.');
            return false;
        }
    }

    async function fetchEmployeeAttendancePhoto(logId, rowData) {
        try {
            const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                showAlert('Failed to fetch attendance details.');
                return;
            }

            const log = await response.json();
            const effectiveRawAction = log.action || rowData.rawAction;
            const effectiveAction = effectiveRawAction === 'clock_in' ? 'Clock In' : 'Clock Out';
            const effectiveRawTimestamp = log.timestamp || rowData.rawTimestamp;
            const effectiveTimestamp = effectiveRawTimestamp
                ? new Date(effectiveRawTimestamp).toLocaleString()
                : rowData.timestamp;
            const effectiveLat = log.location_lat || rowData.lat;
            const effectiveLng = log.location_lng || rowData.lng;
            const effectiveSiteName = resolveEmployeeAttendanceSiteName(effectiveLat, effectiveLng);
            const hasPhoto = Boolean(log.photo);

            const canEditAttendance = hasPermission('can_edit_attendance');
            const canDeleteAttendance = hasPermission('can_delete_attendance');

            const modal = document.createElement('div');
            modal.className = 'modal-overlay attendance-photo-overlay';
            modal.innerHTML = `
                <div class="modal-content modern-modal attendance-photo-modal">
                    <div class="modal-header attendance-photo-header">
                        <div class="modal-header-content">
                            <div class="modal-icon"><i class="bi bi-camera-fill"></i></div>
                            <div>
                                <h2 class="modal-title">Attendance Photo</h2>
                                <p class="modal-subtitle">${escapeHtml(rowData.user)} - ${escapeHtml(effectiveAction)}</p>
                            </div>
                        </div>
                        <span class="close-modal" id="employee-attendance-photo-close">&times;</span>
                    </div>
                    <div class="attendance-photo-body">
                        ${hasPhoto
                            ? `<img src="${log.photo}" class="attendance-photo-image" alt="Attendance capture for ${escapeHtml(rowData.user)}">`
                            : '<p class="attendance-photo-empty">No photo available for this attendance record</p>'
                        }

                        <div class="attendance-photo-details">
                            <h3 class="attendance-photo-details-title"><i class="bi bi-info-circle-fill"></i>Details</h3>
                            <div class="attendance-photo-details-grid">
                                <div class="attendance-photo-detail-item"><strong>Time:</strong> ${escapeHtml(effectiveTimestamp)}</div>
                                <div class="attendance-photo-detail-item"><strong>Action:</strong> ${escapeHtml(effectiveAction)}</div>
                                <div class="attendance-photo-detail-item attendance-photo-detail-item-full"><strong>Location:</strong> ${escapeHtml(effectiveSiteName)}</div>
                            </div>
                        </div>

                        <div class="attendance-photo-actions">
                            ${canDeleteAttendance ? '<button type="button" class="btn-danger" id="employee-attendance-delete-btn"><i class="bi bi-trash"></i> Delete Log</button>' : ''}
                            ${canEditAttendance ? '<button type="button" class="btn-primary" id="employee-attendance-edit-btn"><i class="bi bi-pencil-square"></i> Edit/Correct</button>' : ''}
                            <button type="button" class="attendance-photo-close-btn">Close</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('#employee-attendance-photo-close');
            const closeActionBtn = modal.querySelector('.attendance-photo-close-btn');
            const editBtn = modal.querySelector('#employee-attendance-edit-btn');
            const deleteBtn = modal.querySelector('#employee-attendance-delete-btn');
            const closeModal = () => modal.remove();

            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (closeActionBtn) closeActionBtn.addEventListener('click', closeModal);

            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    const updated = await editEmployeeAttendanceLog(logId, effectiveRawAction, effectiveRawTimestamp);
                    if (updated) closeModal();
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    const deleted = await deleteEmployeeAttendanceLog(logId);
                    if (deleted) closeModal();
                });
            }

            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeModal();
            });
        } catch (error) {
            console.error('Failed to fetch employee attendance photo:', error);
            showAlert('Failed to load attendance photo.');
        }
    }

    async function viewEmployeeAttendanceDetails(logId, rowData) {
        if (!hasPermission('can_view_all_attendance')) {
            showAlert('You do not have permission to view attendance details.');
            return;
        }

        if (!logId) return;
        await fetchEmployeeAttendancePhoto(logId, rowData);
    }

    function getFilteredEmployeeTeamAttendanceLogs() {
        const query = String(teamAttendanceSearchInput?.value || '').trim().toLowerCase();
        if (!query) return employeeTeamAttendanceLogsCache;

        return employeeTeamAttendanceLogsCache.filter(log => {
            const actionLabel = log.action === 'clock_in' ? 'Clock In' : 'Clock Out';
            const timestampText = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '';
            const siteName = resolveEmployeeAttendanceSiteName(log.location_lat, log.location_lng);

            return [
                String(log.user?.full_name || ''),
                String(log.user?.email || ''),
                String(actionLabel),
                String(timestampText),
                String(siteName)
            ].some(value => value.toLowerCase().includes(query));
        });
    }

    function renderEmployeeTeamAttendanceRows(logs) {
        if (!teamAttendanceTableBody) return;

        if (!logs.length) {
            const hasActiveSearch = Boolean(String(teamAttendanceSearchInput?.value || '').trim());
            const emptyMessage = hasActiveSearch
                ? 'No team attendance logs match your search.'
                : 'No attendance logs available.';
            teamAttendanceTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">${emptyMessage}</td></tr>`;
            return;
        }

        teamAttendanceTableBody.innerHTML = logs.map(log => {
            const logId = Number(log.log_id || 0);
            const when = log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '--';
            const hasProfilePhoto = Boolean(log.user?.profile_photo);
            const userName = log.user?.full_name || '--';
            const actionLabel = log.action === 'clock_in' ? 'Clock In' : 'Clock Out';
            const siteName = resolveEmployeeAttendanceSiteName(log.location_lat, log.location_lng);
            const userNameCellHtml = `
                <div class="user-name-cell">
                    <span class="user-avatar-chip${hasProfilePhoto ? ' has-image' : ''}">
                        ${hasProfilePhoto
                            ? `<img src="${escapeHtml(log.user.profile_photo)}" alt="${escapeHtml(userName)} photo">`
                            : '<i class="bi bi-person-fill"></i>'
                        }
                    </span>
                    <span>${escapeHtml(userName)}</span>
                </div>
            `;

            return `
                <tr>
                    <td>${userNameCellHtml}</td>
                    <td>${escapeHtml(log.user?.email || '--')}</td>
                    <td>${escapeHtml(actionLabel)}</td>
                    <td>${escapeHtml(when)}</td>
                    <td>
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                            <span style="color:#4b5563; font-size:12px; font-weight:600;">${escapeHtml(siteName)}</span>
                            <button
                                type="button"
                                class="btn-small employee-attendance-view-btn"
                                data-attendance-action="view"
                                data-log-id="${logId}"
                                data-user="${escapeHtml(userName)}"
                                data-action="${escapeHtml(log.action || 'clock_in')}"
                                data-timestamp="${escapeHtml(log.timestamp || '')}"
                                data-lat="${escapeHtml(String(log.location_lat ?? ''))}"
                                data-lng="${escapeHtml(String(log.location_lng ?? ''))}">
                                <i class="bi bi-eye-fill"></i> View
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderEmployeeTeamAttendanceTable() {
        const filteredLogs = getFilteredEmployeeTeamAttendanceLogs();
        renderEmployeeTeamAttendanceRows(filteredLogs);
    }

    window.loadTeamAttendanceData = async function() {
        if (!teamAttendanceTableBody) return;

        if (!hasPermission('can_view_all_attendance')) {
            employeeTeamAttendanceLogsCache = [];
            teamAttendanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view all attendance logs.</td></tr>';
            if (teamAttendanceSearchInput) {
                teamAttendanceSearchInput.value = '';
                teamAttendanceSearchInput.disabled = true;
            }
            return;
        }

        if (teamAttendanceSearchInput) {
            teamAttendanceSearchInput.disabled = false;
        }

        try {
            teamAttendanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#6b7280;">Loading team attendance...</td></tr>';

            const [attendanceResponse, sitesResponse] = await Promise.all([
                fetch('http://localhost:5000/api/attendance', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/api/sites', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (!attendanceResponse.ok) {
                throw new Error(`Failed to load attendance (${attendanceResponse.status})`);
            }

            if (sitesResponse.ok) {
                const sites = await sitesResponse.json();
                employeeAttendanceSitesCache = Array.isArray(sites) ? sites : [];
            }

            const data = await attendanceResponse.json();
            const logs = data.attendance || [];
            employeeTeamAttendanceLogsCache = logs;
            renderEmployeeTeamAttendanceTable();
        } catch (error) {
            console.error('Failed to load team attendance:', error);
            employeeTeamAttendanceLogsCache = [];
            teamAttendanceTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load team attendance.</td></tr>';
        }
    };

    if (teamAttendanceSearchInput) {
        teamAttendanceSearchInput.addEventListener('input', () => {
            renderEmployeeTeamAttendanceTable();
        });
    }

    if (teamAttendanceTableBody) {
        teamAttendanceTableBody.addEventListener('click', async (event) => {
            const actionBtn = event.target.closest('[data-attendance-action="view"]');
            if (!actionBtn) return;

            const logId = Number(actionBtn.getAttribute('data-log-id'));
            if (!logId) return;

            await ensureEmployeeAttendanceSitesLoaded();
            await viewEmployeeAttendanceDetails(logId, {
                user: actionBtn.getAttribute('data-user') || 'Unknown',
                rawAction: actionBtn.getAttribute('data-action') || 'clock_in',
                timestamp: actionBtn.getAttribute('data-timestamp')
                    ? new Date(actionBtn.getAttribute('data-timestamp')).toLocaleString()
                    : '--',
                rawTimestamp: actionBtn.getAttribute('data-timestamp') || '',
                lat: actionBtn.getAttribute('data-lat') || '',
                lng: actionBtn.getAttribute('data-lng') || ''
            });
        });
    }

    if (attendanceExportBtn) {
        attendanceExportBtn.addEventListener('click', () => {
            if (!hasPermission('can_export_attendance')) {
                showAlert('You do not have permission to export attendance reports.');
                return;
            }

            const exportUrl = 'http://localhost:5000/api/reports/attendance?format=csv';
            window.open(exportUrl, '_blank', 'noopener,noreferrer');
        });
    }

    // Shared admin-style modals for non-user sections
    function bindModalUtilityHandlers() {
        const inputModal = document.getElementById('shared-action-input-modal');
        const inputForm = document.getElementById('shared-action-input-form');
        const inputField = document.getElementById('shared-action-input-field');
        const inputClose = document.getElementById('shared-action-input-close-btn');
        const inputCancel = document.getElementById('shared-action-input-cancel-btn');

        const confirmModal = document.getElementById('shared-confirm-modal');
        const confirmClose = document.getElementById('shared-confirm-close-btn');
        const confirmCancel = document.getElementById('shared-confirm-cancel-btn');
        const confirmOk = document.getElementById('shared-confirm-ok-btn');

        const equipmentModal = document.getElementById('equipment-editor-modal-employee');
        const equipmentForm = document.getElementById('equipment-editor-form-employee');
        const equipmentClose = document.getElementById('equipment-editor-close-btn');
        const equipmentCancel = document.getElementById('equipment-editor-cancel-btn');
        const equipmentDelete = document.getElementById('equipment-editor-delete-btn');

        if (inputForm && !inputForm.dataset.bound) {
            inputForm.dataset.bound = '1';
            inputForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const resolver = window.__employeeInputModalResolver;
                window.__employeeInputModalResolver = null;
                if (resolver) resolver(String(inputField?.value || '').trim());
                inputModal?.classList.add('hidden');
            });
        }

        const cancelInputModal = () => {
            const resolver = window.__employeeInputModalResolver;
            window.__employeeInputModalResolver = null;
            if (resolver) resolver(null);
            inputModal?.classList.add('hidden');
        };

        if (inputClose && !inputClose.dataset.bound) {
            inputClose.dataset.bound = '1';
            inputClose.addEventListener('click', cancelInputModal);
        }

        if (inputCancel && !inputCancel.dataset.bound) {
            inputCancel.dataset.bound = '1';
            inputCancel.addEventListener('click', cancelInputModal);
        }

        if (inputModal && !inputModal.dataset.bound) {
            inputModal.dataset.bound = '1';
            inputModal.addEventListener('click', (event) => {
                if (event.target === inputModal) cancelInputModal();
            });
        }

        const cancelConfirmModal = () => {
            const resolver = window.__employeeConfirmModalResolver;
            window.__employeeConfirmModalResolver = null;
            if (resolver) resolver(false);
            confirmModal?.classList.add('hidden');
        };

        if (confirmClose && !confirmClose.dataset.bound) {
            confirmClose.dataset.bound = '1';
            confirmClose.addEventListener('click', cancelConfirmModal);
        }

        if (confirmCancel && !confirmCancel.dataset.bound) {
            confirmCancel.dataset.bound = '1';
            confirmCancel.addEventListener('click', cancelConfirmModal);
        }

        if (confirmOk && !confirmOk.dataset.bound) {
            confirmOk.dataset.bound = '1';
            confirmOk.addEventListener('click', () => {
                const resolver = window.__employeeConfirmModalResolver;
                window.__employeeConfirmModalResolver = null;
                if (resolver) resolver(true);
                confirmModal?.classList.add('hidden');
            });
        }

        if (confirmModal && !confirmModal.dataset.bound) {
            confirmModal.dataset.bound = '1';
            confirmModal.addEventListener('click', (event) => {
                if (event.target === confirmModal) cancelConfirmModal();
            });
        }

        const cancelEquipmentModal = () => {
            const resolver = window.__employeeEquipmentModalResolver;
            window.__employeeEquipmentModalResolver = null;
            if (resolver) resolver(null);
            equipmentModal?.classList.add('hidden');
        };

        if (equipmentForm && !equipmentForm.dataset.bound) {
            equipmentForm.dataset.bound = '1';
            equipmentForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const resolver = window.__employeeEquipmentModalResolver;
                window.__employeeEquipmentModalResolver = null;
                if (resolver) {
                    resolver({
                        equipmentId: Number(document.getElementById('equipment-editor-id')?.value || 0),
                        name: String(document.getElementById('equipment-editor-name')?.value || '').trim(),
                        quantity: Number(document.getElementById('equipment-editor-qty')?.value || 1),
                        condition: String(document.getElementById('equipment-editor-condition')?.value || 'Good').trim(),
                        status: String(document.getElementById('equipment-editor-status')?.value || 'Available').trim()
                    });
                }
                equipmentModal?.classList.add('hidden');
            });
        }

        if (equipmentClose && !equipmentClose.dataset.bound) {
            equipmentClose.dataset.bound = '1';
            equipmentClose.addEventListener('click', cancelEquipmentModal);
        }

        if (equipmentCancel && !equipmentCancel.dataset.bound) {
            equipmentCancel.dataset.bound = '1';
            equipmentCancel.addEventListener('click', cancelEquipmentModal);
        }

        if (equipmentDelete && !equipmentDelete.dataset.bound) {
            equipmentDelete.dataset.bound = '1';
            equipmentDelete.addEventListener('click', () => {
                const resolver = window.__employeeEquipmentModalResolver;
                window.__employeeEquipmentModalResolver = null;
                if (resolver) {
                    resolver({
                        deleteRequested: true,
                        equipmentId: Number(document.getElementById('equipment-editor-id')?.value || 0)
                    });
                }
                equipmentModal?.classList.add('hidden');
            });
        }

        if (equipmentModal && !equipmentModal.dataset.bound) {
            equipmentModal.dataset.bound = '1';
            equipmentModal.addEventListener('click', (event) => {
                if (event.target === equipmentModal) cancelEquipmentModal();
            });
        }
    }

    function openSharedActionInputModal({ title, subtitle, label, value = '', placeholder = '' }) {
        bindModalUtilityHandlers();
        const modal = document.getElementById('shared-action-input-modal');
        const titleEl = document.getElementById('shared-action-input-title');
        const subtitleEl = document.getElementById('shared-action-input-subtitle');
        const labelEl = document.getElementById('shared-action-input-label');
        const fieldEl = document.getElementById('shared-action-input-field');

        if (!modal || !fieldEl) return Promise.resolve(null);
        if (titleEl) titleEl.textContent = title || 'Update Value';
        if (subtitleEl) subtitleEl.textContent = subtitle || 'Provide the new value below.';
        if (labelEl) labelEl.textContent = label || 'Value';
        fieldEl.value = value;
        fieldEl.placeholder = placeholder;

        modal.classList.remove('hidden');
        setTimeout(() => fieldEl.focus(), 0);

        return new Promise((resolve) => {
            window.__employeeInputModalResolver = resolve;
        });
    }

    function openSharedConfirmModal({ title, subtitle, message, confirmText = 'Confirm', danger = true }) {
        bindModalUtilityHandlers();
        const modal = document.getElementById('shared-confirm-modal');
        const titleEl = document.getElementById('shared-confirm-title');
        const subtitleEl = document.getElementById('shared-confirm-subtitle');
        const msgEl = document.getElementById('shared-confirm-message');
        const okBtn = document.getElementById('shared-confirm-ok-btn');

        if (!modal || !okBtn) return Promise.resolve(false);
        if (titleEl) titleEl.textContent = title || 'Confirm Action';
        if (subtitleEl) subtitleEl.textContent = subtitle || 'This action may change data.';
        if (msgEl) msgEl.textContent = message || 'Please confirm this action.';
        okBtn.textContent = confirmText;
        okBtn.className = danger ? 'btn-delete' : 'btn-primary';
        modal.classList.toggle('shared-confirm-danger', Boolean(danger));

        modal.classList.remove('hidden');
        return new Promise((resolve) => {
            window.__employeeConfirmModalResolver = resolve;
        });
    }

    function openEquipmentEditorModal({ mode, item }) {
        bindModalUtilityHandlers();
        const modal = document.getElementById('equipment-editor-modal-employee');
        if (!modal) return Promise.resolve(null);

        const titleEl = document.getElementById('equipment-editor-title');
        const subtitleEl = document.getElementById('equipment-editor-subtitle');
        const idEl = document.getElementById('equipment-editor-id');
        const nameEl = document.getElementById('equipment-editor-name');
        const qtyEl = document.getElementById('equipment-editor-qty');
        const conditionEl = document.getElementById('equipment-editor-condition');
        const statusEl = document.getElementById('equipment-editor-status');
        const deleteBtn = document.getElementById('equipment-editor-delete-btn');
        const saveBtn = document.getElementById('equipment-editor-save-btn');

        const isEdit = mode === 'edit';
        if (titleEl) titleEl.textContent = isEdit ? 'Edit Equipment' : 'Add Equipment';
        if (subtitleEl) subtitleEl.textContent = isEdit ? 'Update equipment details.' : 'Create a new inventory item.';

        if (idEl) idEl.value = String(item?.equipment_id || 0);
        if (nameEl) nameEl.value = String(item?.name || '');
        if (qtyEl) {
            qtyEl.value = isEdit ? '1' : '1';
            qtyEl.disabled = isEdit;
        }
        if (conditionEl) conditionEl.value = String(item?.condition || 'Good');
        if (statusEl) statusEl.value = String(item?.status || 'Available');

        const canDeleteEquipment = hasPermission('can_delete_equipment');
        const canEditEquipment = hasPermission('can_edit_equipment');
        const canUpdateFields = canEditEquipment || !isEdit;
        if (deleteBtn) {
            deleteBtn.classList.toggle('hidden', !(isEdit && canDeleteEquipment));
        }
        if (saveBtn) {
            saveBtn.classList.toggle('hidden', !(canEditEquipment || !isEdit));
        }
        if (nameEl) nameEl.disabled = !canUpdateFields;
        if (conditionEl) conditionEl.disabled = !canUpdateFields;
        if (statusEl) statusEl.disabled = !canUpdateFields;

        modal.classList.remove('hidden');
        setTimeout(() => nameEl?.focus(), 0);

        return new Promise((resolve) => {
            window.__employeeEquipmentModalResolver = resolve;
        });
    }
    
    // Load Equipment Checkouts (globally accessible for scanner modal)
    window.loadEquipmentData = async function() {
        try {
            const response = await fetch('http://localhost:5000/api/equipment/my-checkouts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const checkouts = data.checkouts || [];
                const tbody = document.getElementById('equipment-table-body');
                
                // Update stats
                const checkedOut = checkouts.filter(c => c.status === 'Checked Out').length;
                const pending = checkouts.filter(c => c.status === 'Checked Out').length;
                
                if (document.getElementById('equipment-checked-out')) {
                    document.getElementById('equipment-checked-out').textContent = checkedOut;
                }
                if (document.getElementById('total-checkouts')) {
                    document.getElementById('total-checkouts').textContent = checkouts.length;
                }
                if (document.getElementById('pending-returns')) {
                    document.getElementById('pending-returns').textContent = pending;
                }
                
                // Render table
                if (checkouts.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #9ca3af;">No equipment checkouts yet. Click "Scan Equipment" to get started.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = checkouts.map(checkout => {
                    const checkoutDate = new Date(checkout.checkout_date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const returnDate = checkout.return_date 
                        ? new Date(checkout.return_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : '--';
                    
                    const statusBadge = checkout.status === 'Checked Out'
                        ? '<span class="badge warning">Checked Out</span>'
                        : '<span class="badge success">Returned</span>';
                    
                    return `<tr>
                        <td>${checkout.equipment.name}</td>
                        <td>${checkout.equipment.qr_number}</td>
                        <td>${checkoutDate}</td>
                        <td>${returnDate}</td>
                        <td>${statusBadge}</td>
                    </tr>`;
                }).join('');
                
            }
        } catch (error) {
            console.error('Failed to load equipment checkouts:', error);
            const tbody = document.getElementById('equipment-table-body');
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load equipment checkouts</td></tr>';
        }
    }

    const addEquipmentBtn = document.getElementById('add-equipment-btn');
    const equipmentInventoryTableBody = document.getElementById('equipment-inventory-table-body');

    async function fetchAssignableEquipmentUsers() {
        const response = await fetch('http://localhost:5000/api/equipment/assignable-users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to load assignable users (${response.status})`);
        }

        return Array.isArray(data.users) ? data.users : [];
    }

    function openEquipmentAssignModal(item, users) {
        const itemName = escapeHtml(item?.name || 'Equipment');
        const itemQr = escapeHtml(item?.qr_number || '--');
        const optionsHtml = users.map(userItem => `
            <option value="${Number(userItem.user_id || 0)}">${escapeHtml(userItem.full_name || 'Unknown')} (${escapeHtml(userItem.email || '--')})</option>
        `).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay attendance-edit-overlay';
        modal.innerHTML = `
            <div class="modal-content modern-modal attendance-edit-modal" role="dialog" aria-modal="true" aria-label="Assign equipment">
                <div class="modal-header attendance-edit-header">
                    <div class="modal-header-content">
                        <div class="modal-icon"><i class="bi bi-person-check-fill"></i></div>
                        <div>
                            <h2 class="modal-title">Assign Equipment</h2>
                            <p class="modal-subtitle">${itemName} - ${itemQr}</p>
                        </div>
                    </div>
                    <span class="close-modal" id="employee-equipment-assign-close">&times;</span>
                </div>
                <form id="employee-equipment-assign-form" class="attendance-edit-form" novalidate>
                    <div class="attendance-edit-field">
                        <label for="employee-equipment-assign-user">Assign To</label>
                        <select id="employee-equipment-assign-user" class="modern-select" required>
                            <option value="">Select employee</option>
                            ${optionsHtml}
                        </select>
                    </div>
                    <div class="attendance-edit-field">
                        <label for="employee-equipment-assign-notes">Notes (Optional)</label>
                        <input id="employee-equipment-assign-notes" class="modern-input" type="text" placeholder="Assignment notes">
                    </div>
                    <div class="attendance-edit-actions">
                        <button type="button" class="attendance-photo-close-btn employee-equipment-assign-cancel">Cancel</button>
                        <button type="submit" class="btn-primary">Assign</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        return new Promise((resolve) => {
            const closeBtn = modal.querySelector('#employee-equipment-assign-close');
            const cancelBtn = modal.querySelector('.employee-equipment-assign-cancel');
            const form = modal.querySelector('#employee-equipment-assign-form');
            const userSelect = modal.querySelector('#employee-equipment-assign-user');
            const notesInput = modal.querySelector('#employee-equipment-assign-notes');

            const closeModal = (result = null) => {
                modal.remove();
                resolve(result);
            };

            if (closeBtn) closeBtn.addEventListener('click', () => closeModal(null));
            if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(null));

            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeModal(null);
            });

            if (form) {
                form.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const selectedUserId = Number(userSelect?.value || 0);
                    if (!selectedUserId) {
                        showAlert('Please select an employee to assign this equipment.');
                        return;
                    }

                    closeModal({
                        userId: selectedUserId,
                        notes: String(notesInput?.value || '').trim()
                    });
                });
            }
        });
    }

    window.loadEquipmentInventoryData = async function() {
        if (!equipmentInventoryTableBody) return;

        if (!hasPermission('can_view_equipment')) {
            equipmentInventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view equipment inventory.</td></tr>';
            return;
        }

        try {
            equipmentInventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#6b7280;">Loading inventory...</td></tr>';
            const response = await fetch('http://localhost:5000/api/equipment', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load inventory (${response.status})`);
            }

            const data = await response.json();
            const items = data.equipment || [];
            window.__employeeEquipmentCache = items;

            if (!items.length) {
                equipmentInventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No equipment inventory records.</td></tr>';
                return;
            }

            const canEditEquipment = hasPermission('can_edit_equipment');
            const canDeleteEquipment = hasPermission('can_delete_equipment');
            const canAssignEquipment = hasPermission('can_assign_equipment');

            equipmentInventoryTableBody.innerHTML = items.map(item => `
                <tr>
                    <td>${escapeHtml(item.name || '--')}</td>
                    <td>${escapeHtml(item.qr_number || '--')}</td>
                    <td>${escapeHtml(item.condition || '--')}</td>
                    <td>${escapeHtml(item.status || '--')}</td>
                    <td>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            ${(canEditEquipment || canDeleteEquipment) ? `<button type="button" class="btn-small" data-equipment-action="edit" data-equipment-id="${Number(item.equipment_id || 0)}">${canEditEquipment ? 'Edit' : 'Manage'}</button>` : ''}
                            ${canAssignEquipment ? `<button type="button" class="btn-small" data-equipment-action="assign" data-equipment-id="${Number(item.equipment_id || 0)}">Assign</button>` : ''}
                            ${!canEditEquipment && !canDeleteEquipment && !canAssignEquipment ? '<span class="muted-note">View only</span>' : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load equipment inventory:', error);
            equipmentInventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load equipment inventory.</td></tr>';
        }
    };

    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', async () => {
            if (!hasPermission('can_add_equipment')) {
                showAlert('You do not have permission to add equipment.');
                return;
            }

            const draft = await openEquipmentEditorModal({ mode: 'add' });
            if (!draft) return;
            const quantity = Number(draft.quantity || 1);
            if (!draft.name || !Number.isFinite(quantity) || quantity < 1) return;
            if (!Number.isFinite(quantity) || quantity < 1) return;

            try {
                const response = await fetch('http://localhost:5000/api/equipment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: draft.name,
                        quantity,
                        condition: draft.condition || 'Good',
                        status: draft.status || 'Available'
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || `Failed to add equipment (${response.status})`);

                showAlert('Equipment added successfully.');
                await window.loadEquipmentInventoryData();
            } catch (error) {
                console.error('Failed to add equipment:', error);
                showAlert(error.message || 'Failed to add equipment.');
            }
        });
    }

    if (equipmentInventoryTableBody) {
        const deleteEquipmentItem = async (equipmentId) => {
            if (!hasPermission('can_delete_equipment')) {
                showAlert('You do not have permission to delete equipment.');
                return;
            }

            const approved = await openSharedConfirmModal({
                title: 'Delete Equipment',
                subtitle: 'This action is permanent.',
                message: 'Delete this equipment record?',
                confirmText: 'Delete',
                danger: true
            });
            if (!approved) return;

            const response = await fetch(`http://localhost:5000/api/equipment/${equipmentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Failed to delete equipment (${response.status})`);
            showAlert('Equipment deleted.');
            await window.loadEquipmentInventoryData();
        };

        equipmentInventoryTableBody.addEventListener('click', async (event) => {
            const actionBtn = event.target.closest('[data-equipment-action]');
            if (!actionBtn) return;

            const action = actionBtn.getAttribute('data-equipment-action');
            const equipmentId = Number(actionBtn.getAttribute('data-equipment-id'));
            if (!equipmentId) return;

            try {
                if (action === 'edit') {
                    if (!hasPermission('can_edit_equipment') && !hasPermission('can_delete_equipment')) {
                        showAlert('You do not have permission to manage equipment.');
                        return;
                    }

                    const selectedItem = (Array.isArray(window.__employeeEquipmentCache)
                        ? window.__employeeEquipmentCache
                        : []).find(item => Number(item.equipment_id || 0) === equipmentId);
                    const updated = await openEquipmentEditorModal({ mode: 'edit', item: selectedItem });
                    if (!updated) return;
                    if (updated.deleteRequested) {
                        await deleteEquipmentItem(equipmentId);
                        return;
                    }
                    if (!updated.name) return;
                    const response = await fetch(`http://localhost:5000/api/equipment/${equipmentId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            name: updated.name,
                            condition: updated.condition || 'Good',
                            status: updated.status || 'Available'
                        })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || `Failed to update equipment (${response.status})`);
                    showAlert('Equipment updated.');
                    await window.loadEquipmentInventoryData();
                    return;
                }

                if (action === 'assign') {
                    if (!hasPermission('can_assign_equipment')) {
                        showAlert('You do not have permission to assign equipment.');
                        return;
                    }

                    const selectedItem = (Array.isArray(window.__employeeEquipmentCache)
                        ? window.__employeeEquipmentCache
                        : []).find(item => Number(item.equipment_id || 0) === equipmentId);
                    if (!selectedItem) {
                        showAlert('Equipment record not found. Please refresh and try again.');
                        return;
                    }

                    const users = await fetchAssignableEquipmentUsers();
                    if (!users.length) {
                        showAlert('No active employees available for assignment.');
                        return;
                    }

                    const assignment = await openEquipmentAssignModal(selectedItem, users);
                    if (!assignment) return;

                    const response = await fetch('http://localhost:5000/api/equipment/assign', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            equipment_id: equipmentId,
                            user_id: assignment.userId,
                            notes: assignment.notes || null
                        })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || `Failed to assign equipment (${response.status})`);
                    }

                    showAlert(data.message || 'Equipment assigned successfully.');
                    await window.loadEquipmentInventoryData();
                    await window.loadEquipmentData();
                    return;
                }

                if (action === 'delete') {
                    await deleteEquipmentItem(equipmentId);
                }
            } catch (error) {
                console.error('Equipment action failed:', error);
                showAlert(error.message || 'Equipment action failed.');
            }
        });
    }

    let projectFilesCache = [];
    const filesTableBody = document.getElementById('files-table-body');
    const openFileUploadBtn = document.getElementById('open-file-upload-btn');
    const cancelFileUploadBtn = document.getElementById('cancel-file-upload-btn');
    const fileUploadPanel = document.getElementById('file-upload-panel');
    const projectFileUploadForm = document.getElementById('project-file-upload-form');
    const projectFileInput = document.getElementById('project-file-input');
    const projectFileCategory = document.getElementById('project-file-category');
    const filesStorageFilter = document.getElementById('files-storage-filter');
    const filesSearchInput = document.getElementById('files-search-input');

    const filesTotalCount = document.getElementById('files-total-count');
    const filesCloudStorage = document.getElementById('files-cloud-storage');
    const filesFtpStorage = document.getElementById('files-ftp-storage');
    const filesStorageTotal = document.getElementById('files-storage-total');

    function updateFilesStats(files) {
        const total = files.length;
        const cloudMb = files
            .filter(f => f.storage_location === 'CLOUD')
            .reduce((sum, file) => sum + (Number(file.file_size_mb) || 0), 0);
        const ftpMb = files
            .filter(f => f.storage_location === 'LOCAL_FTP')
            .reduce((sum, file) => sum + (Number(file.file_size_mb) || 0), 0);
        const totalMb = cloudMb + ftpMb;

        if (filesTotalCount) filesTotalCount.textContent = String(total);
        if (filesCloudStorage) filesCloudStorage.textContent = cloudMb.toFixed(2);
        if (filesFtpStorage) filesFtpStorage.textContent = ftpMb.toFixed(2);
        if (filesStorageTotal) filesStorageTotal.textContent = totalMb.toFixed(2);
    }

    async function loadStorageSummary() {
        try {
            const response = await fetch('http://localhost:5000/api/files/storage-summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;

            const data = await response.json();
            const summary = data?.summary;
            if (!summary) return;

            const project = summary.project || {};
            const platform = summary.platform || {};
            const cloudMb = Number(project.cloudinary_mb ?? platform.cloudinary_mb ?? 0);
            const ftpMb = Number(project.local_ftp_mb ?? platform.local_ftp_mb ?? 0);
            const totalMb = Number(project.total_mb ?? (cloudMb + ftpMb));
            const fileCount = Number(project.file_count ?? projectFilesCache.length ?? 0);

            if (filesTotalCount) filesTotalCount.textContent = String(fileCount);
            if (filesCloudStorage) filesCloudStorage.textContent = cloudMb.toFixed(2);
            if (filesFtpStorage) filesFtpStorage.textContent = ftpMb.toFixed(2);
            if (filesStorageTotal) filesStorageTotal.textContent = totalMb.toFixed(2);
        } catch (error) {
            console.warn('Storage summary unavailable:', error.message);
        }
    }

    function renderProjectFilesTable(files) {
        if (!filesTableBody) return;

        if (files.length === 0) {
            filesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 36px; color: #9ca3af;">
                        <div style="font-size: 42px; margin-bottom: 10px;"><i class="bi bi-folder2-open"></i></div>
                        <div style="font-size: 16px; font-weight: 600; color: #374151;">No files found</div>
                        <div style="font-size: 13px; margin-top: 6px;">Upload project media or adjust filters to view files.</div>
                    </td>
                </tr>
            `;
            return;
        }

        const canDownloadFiles = hasPermission('can_download_files');
        const canEditFiles = hasPermission('can_edit_files');
        const canDeleteFiles = hasPermission('can_delete_files');

        filesTableBody.innerHTML = files.map(file => {
            const storage = file.storage_location || 'UNKNOWN';
            const isCloud = storage === 'CLOUD';
            const storageClass = isCloud ? 'storage-cloud' : 'storage-ftp';
            const storageIcon = isCloud ? 'bi-cloud-check' : 'bi-hdd-network';
            const uploadedBy = file.uploader?.full_name || 'Unknown';
            const uploadedAt = file.uploaded_at
                ? new Date(file.uploaded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '-';

            return `
                <tr>
                    <td class="file-name-cell">
                        <div class="file-name-primary" title="${escapeHtml(file.file_name)}">${escapeHtml(file.file_name)}</div>
                        <div class="file-name-secondary">ID #${Number(file.file_id || 0)}</div>
                    </td>
                    <td>${escapeHtml(file.file_type || '-')}</td>
                    <td>${Number(file.file_size_mb || 0).toFixed(2)}</td>
                    <td>
                        <span class="storage-badge ${storageClass}">
                            <i class="bi ${storageIcon}"></i>${escapeHtml(storage)}
                        </span>
                    </td>
                    <td>${escapeHtml(uploadedAt)}</td>
                    <td>${escapeHtml(uploadedBy)}</td>
                    <td>
                        <div class="files-actions">
                            ${canEditFiles ? `
                                <button class="btn-small btn-edit-file" data-file-id="${Number(file.file_id || 0)}" data-file-name="${escapeHtml(file.file_name || '')}" title="Edit File Name">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                            ` : ''}
                            ${canDownloadFiles ? `
                                <button class="btn-small btn-download-file" data-file-id="${Number(file.file_id || 0)}" title="Download File">
                                    <i class="bi bi-download"></i>
                                </button>
                            ` : ''}
                            ${canDeleteFiles ? `
                                <button class="btn-small btn-delete-file" data-file-id="${Number(file.file_id || 0)}" title="Delete File" style="background:#ef4444;">
                                    <i class="bi bi-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function applyProjectFilesFilters() {
        const storageFilter = (filesStorageFilter?.value || 'ALL').trim();
        const searchText = (filesSearchInput?.value || '').trim().toLowerCase();

        const filtered = projectFilesCache.filter(file => {
            const matchesStorage = storageFilter === 'ALL' || file.storage_location === storageFilter;
            const fileName = (file.file_name || '').toLowerCase();
            const fileType = (file.file_type || '').toLowerCase();
            const uploaderName = (file.uploader?.full_name || '').toLowerCase();
            const uploaderEmail = (file.uploader?.email || '').toLowerCase();
            const matchesSearch = !searchText
                || fileName.includes(searchText)
                || fileType.includes(searchText)
                || uploaderName.includes(searchText)
                || uploaderEmail.includes(searchText);
            return matchesStorage && matchesSearch;
        });

        renderProjectFilesTable(filtered);
    }

    window.loadEmployeeFilesData = async function() {
        if (!filesTableBody) return;

        if (!hasPermission('can_view_files') && !hasPermission('can_download_files')) {
            filesTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#9ca3af;">You do not have permission to view files.</td></tr>';
            if (filesTotalCount) filesTotalCount.textContent = '0';
            if (filesCloudStorage) filesCloudStorage.textContent = '0.00';
            if (filesFtpStorage) filesFtpStorage.textContent = '0.00';
            if (filesStorageTotal) filesStorageTotal.textContent = '0.00';
            return;
        }

        filesTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 24px; color:#6b7280;">Loading project files...</td></tr>';

        try {
            const response = await fetch('http://localhost:5000/api/files', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to load files');
            }

            const data = await response.json();
            projectFilesCache = data.files || [];
            updateFilesStats(projectFilesCache);
            await loadStorageSummary();
            applyProjectFilesFilters();
        } catch (error) {
            console.error('Load files error:', error);
            filesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 36px; color: #ef4444;">
                        <div style="font-size: 40px; margin-bottom: 10px;"><i class="bi bi-exclamation-triangle-fill"></i></div>
                        <div style="font-weight: 600;">Failed to load files</div>
                        <div style="font-size: 13px; margin-top: 6px; color: #6b7280;">${escapeHtml(error.message)}</div>
                    </td>
                </tr>
            `;
        }
    };

    if (openFileUploadBtn && fileUploadPanel) {
        openFileUploadBtn.addEventListener('click', () => {
            if (!hasPermission('can_upload_files')) {
                showAlert('You do not have permission to upload files.');
                return;
            }
            fileUploadPanel.classList.remove('hidden');
        });
    }

    if (cancelFileUploadBtn && fileUploadPanel && projectFileUploadForm) {
        cancelFileUploadBtn.addEventListener('click', () => {
            projectFileUploadForm.reset();
            fileUploadPanel.classList.add('hidden');
        });
    }

    if (projectFileUploadForm) {
        projectFileUploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_upload_files')) {
                showAlert('You do not have permission to upload files.');
                return;
            }

            const selectedFile = projectFileInput?.files?.[0];
            if (!selectedFile) {
                showAlert('Please choose a file to upload.');
                return;
            }

            const submitBtn = document.getElementById('submit-file-upload-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';
            }

            try {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('category', projectFileCategory?.value || 'project_progress');

                const response = await fetch('http://localhost:5000/api/files', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                showAlert('File uploaded successfully.');
                projectFileUploadForm.reset();
                fileUploadPanel.classList.add('hidden');
                if (filesStorageFilter) filesStorageFilter.value = 'ALL';
                if (filesSearchInput) filesSearchInput.value = '';
                await window.loadEmployeeFilesData();
            } catch (error) {
                console.error('Upload file error:', error);
                if (String(error.message).includes('Failed to fetch')) {
                    showAlert('Upload failed: Cannot reach backend API at http://localhost:5000. Start the backend and try again.');
                } else {
                    showAlert(`Upload failed: ${error.message}`);
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';
                }
            }
        });
    }

    if (filesStorageFilter) {
        filesStorageFilter.addEventListener('change', applyProjectFilesFilters);
    }

    if (filesSearchInput) {
        filesSearchInput.addEventListener('input', applyProjectFilesFilters);
    }

    if (filesTableBody) {
        filesTableBody.addEventListener('click', async (event) => {
            const editBtn = event.target.closest('.btn-edit-file');
            const downloadBtn = event.target.closest('.btn-download-file');
            const deleteBtn = event.target.closest('.btn-delete-file');

            if (editBtn) {
                if (!hasPermission('can_edit_files')) {
                    showAlert('You do not have permission to edit file metadata.');
                    return;
                }

                const fileId = Number(editBtn.getAttribute('data-file-id'));
                const currentName = editBtn.getAttribute('data-file-name') || '';
                if (!fileId) return;

                const newName = await openSharedActionInputModal({
                    title: 'Edit File Name',
                    subtitle: 'Update file metadata name.',
                    label: 'File Name',
                    value: currentName,
                    placeholder: 'Enter new file name'
                });
                if (newName === null) return;

                const trimmedName = String(newName).trim();
                if (!trimmedName) {
                    showAlert('File name cannot be empty.');
                    return;
                }

                try {
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ file_name: trimmedName })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || 'Update failed');

                    showAlert('File name updated successfully.');
                    await window.loadEmployeeFilesData();
                } catch (error) {
                    console.error('Edit file error:', error);
                    showAlert(`Edit failed: ${error.message}`);
                }
            }

            if (downloadBtn) {
                if (!hasPermission('can_download_files')) {
                    showAlert('You do not have permission to download files.');
                    return;
                }

                const fileId = Number(downloadBtn.getAttribute('data-file-id'));
                if (!fileId) return;

                try {
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}/download`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || 'Download failed');

                    const url = data?.file?.url;
                    const fileName = data?.file?.file_name || `file-${fileId}`;
                    if (!url) throw new Error('File URL unavailable.');

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                } catch (error) {
                    console.error('Download file error:', error);
                    showAlert(`Download failed: ${error.message}`);
                }
            }

            if (deleteBtn) {
                if (!hasPermission('can_delete_files')) {
                    showAlert('You do not have permission to delete files.');
                    return;
                }

                const fileId = Number(deleteBtn.getAttribute('data-file-id'));
                if (!fileId) return;

                const confirmed = await openSharedConfirmModal({
                    title: 'Delete File',
                    subtitle: 'This action is permanent.',
                    message: 'Delete this file permanently? This action cannot be undone.',
                    confirmText: 'Delete',
                    danger: true
                });
                if (!confirmed) return;

                try {
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || 'Delete failed');

                    showAlert('File deleted successfully.');
                    await window.loadEmployeeFilesData();
                } catch (error) {
                    console.error('Delete file error:', error);
                    showAlert(`Delete failed: ${error.message}`);
                }
            }
        });
    }

    let employeeInquiriesCache = [];
    let assignableInquiryUsersCache = [];
    const expandedEmployeeInquirySubjectIds = new Set();
    const expandedEmployeeInquiryMessageIds = new Set();

    const inquiryForm = document.getElementById('admin-inquiry-form');
    const inquiryClientNameInput = document.getElementById('admin-inquiry-client-name');
    const inquiryClientEmailInput = document.getElementById('admin-inquiry-client-email');
    const inquirySubjectInput = document.getElementById('admin-inquiry-subject');
    const inquiryMessageInput = document.getElementById('admin-inquiry-message');
    const inquirySubmitBtn = document.getElementById('admin-inquiry-submit-btn');
    const inquiryFormMessage = document.getElementById('admin-inquiry-form-message');
    const inquiriesTableBody = document.getElementById('inquiry-table-body');
    const inquirySearchInput = document.getElementById('inquiry-search-input');
    const inquiryStatusFilter = document.getElementById('inquiry-status-filter');
    const inquiriesTotalCount = document.getElementById('inquiries-stat-total');
    const inquiriesPendingCount = document.getElementById('inquiries-stat-pending');
    const inquiriesProgressCount = document.getElementById('inquiries-stat-progress');
    const inquiriesResolvedCount = document.getElementById('inquiries-stat-resolved');

    function setInquiryFormMessage(message, tone = 'neutral') {
        if (!inquiryFormMessage) return;
        inquiryFormMessage.textContent = message;
        inquiryFormMessage.classList.remove('success', 'error');
        if (tone === 'success') inquiryFormMessage.classList.add('success');
        if (tone === 'error') inquiryFormMessage.classList.add('error');
    }

    function getEmployeeInquiryStatusBadgeClass(status) {
        if (status === 'Resolved' || status === 'Closed') return 'success';
        if (status === 'In Progress') return '';
        return 'warning';
    }

    function getCollapsibleEmployeeInquiryCellHtml({ inquiryId, textValue, field, expandedSet, maxLength }) {
        const rawText = String(textValue || '').trim();
        const safeText = rawText || '-';
        const isExpanded = expandedSet.has(inquiryId);
        const shouldCollapse = safeText.length > maxLength;
        const displayText = shouldCollapse && !isExpanded
            ? `${safeText.slice(0, maxLength).trimEnd()}...`
            : safeText;

        return {
            text: displayText,
            toggleHtml: shouldCollapse
                ? `<button type="button" class="inquiry-view-more-btn" data-inquiry-id="${inquiryId}" data-field="${field}">${isExpanded ? 'View less' : 'View more'}</button>`
                : ''
        };
    }

    function updateEmployeeInquiryStats(inquiries) {
        const list = Array.isArray(inquiries) ? inquiries : [];
        const total = list.length;
        const pending = list.filter(item => String(item.status || 'Pending') === 'Pending').length;
        const progress = list.filter(item => String(item.status || '') === 'In Progress').length;
        const resolved = list.filter(item => ['Resolved', 'Closed'].includes(String(item.status || ''))).length;

        if (inquiriesTotalCount) inquiriesTotalCount.textContent = String(total);
        if (inquiriesPendingCount) inquiriesPendingCount.textContent = String(pending);
        if (inquiriesProgressCount) inquiriesProgressCount.textContent = String(progress);
        if (inquiriesResolvedCount) inquiriesResolvedCount.textContent = String(resolved);
    }

    function applyEmployeeInquiryFilters() {
        const query = String(inquirySearchInput?.value || '').trim().toLowerCase();
        const status = String(inquiryStatusFilter?.value || 'ALL').trim();

        const filtered = employeeInquiriesCache.filter(inquiry => {
            const currentStatus = String(inquiry.status || 'Pending');
            const matchesStatus = status === 'ALL' || currentStatus === status;
            const textBlob = `${inquiry.client_name || ''} ${inquiry.client_email || ''} ${inquiry.subject || ''} ${inquiry.message || inquiry.message_body || ''}`.toLowerCase();
            const matchesQuery = !query || textBlob.includes(query);
            return matchesStatus && matchesQuery;
        });

        renderEmployeeInquiriesTable(filtered);
    }

    function renderEmployeeInquiriesTable(inquiries) {
        if (!inquiriesTableBody) return;

        if (!inquiries.length) {
            inquiriesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">No inquiries found for current filters.</td></tr>';
            return;
        }

        const canUpdateInquiries = hasPermission('can_update_inquiries');
        const canDeleteInquiries = hasPermission('can_delete_inquiries');
        const canAssignInquiries = hasPermission('can_assign_inquiries');

        inquiriesTableBody.innerHTML = inquiries.map(inquiry => {
            const inquiryId = Number(inquiry.inquiry_id || 0);
            const submittedAt = inquiry.submitted_at
                ? new Date(inquiry.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '--';
            const status = String(inquiry.status || 'Pending');
            const statusClass = getEmployeeInquiryStatusBadgeClass(status);
            const inquiryMessage = String(inquiry.message || inquiry.message_body || '');
            const subjectCell = getCollapsibleEmployeeInquiryCellHtml({
                inquiryId,
                textValue: inquiry.subject || '-',
                field: 'subject',
                expandedSet: expandedEmployeeInquirySubjectIds,
                maxLength: 48
            });
            const messageCell = getCollapsibleEmployeeInquiryCellHtml({
                inquiryId,
                textValue: inquiryMessage,
                field: 'message',
                expandedSet: expandedEmployeeInquiryMessageIds,
                maxLength: 110
            });

            return `
                <tr>
                    <td>${escapeHtml(submittedAt)}</td>
                    <td>${escapeHtml(inquiry.client_name || '--')}</td>
                    <td>${escapeHtml(inquiry.client_email || '--')}</td>
                    <td class="inquiry-subject-cell" title="${escapeHtml(inquiry.subject || '--')}">
                        <span>${escapeHtml(subjectCell.text)}</span>
                        ${subjectCell.toggleHtml}
                    </td>
                    <td class="inquiry-message-cell" title="${escapeHtml(inquiryMessage)}">
                        <span>${escapeHtml(messageCell.text)}</span>
                        ${messageCell.toggleHtml}
                    </td>
                    <td>
                        ${canUpdateInquiries
                            ? `<select class="modern-select employee-inquiry-status-select" data-inquiry-action="status" data-inquiry-id="${inquiryId}">
                                <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Resolved" ${status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                                <option value="Closed" ${status === 'Closed' ? 'selected' : ''}>Closed</option>
                            </select>`
                            : `<span class="badge ${statusClass}">${escapeHtml(status)}</span>`
                        }
                    </td>
                    <td>
                        ${inquiry.manager
                            ? `<span class="inquiry-assignee"><i class="bi bi-person-check"></i> ${escapeHtml(inquiry.manager.full_name || 'Assigned')}</span>`
                            : '<span class="muted-note">Unassigned</span>'
                        }
                    </td>
                    <td>
                        <div class="inquiry-actions">
                            ${canAssignInquiries ? `<button type="button" class="btn-small btn-assign-inquiry" data-inquiry-action="assign" data-inquiry-id="${inquiryId}" style="background:#2dad50;"><i class="bi bi-person-check"></i></button>` : ''}
                            ${canDeleteInquiries ? `<button type="button" class="btn-small btn-delete-inquiry" data-inquiry-action="delete" data-inquiry-id="${inquiryId}" style="background:#ef4444;"><i class="bi bi-trash"></i></button>` : ''}
                            ${!canAssignInquiries && !canDeleteInquiries ? '<span class="muted-note">No actions</span>' : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function fetchEmployeeAssignableInquiryUsers() {
        if (assignableInquiryUsersCache.length) return assignableInquiryUsersCache;

        const response = await fetch('http://localhost:5000/api/inquiries/assignable-users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to load assignable users (${response.status})`);
        }

        assignableInquiryUsersCache = Array.isArray(data.users) ? data.users : [];
        return assignableInquiryUsersCache;
    }

    function openEmployeeInquiryAssignModal(inquiry, users) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modern-modal modal-compact admin-assign-modal" role="dialog" aria-modal="true" aria-label="Assign inquiry">
                <div class="modal-header">
                    <div class="modal-header-content">
                        <div class="modal-icon"><i class="bi bi-people-fill"></i></div>
                        <div>
                            <h2 class="modal-title">Assign Inquiry</h2>
                            <p class="modal-subtitle">Assign ${escapeHtml(inquiry.subject || 'client inquiry')}</p>
                        </div>
                    </div>
                    <span class="close-modal" id="employee-inquiry-assign-close-btn">&times;</span>
                </div>
                <div class="form-scroll-body admin-assign-body">
                    <label class="modern-label" for="employee-inquiry-assign-user-search">Search User</label>
                    <input type="text" id="employee-inquiry-assign-user-search" class="modern-input" placeholder="Type name or email..." autocomplete="off">
                    <div class="assign-user-search-list" id="employee-inquiry-assign-user-list"></div>
                </div>
                <div class="modal-actions admin-assign-actions">
                    <button type="button" class="btn-secondary" id="employee-inquiry-assign-cancel-btn">Cancel</button>
                    <button type="button" class="btn-primary" id="employee-inquiry-assign-confirm-btn" disabled>Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#employee-inquiry-assign-close-btn');
        const cancelBtn = modal.querySelector('#employee-inquiry-assign-cancel-btn');
        const confirmBtn = modal.querySelector('#employee-inquiry-assign-confirm-btn');
        const searchInput = modal.querySelector('#employee-inquiry-assign-user-search');
        const listEl = modal.querySelector('#employee-inquiry-assign-user-list');
        let selectedUser = null;

        const closeModal = (result = null) => {
            modal.remove();
            return result;
        };

        return new Promise((resolve) => {
            const handleClose = (result = null) => resolve(closeModal(result));

            const setSelectedUser = (userItem) => {
                selectedUser = userItem || null;
                if (confirmBtn) confirmBtn.disabled = !selectedUser;

                if (!listEl) return;
                listEl.querySelectorAll('.assign-user-option').forEach((option) => {
                    const userId = Number(option.getAttribute('data-user-id') || 0);
                    option.classList.toggle('selected', Boolean(selectedUser) && userId === Number(selectedUser.user_id));
                });
            };

            const renderList = (queryText = '') => {
                if (!listEl) return;
                const query = String(queryText || '').trim().toLowerCase();
                const filtered = users.filter((u) => {
                    const name = String(u.full_name || '').toLowerCase();
                    const email = String(u.email || '').toLowerCase();
                    return !query || name.includes(query) || email.includes(query);
                });

                if (!filtered.length) {
                    listEl.innerHTML = '<div class="assign-user-empty">No matching users found.</div>';
                    return;
                }

                listEl.innerHTML = filtered.map((u) => `
                    <button type="button" class="assign-user-option" data-user-id="${Number(u.user_id || 0)}">
                        <span class="assign-user-name">${escapeHtml(u.full_name || 'Unknown')}</span>
                        <span class="assign-user-email">${escapeHtml(u.email || '--')}</span>
                    </button>
                `).join('');
            };

            if (closeBtn) closeBtn.addEventListener('click', () => handleClose(null));
            if (cancelBtn) cancelBtn.addEventListener('click', () => handleClose(null));
            if (confirmBtn) confirmBtn.addEventListener('click', () => {
                if (!selectedUser) return;
                handleClose(selectedUser);
            });

            modal.addEventListener('click', (event) => {
                if (event.target === modal) handleClose(null);
            });

            if (searchInput) {
                searchInput.addEventListener('input', () => renderList(searchInput.value));
                setTimeout(() => searchInput.focus(), 0);
            }

            if (listEl) {
                listEl.addEventListener('click', (event) => {
                    const option = event.target.closest('.assign-user-option');
                    if (!option) return;

                    const selectedUserId = Number(option.getAttribute('data-user-id') || 0);
                    const pickedUser = users.find((u) => Number(u.user_id || 0) === selectedUserId);
                    if (!pickedUser) return;
                    setSelectedUser(pickedUser);
                });
            }

            setSelectedUser(null);
            renderList('');
        });
    }

    async function assignEmployeeInquiry(inquiry) {
        if (!hasPermission('can_assign_inquiries')) {
            showAlert('You do not have permission to assign inquiries.');
            return;
        }

        if (!inquiry?.inquiry_id) {
            showAlert('Inquiry record not found. Please refresh and try again.');
            return;
        }

        const users = await fetchEmployeeAssignableInquiryUsers();
        if (!users.length) {
            showAlert('No active employees available for assignment.');
            return;
        }

        const selectedUser = await openEmployeeInquiryAssignModal(inquiry, users);
        if (!selectedUser) return;

        const response = await fetch(`http://localhost:5000/api/inquiries/${Number(inquiry.inquiry_id)}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ handled_by: Number(selectedUser.user_id) })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to assign inquiry (${response.status})`);
        }

        showAlert(data.message || 'Inquiry assigned successfully.');
        await window.loadEmployeeInquiriesData();
    }

    window.loadEmployeeInquiriesData = async function() {
        if (!inquiriesTableBody) return;

        if (!hasPermission('can_view_inquiries')) {
            inquiriesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view inquiry records.</td></tr>';
            return;
        }

        try {
            inquiriesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#6b7280;">Loading inquiries...</td></tr>';

            const response = await fetch('http://localhost:5000/api/inquiries', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(`Failed to load inquiries (${response.status})`);
            }

            const data = await response.json();
            employeeInquiriesCache = data.inquiries || [];
            expandedEmployeeInquirySubjectIds.clear();
            expandedEmployeeInquiryMessageIds.clear();
            updateEmployeeInquiryStats(employeeInquiriesCache);
            applyEmployeeInquiryFilters();
        } catch (error) {
            console.error('Failed to load employee inquiries:', error);
            inquiriesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:#ef4444;">Failed to load inquiry records.</td></tr>';
        }
    };

    if (inquirySearchInput) {
        inquirySearchInput.addEventListener('input', applyEmployeeInquiryFilters);
    }

    if (inquiryStatusFilter) {
        inquiryStatusFilter.addEventListener('change', applyEmployeeInquiryFilters);
    }

    if (inquiryForm) {
        inquiryForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_add_inquiries')) {
                setInquiryFormMessage('You do not have permission to submit inquiries.', 'error');
                return;
            }

            const clientName = String(inquiryClientNameInput?.value || '').trim();
            const clientEmail = String(inquiryClientEmailInput?.value || '').trim();
            const subject = String(inquirySubjectInput?.value || '').trim();
            const message = String(inquiryMessageInput?.value || '').trim();
            if (!clientName || !clientEmail || !subject || !message) {
                setInquiryFormMessage('Please complete all required fields.', 'error');
                return;
            }

            try {
                if (inquirySubmitBtn) {
                    inquirySubmitBtn.disabled = true;
                    inquirySubmitBtn.textContent = 'Submitting...';
                }

                const response = await fetch('http://localhost:5000/api/inquiries', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        client_name: clientName,
                        client_email: clientEmail,
                        subject,
                        message
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || `Failed to submit inquiry (${response.status})`);

                inquiryForm.reset();
                setInquiryFormMessage('Inquiry submitted successfully.', 'success');
                await window.loadEmployeeInquiriesData();
            } catch (error) {
                console.error('Failed to submit inquiry:', error);
                setInquiryFormMessage(error.message || 'Failed to submit inquiry.', 'error');
            } finally {
                if (inquirySubmitBtn) {
                    inquirySubmitBtn.disabled = !hasPermission('can_add_inquiries');
                    inquirySubmitBtn.textContent = 'Submit Inquiry';
                }
            }
        });
    }

    if (inquiriesTableBody) {
        inquiriesTableBody.addEventListener('click', async (event) => {
            const viewMoreBtn = event.target.closest('.inquiry-view-more-btn');
            if (viewMoreBtn) {
                const inquiryId = Number(viewMoreBtn.getAttribute('data-inquiry-id'));
                const field = String(viewMoreBtn.getAttribute('data-field') || '');
                if (!inquiryId) return;

                if (field === 'subject') {
                    if (expandedEmployeeInquirySubjectIds.has(inquiryId)) {
                        expandedEmployeeInquirySubjectIds.delete(inquiryId);
                    } else {
                        expandedEmployeeInquirySubjectIds.add(inquiryId);
                    }
                }

                if (field === 'message') {
                    if (expandedEmployeeInquiryMessageIds.has(inquiryId)) {
                        expandedEmployeeInquiryMessageIds.delete(inquiryId);
                    } else {
                        expandedEmployeeInquiryMessageIds.add(inquiryId);
                    }
                }

                applyEmployeeInquiryFilters();
                return;
            }

            const actionBtn = event.target.closest('[data-inquiry-action]');
            if (!actionBtn) return;

            const action = actionBtn.getAttribute('data-inquiry-action');
            const inquiryId = Number(actionBtn.getAttribute('data-inquiry-id'));
            if (!inquiryId) return;

            if (action === 'assign') {
                try {
                    const inquiryItem = employeeInquiriesCache.find(item => Number(item.inquiry_id) === inquiryId);
                    await assignEmployeeInquiry(inquiryItem);
                } catch (error) {
                    console.error('Assign inquiry failed:', error);
                    showAlert(error.message || 'Failed to assign inquiry.');
                }
                return;
            }

            if (action === 'delete') {
                if (!hasPermission('can_delete_inquiries')) {
                    showAlert('You do not have permission to delete inquiries.');
                    return;
                }

                const approved = await openSharedConfirmModal({
                    title: 'Delete Inquiry',
                    subtitle: 'This action is permanent.',
                    message: 'Delete this inquiry?',
                    confirmText: 'Delete',
                    danger: true
                });
                if (!approved) return;

                try {
                    const response = await fetch(`http://localhost:5000/api/inquiries/${inquiryId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(data.error || `Failed to delete inquiry (${response.status})`);
                    showAlert('Inquiry deleted.');
                    await window.loadEmployeeInquiriesData();
                } catch (error) {
                    console.error('Failed to delete inquiry:', error);
                    showAlert(error.message || 'Failed to delete inquiry.');
                }
            }
        });

        inquiriesTableBody.addEventListener('change', async (event) => {
            const statusSelect = event.target.closest('[data-inquiry-action="status"]');
            if (!statusSelect) return;

            if (!hasPermission('can_update_inquiries')) {
                showAlert('You do not have permission to update inquiries.');
                return;
            }

            const inquiryId = Number(statusSelect.getAttribute('data-inquiry-id'));
            const newStatus = statusSelect.value;
            if (!inquiryId || !newStatus) return;

            try {
                const response = await fetch(`http://localhost:5000/api/inquiries/${inquiryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: newStatus })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || `Failed to update inquiry (${response.status})`);
                showAlert('Inquiry status updated.');
                await window.loadEmployeeInquiriesData();
            } catch (error) {
                console.error('Failed to update inquiry:', error);
                showAlert(error.message || 'Failed to update inquiry.');
            }
        });
    }

    const triggerBackupBtn = document.getElementById('trigger-backup-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');
    const serverUptimeEl = document.getElementById('server-uptime');
    const dbStatusEl = document.getElementById('db-status');
    const lastBackupEl = document.getElementById('last-backup');
    const activeUsersEl = document.getElementById('active-users');
    const backupTableBody = document.getElementById('backup-table-body');
    const healthTableBody = document.getElementById('health-table-body');
    const siemFailedLoginsEl = document.getElementById('siem-failed-logins');
    const siemUnauthorizedEl = document.getElementById('siem-unauthorized');
    const siemEquipmentAnomaliesEl = document.getElementById('siem-equipment-anomalies');
    const siemAlertsBody = document.getElementById('siem-alerts-body');
    const siemSeverityFilter = document.getElementById('siem-severity-filter');
    const siemEventFilter = document.getElementById('siem-event-filter');
    const siemTimeFilter = document.getElementById('siem-time-filter');
    const siemFilterResetBtn = document.getElementById('siem-filter-reset-btn');
    const healthEventFilter = document.getElementById('health-event-filter');
    const healthDateFilter = document.getElementById('health-date-filter');
    const healthSearchInput = document.getElementById('health-search-input');
    const healthFilterResetBtn = document.getElementById('health-filter-reset-btn');

    let healthLogsCache = [];
    let siemAlertsCache = [];

    function resetHealthSearch() {
        if (!healthSearchInput) return;
        healthSearchInput.value = '';
        healthSearchInput.defaultValue = '';
    }

    resetHealthSearch();
    window.addEventListener('pageshow', resetHealthSearch);

    function healthBadgeClass(eventType) {
        if (/BACKUP|SUCCESS|HEALTHY/i.test(eventType)) return 'success';
        if (/ERROR|FAILED|DENIED|WARNING|PERMISSION/i.test(eventType)) return 'warning';
        return '';
    }

    function formatHealthTimestamp(value) {
        if (!value) return '-';
        const dt = new Date(value);
        return dt.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function formatHealthLogDescription(description = '') {
        const cleaned = String(description)
            .replace(/^\[(?:SIEM|NOTIFICATION)\]\[[A-Z]+\]\s*/i, '')
            .replace(/\s+\|\s*context=.*$/i, '')
            .replace(/\s+\|\s*method=.*$/i, '')
            .trim();

        return cleaned || '-';
    }

    function populateHealthEventFilter(logs) {
        if (!healthEventFilter) return;
        const events = Array.from(new Set((logs || []).map(l => l.event_type).filter(Boolean))).sort();
        healthEventFilter.innerHTML = `<option value="ALL">All Events</option>${events.map(evt => `<option value="${escapeHtml(evt)}">${escapeHtml(evt)}</option>`).join('')}`;
    }

    function renderHealthLogsTable(logs) {
        if (!healthTableBody) return;

        if (!logs || logs.length === 0) {
            healthTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No logs found for current filters</td></tr>';
            return;
        }

        healthTableBody.innerHTML = logs.slice(0, 200).map(log => {
            const badgeClass = healthBadgeClass(log.event_type || '');
            const ip = log.ip_address || 'N/A';
            const emailMatch = (log.description || '').match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
            const actor = emailMatch?.[1] || 'System';

            return `
                <tr>
                    <td>${formatHealthTimestamp(log.timestamp)}</td>
                    <td><span class="badge ${badgeClass}">${escapeHtml(log.event_type || '-')}</span></td>
                    <td>${escapeHtml(formatHealthLogDescription(log.description || '-'))}</td>
                    <td>${escapeHtml(ip)}</td>
                    <td>${escapeHtml(actor)}</td>
                </tr>
            `;
        }).join('');
    }

    function getSiemSeverity(log = {}) {
        const description = String(log.description || '');
        const match = description.match(/\[SIEM\]\[([A-Z]+)\]/i);
        const severity = match?.[1]?.toLowerCase() || 'medium';
        if (severity === 'low' || severity === 'high') return severity;
        return 'medium';
    }

    function formatSiemDescription(description = '') {
        const cleaned = String(description)
            .replace(/^\[SIEM\]\[[A-Z]+\]\s*/i, '')
            .replace(/\s+\|\s*context=.*$/i, '')
            .replace(/\s+\|\s*method=.*$/i, '')
            .trim();

        return cleaned || '-';
    }

    function renderSiemAlerts(alerts) {
        if (!siemAlertsBody) return;

        if (!alerts || alerts.length === 0) {
            siemAlertsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No security alerts in the selected window</td></tr>';
            return;
        }

        siemAlertsBody.innerHTML = alerts.map(alert => {
            const severity = getSiemSeverity(alert);
            const badge = `<span class="siem-severity-badge ${severity}">${severity.toUpperCase()}</span>`;
            return `
                <tr>
                    <td>${formatHealthTimestamp(alert.timestamp)}</td>
                    <td>${badge}</td>
                    <td><span class="badge ${healthBadgeClass(alert.event_type || '')}">${escapeHtml(alert.event_type || '-')}</span></td>
                    <td>${escapeHtml(formatSiemDescription(alert.description || ''))}</td>
                    <td>${escapeHtml(alert.ip_address || 'N/A')}</td>
                </tr>
            `;
        }).join('');
    }

    function populateSiemEventFilter(alerts) {
        if (!siemEventFilter) return;
        const events = Array.from(new Set((alerts || []).map(a => a.event_type).filter(Boolean))).sort();
        siemEventFilter.innerHTML = `<option value="ALL">All Events</option>${events.map(evt => `<option value="${escapeHtml(evt)}">${escapeHtml(evt)}</option>`).join('')}`;
    }

    function applySiemFilters() {
        const selectedSeverity = (siemSeverityFilter?.value || 'ALL').toLowerCase();
        const selectedEventType = (siemEventFilter?.value || 'ALL').trim();
        const selectedTime = (siemTimeFilter?.value || '24h').trim();
        const timeHours = { '1h': 1, '6h': 6, '12h': 12, '24h': 24 };
        const cutoffHours = timeHours[selectedTime] || 24;
        const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000);

        const filtered = siemAlertsCache.filter(alert => {
            const severity = getSiemSeverity(alert);
            const matchesSeverity = selectedSeverity === 'all' || severity === selectedSeverity;
            const matchesEvent = selectedEventType === 'ALL' || (alert.event_type || '') === selectedEventType;
            const ts = new Date(alert.timestamp);
            const matchesTime = Number.isNaN(ts.getTime()) ? false : ts >= cutoff;
            return matchesSeverity && matchesEvent && matchesTime;
        });

        renderSiemAlerts(filtered);
    }

    function resetSiemFilters(event) {
        if (event) event.preventDefault();
        if (siemSeverityFilter) siemSeverityFilter.value = 'ALL';
        if (siemEventFilter) siemEventFilter.value = 'ALL';
        if (siemTimeFilter) siemTimeFilter.value = '24h';
        applySiemFilters();
    }

    function applyHealthLogFilters() {
        const eventType = (healthEventFilter?.value || 'ALL').trim();
        const dateValue = (healthDateFilter?.value || '').trim();
        const query = (healthSearchInput?.value || '').trim().toLowerCase();

        const filtered = healthLogsCache.filter(log => {
            const matchesEvent = eventType === 'ALL' || (log.event_type || '') === eventType;
            const logDate = new Date(log.timestamp);
            const logDateIso = Number.isNaN(logDate.getTime()) ? '' : logDate.toISOString().slice(0, 10);
            const matchesDate = !dateValue || logDateIso === dateValue;
            const emailMatch = (log.description || '').match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
            const actor = (emailMatch?.[1] || 'system').toLowerCase();
            const textBlob = `${(log.description || '').toLowerCase()} ${(log.ip_address || '').toLowerCase()} ${actor} ${(log.event_type || '').toLowerCase()}`;
            const matchesQuery = !query || textBlob.includes(query);
            return matchesEvent && matchesDate && matchesQuery;
        });

        renderHealthLogsTable(filtered);
    }

    function resetHealthLogFilters(event) {
        if (event) event.preventDefault();
        if (healthEventFilter) healthEventFilter.value = 'ALL';
        if (healthDateFilter) healthDateFilter.value = '';
        if (healthSearchInput) healthSearchInput.value = '';
        applyHealthLogFilters();
    }

    window.loadSystemAdminData = async function() {
        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');
        const canViewHealth = canViewHealthLogs || canViewAuditTrail;

        if (!canViewHealth) {
            if (healthTableBody) {
                healthTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view system health logs.</td></tr>';
            }
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view security alerts.</td></tr>';
            }
            if (backupTableBody) {
                backupTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view backup history.</td></tr>';
            }
            return;
        }

        try {
            const summaryRequest = canViewHealthLogs
                ? fetch('http://localhost:5000/api/system/summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                : Promise.resolve(null);

            const [summaryResponse, logsResponse] = await Promise.all([
                summaryRequest,
                fetch('http://localhost:5000/api/system/health-logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (summaryResponse && summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                const summary = summaryData.summary || {};

                if (serverUptimeEl) serverUptimeEl.textContent = summary.server_uptime || '-';

                if (dbStatusEl) {
                    const connected = summary.db_status === 'connected';
                    dbStatusEl.textContent = connected ? 'CONNECTED' : 'DISCONNECTED';
                    dbStatusEl.classList.remove('text-success', 'text-orange');
                    dbStatusEl.classList.add(connected ? 'text-success' : 'text-orange');
                }

                if (lastBackupEl) lastBackupEl.textContent = summary.last_backup?.relative || 'No backups yet';
                if (activeUsersEl) activeUsersEl.textContent = Number(summary.active_users || 0);

                const securityMonitoring = summary.security_monitoring || {};
                if (siemFailedLoginsEl) siemFailedLoginsEl.textContent = Number(securityMonitoring.failed_login_attempts_24h || 0);
                if (siemUnauthorizedEl) siemUnauthorizedEl.textContent = Number(securityMonitoring.unauthorized_access_attempts_24h || 0);
                if (siemEquipmentAnomaliesEl) siemEquipmentAnomaliesEl.textContent = Number(securityMonitoring.abnormal_equipment_activity_24h || 0);

                siemAlertsCache = securityMonitoring.latest_alerts || [];
                populateSiemEventFilter(siemAlertsCache);
                applySiemFilters();

                if (backupTableBody) {
                    const backups = summary.backup_history || [];
                    if (backups.length === 0) {
                        backupTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:#9ca3af;">No backup history yet</td></tr>';
                    } else {
                        backupTableBody.innerHTML = backups.map(backup => `
                            <tr>
                                <td>${backup.backup_id}</td>
                                <td>${formatHealthTimestamp(backup.timestamp)}</td>
                                <td>${backup.type}</td>
                                <td>${Number(backup.size_mb || 0).toFixed(2)} MB</td>
                                <td><span class="badge success">${backup.status}</span></td>
                                <td>${backup.storage}</td>
                            </tr>
                        `).join('');
                    }
                }
            }

            if (logsResponse.ok && healthTableBody) {
                const logsData = await logsResponse.json();
                healthLogsCache = logsData.logs || [];
                populateHealthEventFilter(healthLogsCache);
                applyHealthLogFilters();
            } else if (healthTableBody) {
                const message = logsResponse && logsResponse.status === 403
                    ? 'You do not have permission to view audit logs.'
                    : 'Failed to load health logs';
                healthTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">${message}</td></tr>`;
            }
        } catch (error) {
            console.error('System health load error:', error);
            if (backupTableBody) {
                backupTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Failed to load backup history</td></tr>';
            }
            if (healthTableBody) {
                healthTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load health logs</td></tr>';
            }
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load security alerts</td></tr>';
            }
        }
    };

    if (healthEventFilter) healthEventFilter.addEventListener('change', applyHealthLogFilters);
    if (healthDateFilter) healthDateFilter.addEventListener('change', applyHealthLogFilters);
    if (healthSearchInput) healthSearchInput.addEventListener('input', applyHealthLogFilters);
    if (healthFilterResetBtn) healthFilterResetBtn.addEventListener('click', resetHealthLogFilters);
    if (siemSeverityFilter) siemSeverityFilter.addEventListener('change', applySiemFilters);
    if (siemEventFilter) siemEventFilter.addEventListener('change', applySiemFilters);
    if (siemTimeFilter) siemTimeFilter.addEventListener('change', applySiemFilters);
    if (siemFilterResetBtn) siemFilterResetBtn.addEventListener('click', resetSiemFilters);

    if (triggerBackupBtn) {
        triggerBackupBtn.addEventListener('click', async () => {
            if (!hasPermission('can_backup_database')) {
                showAlert('You do not have permission to trigger database backups.');
                return;
            }

            try {
                triggerBackupBtn.disabled = true;
                triggerBackupBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Running...';

                const response = await fetch('http://localhost:5000/api/system/backup', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Backup failed');

                showAlert(`Backup completed.\n\nID: ${data.backup_id}\nSize: ${Number(data.size_mb || 0).toFixed(2)} MB\nStorage: ${data.storage || 'LOCAL_FTP'}`);
                await window.loadSystemAdminData();
            } catch (error) {
                console.error('Backup trigger error:', error);
                showAlert(`Backup failed: ${error.message}`);
            } finally {
                triggerBackupBtn.disabled = false;
                triggerBackupBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Trigger Backup';
            }
        });
    }

    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', async () => {
            if (!hasPermission('can_export_health_logs')) {
                showAlert('You do not have permission to export system health logs.');
                return;
            }

            try {
                exportLogsBtn.disabled = true;
                exportLogsBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';

                const response = await fetch('http://localhost:5000/api/system/export-logs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || 'Export failed');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `system_health_logs_${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);

                showAlert('System health logs exported successfully.');
            } catch (error) {
                console.error('Export logs error:', error);
                showAlert(`Export failed: ${error.message}`);
            } finally {
                exportLogsBtn.disabled = false;
                exportLogsBtn.innerHTML = '<i class="bi bi-download"></i> Export Logs (SAM)';
            }
        });
    }

    // Ensure first-tab data loads after all async loaders are defined.
    setTimeout(() => {
        const activeLink = sidebarNav.querySelector('a.active');
        if (!activeLink) return;
        const activeTargetId = activeLink.getAttribute('data-target');
        if (activeTargetId) {
            loadEmployeeTabData(activeTargetId);
        }
    }, 0);

    let employeeUsersCache = [];
    const employeeUsersTableBody = document.getElementById('employee-users-table-body');
    const employeeUsersSearchInput = document.getElementById('employee-users-search-input');
    const employeeAddUserBtn = document.getElementById('employee-add-user-btn');

    function resetEmployeeUsersSearchField() {
        if (!employeeUsersSearchInput) return;
        employeeUsersSearchInput.value = '';
        employeeUsersSearchInput.defaultValue = '';
        // Some browsers restore autofill/history asynchronously after paint.
        setTimeout(() => {
            if (employeeUsersSearchInput) employeeUsersSearchInput.value = '';
        }, 0);
        setTimeout(() => {
            if (employeeUsersSearchInput) employeeUsersSearchInput.value = '';
        }, 180);
    }

    resetEmployeeUsersSearchField();
    window.addEventListener('pageshow', resetEmployeeUsersSearchField);
    const addUserModalEmployee = document.getElementById('add-user-modal-employee');
    const closeUserModalBtnEmployee = document.getElementById('close-user-modal-btn-employee');
    const cancelUserModalBtnEmployee = document.getElementById('cancel-user-modal-btn-employee');
    const addUserFormEmployee = document.getElementById('add-user-form-employee');
    const addUserFullnameEmployee = document.getElementById('employee-user-fullname');
    const addUserEmailEmployee = document.getElementById('employee-user-email');
    const addUserContactEmployee = document.getElementById('employee-user-contact');
    const addUserRoleEmployee = document.getElementById('employee-user-role');
    const addUserPasswordEmployee = document.getElementById('employee-user-password');
    const addUserPasswordConfirmEmployee = document.getElementById('employee-user-password-confirm');
    const addUserPasswordToggleBtnEmployee = document.getElementById('employee-user-password-toggle');
    const addUserPasswordConfirmToggleBtnEmployee = document.getElementById('employee-user-password-confirm-toggle');
    const addUserActiveEmployee = document.getElementById('employee-user-active');
    const passwordRuleLengthEmployee = document.getElementById('employee-password-rule-length');
    const passwordRuleUppercaseEmployee = document.getElementById('employee-password-rule-uppercase');
    const passwordRuleLowercaseEmployee = document.getElementById('employee-password-rule-lowercase');
    const passwordRuleNumberEmployee = document.getElementById('employee-password-rule-number');
    const passwordRuleSpecialEmployee = document.getElementById('employee-password-rule-special');
    const passwordRuleMatchEmployee = document.getElementById('employee-password-rule-match');

    const editUserModalEmployee = document.getElementById('edit-user-modal-employee');
    const closeEditUserModalBtnEmployee = document.getElementById('close-edit-user-modal-btn-employee');
    const cancelEditUserModalBtnEmployee = document.getElementById('cancel-edit-user-modal-btn-employee');
    const editUserFormEmployee = document.getElementById('edit-user-form-employee');
    const editUserIdEmployee = document.getElementById('employee-edit-user-id');
    const editUserFullnameEmployee = document.getElementById('employee-edit-user-fullname');
    const editUserEmailValueEmployee = document.getElementById('employee-edit-user-email-value');
    const editUserRoleValueEmployee = document.getElementById('employee-edit-user-role-value');
    const editPermissionsGridEmployee = document.getElementById('employee-edit-permissions-grid');
    const editUserActiveEmployee = document.getElementById('employee-edit-user-active');
    const editUserSubtitleEmployee = document.getElementById('employee-edit-user-subtitle');
    const statusBadgeEmployee = document.getElementById('employee-status-badge');
    const deleteUserBtnEmployee = document.getElementById('employee-delete-user-btn');

    const deleteConfirmModalEmployee = document.getElementById('delete-confirm-modal-employee');
    const closeDeleteConfirmBtnEmployee = document.getElementById('close-delete-confirm-btn-employee');
    const cancelDeleteBtnEmployee = document.getElementById('cancel-delete-btn-employee');
    const confirmDeleteBtnEmployee = document.getElementById('confirm-delete-btn-employee');
    const deleteConfirmPasswordEmployee = document.getElementById('employee-delete-confirm-password');
    const deleteUserNameEmployee = document.getElementById('employee-delete-user-name');
    const deleteUserEmailEmployee = document.getElementById('employee-delete-user-email');
    let employeePendingDeleteUser = null;

    function openEmployeeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.remove('hidden');
    }

    function closeEmployeeModal(modalEl) {
        if (!modalEl) return;
        modalEl.classList.add('hidden');
    }

    function setEmployeePasswordRuleState(ruleElement, isMet) {
        if (!ruleElement) return;
        ruleElement.classList.toggle('met', Boolean(isMet));
        ruleElement.classList.toggle('unmet', !isMet);
        const icon = ruleElement.querySelector('i');
        if (!icon) return;
        icon.className = isMet ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }

    function updateEmployeePasswordRequirementStates() {
        const value = String(addUserPasswordEmployee?.value || '');
        const confirmValue = String(addUserPasswordConfirmEmployee?.value || '');

        setEmployeePasswordRuleState(passwordRuleLengthEmployee, value.length >= 8);
        setEmployeePasswordRuleState(passwordRuleUppercaseEmployee, /[A-Z]/.test(value));
        setEmployeePasswordRuleState(passwordRuleLowercaseEmployee, /[a-z]/.test(value));
        setEmployeePasswordRuleState(passwordRuleNumberEmployee, /\d/.test(value));
        setEmployeePasswordRuleState(passwordRuleSpecialEmployee, /[^A-Za-z0-9]/.test(value));
        setEmployeePasswordRuleState(passwordRuleMatchEmployee, value.length > 0 && confirmValue.length > 0 && value === confirmValue);
    }

    function canOpenEmployeeUserEditor() {
        return hasPermission('can_edit_users') || hasPermission('can_manage_permissions') || hasPermission('can_activate_users') || hasPermission('can_delete_users');
    }

    function canModifyEmployeePermissions() {
        return hasPermission('can_edit_users') || hasPermission('can_manage_permissions');
    }

    const EMPLOYEE_EDIT_PERMISSION_CATEGORIES = {
        'User Management': [
            { value: 'can_view_users', label: 'View Users' },
            { value: 'can_add_users', label: 'Add Users' },
            { value: 'can_edit_users', label: 'Edit Users' },
            { value: 'can_delete_users', label: 'Delete Users' },
            { value: 'can_activate_users', label: 'Activate/Deactivate' }
        ],
        'Attendance': [
            { value: 'can_view_own_attendance', label: 'View Own Attendance' },
            { value: 'can_view_all_attendance', label: 'View All Attendance' },
            { value: 'can_edit_attendance', label: 'Edit/Correct Logs' },
            { value: 'can_delete_attendance', label: 'Delete Logs' },
            { value: 'can_export_attendance', label: 'Export Reports' }
        ],
        'Equipment': [
            { value: 'can_view_equipment', label: 'View Inventory' },
            { value: 'can_add_equipment', label: 'Add Equipment' },
            { value: 'can_edit_equipment', label: 'Edit Equipment' },
            { value: 'can_delete_equipment', label: 'Delete Equipment' },
            { value: 'can_assign_equipment', label: 'Assign to Workers' }
        ],
        'Project Files': [
            { value: 'can_view_files', label: 'View Files' },
            { value: 'can_upload_files', label: 'Upload Files' },
            { value: 'can_edit_files', label: 'Edit Metadata' },
            { value: 'can_delete_files', label: 'Delete Files' },
            { value: 'can_download_files', label: 'Download Files' }
        ],
        'Client Inquiries': [
            { value: 'can_view_inquiries', label: 'View Inquiries' },
            { value: 'can_add_inquiries', label: 'Submit Inquiries' },
            { value: 'can_update_inquiries', label: 'Update Status' },
            { value: 'can_delete_inquiries', label: 'Delete Inquiries' },
            { value: 'can_assign_inquiries', label: 'Assign to Team' }
        ],
        'System Admin': [
            { value: 'can_view_health_logs', label: 'View Health Logs' },
            { value: 'can_export_health_logs', label: 'Export Logs (SAM)' },
            { value: 'can_view_audit_trail', label: 'View Audit Trail' },
            { value: 'can_backup_database', label: 'Database Backups' }
        ]
    };

    function configureEmployeePasswordToggle(inputEl, toggleBtn, label) {
        if (!inputEl || !toggleBtn) return;
        toggleBtn.addEventListener('click', () => {
            const isPasswordType = inputEl.type === 'password';
            inputEl.type = isPasswordType ? 'text' : 'password';
            toggleBtn.setAttribute('aria-pressed', isPasswordType ? 'true' : 'false');
            toggleBtn.setAttribute('aria-label', isPasswordType ? `Hide ${label}` : `Show ${label}`);
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = isPasswordType ? 'bi bi-eye-slash' : 'bi bi-eye';
            }
        });
    }

    function clearEmployeeAddUserEmailField() {
        if (!addUserEmailEmployee) return;
        addUserEmailEmployee.value = '';
        addUserEmailEmployee.defaultValue = '';
        setTimeout(() => {
            if (addUserEmailEmployee) addUserEmailEmployee.value = '';
        }, 0);
    }

    function resetEmployeeAddUserPasswordFields() {
        if (addUserPasswordEmployee) addUserPasswordEmployee.type = 'password';
        if (addUserPasswordConfirmEmployee) addUserPasswordConfirmEmployee.type = 'password';

        if (addUserPasswordToggleBtnEmployee) {
            addUserPasswordToggleBtnEmployee.setAttribute('aria-pressed', 'false');
            addUserPasswordToggleBtnEmployee.setAttribute('aria-label', 'Show password');
            const icon = addUserPasswordToggleBtnEmployee.querySelector('i');
            if (icon) icon.className = 'bi bi-eye';
        }

        if (addUserPasswordConfirmToggleBtnEmployee) {
            addUserPasswordConfirmToggleBtnEmployee.setAttribute('aria-pressed', 'false');
            addUserPasswordConfirmToggleBtnEmployee.setAttribute('aria-label', 'Show confirm password');
            const icon = addUserPasswordConfirmToggleBtnEmployee.querySelector('i');
            if (icon) icon.className = 'bi bi-eye';
        }

        updateEmployeePasswordRequirementStates();
    }

    const EMPLOYEE_PERMISSION_PRESETS = {
        'field-worker': {
            description: 'Field Worker (Minimal Access)',
            permissions: ['can_view_own_attendance', 'can_view_equipment', 'can_view_files', 'can_download_files']
        },
        'supervisor': {
            description: 'Field Supervisor (Team Management)',
            permissions: ['can_view_own_attendance', 'can_view_all_attendance', 'can_export_attendance', 'can_view_equipment', 'can_assign_equipment', 'can_view_files', 'can_upload_files', 'can_download_files']
        },
        'hr-admin': {
            description: 'HR Admin (People Operations)',
            permissions: ['can_view_users', 'can_add_users', 'can_edit_users', 'can_activate_users', 'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_export_attendance', 'can_view_equipment', 'can_view_files', 'can_download_files']
        },
        'sales-manager': {
            description: 'Sales Manager (Customer Relations)',
            permissions: ['can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_assign_inquiries', 'can_view_files', 'can_upload_files', 'can_download_files']
        },
        'super-admin': {
            description: 'Super Admin (Full Access)',
            permissions: [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database'
            ]
        }
    };

    function applyEmployeePermissionPreset(presetKey) {
        const checkboxes = addUserModalEmployee?.querySelectorAll('input[name="employee-permission"]');
        const preset = EMPLOYEE_PERMISSION_PRESETS[presetKey];
        if (!checkboxes || !preset) return;

        checkboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });

        preset.permissions.forEach((permission) => {
            const checkbox = addUserModalEmployee.querySelector(`input[name="employee-permission"][value="${permission}"]`);
            if (checkbox) checkbox.checked = true;
        });

        showAlert(`Preset applied: ${preset.description}`);
    }

    function bindEmployeePresetButton(buttonId, presetKey) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.addEventListener('click', () => applyEmployeePermissionPreset(presetKey));
    }

    bindEmployeePresetButton('preset-field-worker-employee', 'field-worker');
    bindEmployeePresetButton('preset-supervisor-employee', 'supervisor');
    bindEmployeePresetButton('preset-hr-admin-employee', 'hr-admin');
    bindEmployeePresetButton('preset-sales-manager-employee', 'sales-manager');
    bindEmployeePresetButton('preset-super-admin-employee', 'super-admin');

    const clearPresetBtnEmployee = document.getElementById('preset-clear-all-employee');
    if (clearPresetBtnEmployee) {
        clearPresetBtnEmployee.addEventListener('click', () => {
            const checkboxes = addUserModalEmployee?.querySelectorAll('input[name="employee-permission"]');
            checkboxes?.forEach((checkbox) => {
                checkbox.checked = false;
            });
        });
    }

    configureEmployeePasswordToggle(addUserPasswordEmployee, addUserPasswordToggleBtnEmployee, 'password');
    configureEmployeePasswordToggle(addUserPasswordConfirmEmployee, addUserPasswordConfirmToggleBtnEmployee, 'confirm password');

    if (addUserPasswordEmployee) {
        addUserPasswordEmployee.addEventListener('input', updateEmployeePasswordRequirementStates);
        addUserPasswordEmployee.addEventListener('change', updateEmployeePasswordRequirementStates);
    }

    if (addUserPasswordConfirmEmployee) {
        addUserPasswordConfirmEmployee.addEventListener('input', updateEmployeePasswordRequirementStates);
        addUserPasswordConfirmEmployee.addEventListener('change', updateEmployeePasswordRequirementStates);
    }

    updateEmployeePasswordRequirementStates();

    function closeEmployeeDeleteModal() {
        employeePendingDeleteUser = null;
        if (deleteConfirmPasswordEmployee) deleteConfirmPasswordEmployee.value = '';
        closeEmployeeModal(deleteConfirmModalEmployee);
    }

    function updateEmployeeStatusBadge(isActive) {
        if (!statusBadgeEmployee) return;
        statusBadgeEmployee.textContent = isActive ? 'Active' : 'Inactive';
        statusBadgeEmployee.style.background = isActive ? '#d1fae5' : '#fee2e2';
        statusBadgeEmployee.style.color = isActive ? '#065f46' : '#991b1b';
    }

    window.viewEmployeeUserPermissions = async function(userId) {
        if (!canOpenEmployeeUserEditor()) {
            showAlert('You do not have permission to edit user accounts.');
            return;
        }

        const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
        const requesterRole = String(currentUserData.role || '').toUpperCase();

        try {
            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                showAlert(`Failed to load user: ${error.error || 'Unknown error'}`);
                return;
            }

            const userData = await response.json();
            const selectedUser = userData.user;
            const isEditingSelf = Number(selectedUser.user_id) === Number(currentUserData.user_id);
            const targetRole = String(selectedUser.role || '').toUpperCase();
            const isEmployeeEditingAdmin = requesterRole !== 'ADMIN' && targetRole === 'ADMIN';

            if (isEmployeeEditingAdmin) {
                showAlert('You cannot edit ADMIN accounts from the employee portal.');
                return;
            }

            if (editUserIdEmployee) editUserIdEmployee.value = String(selectedUser.user_id || '');
            if (editUserSubtitleEmployee) {
                editUserSubtitleEmployee.textContent = isEditingSelf
                    ? `${selectedUser.email || 'User'} (own account: permission changes disabled)`
                    : (selectedUser.email || 'Update user permissions and status');
            }
            if (editUserFullnameEmployee) editUserFullnameEmployee.textContent = selectedUser.full_name || '-';
            if (editUserEmailValueEmployee) editUserEmailValueEmployee.textContent = selectedUser.email || '-';
            if (editUserRoleValueEmployee) editUserRoleValueEmployee.textContent = selectedUser.role || '-';
            if (editUserActiveEmployee) editUserActiveEmployee.checked = Boolean(selectedUser.is_active);
            const editUserAvatarEmployee = document.getElementById('employee-edit-user-avatar');
            const editUserAvatarImageEmployee = document.getElementById('employee-edit-user-avatar-image');
            const hasProfilePhoto = Boolean(selectedUser.profile_photo);
            if (editUserAvatarImageEmployee) {
                editUserAvatarImageEmployee.src = hasProfilePhoto ? selectedUser.profile_photo : '';
            }
            if (editUserAvatarEmployee) {
                editUserAvatarEmployee.classList.toggle('has-image', hasProfilePhoto);
            }
            if (editUserFormEmployee) editUserFormEmployee.dataset.contactNumber = selectedUser.contact_number || '';

            updateEmployeeStatusBadge(Boolean(selectedUser.is_active));

            if (editPermissionsGridEmployee) {
                editPermissionsGridEmployee.innerHTML = '';

                Object.keys(EMPLOYEE_EDIT_PERMISSION_CATEGORIES).forEach((category) => {
                    const categoryDiv = document.createElement('div');
                    categoryDiv.className = 'permission-category';

                    const categoryTitle = document.createElement('h4');
                    categoryTitle.className = 'category-title';
                    categoryTitle.textContent = category;
                    categoryDiv.appendChild(categoryTitle);

                    const checkboxesDiv = document.createElement('div');
                    checkboxesDiv.className = 'permission-checkboxes';

                    EMPLOYEE_EDIT_PERMISSION_CATEGORIES[category].forEach((permission) => {
                        const label = document.createElement('label');
                        label.className = 'checkbox-label';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.name = 'employee-edit-permission';
                        checkbox.value = permission.value;
                        checkbox.checked = Boolean(selectedUser[permission.value]);
                        checkbox.disabled = !canModifyEmployeePermissions() || isEditingSelf;

                        const span = document.createElement('span');
                        span.textContent = permission.label;

                        label.appendChild(checkbox);
                        label.appendChild(span);
                        checkboxesDiv.appendChild(label);
                    });

                    categoryDiv.appendChild(checkboxesDiv);
                    editPermissionsGridEmployee.appendChild(categoryDiv);
                });
            }

            if (editUserActiveEmployee) {
                editUserActiveEmployee.disabled = !hasPermission('can_activate_users');
            }

            const editStatusSection = document.querySelector('#edit-user-form-employee .edit-status-section');
            if (editStatusSection) {
                editStatusSection.classList.toggle('hidden', !hasPermission('can_activate_users'));
            }

            const modalDangerZoneSection = document.querySelector('#edit-user-form-employee .danger-zone-section');
            if (modalDangerZoneSection) {
                modalDangerZoneSection.classList.toggle('hidden', !hasPermission('can_delete_users'));
            }

            if (deleteUserBtnEmployee) {
                deleteUserBtnEmployee.classList.toggle('hidden', !hasPermission('can_delete_users'));
            }

            openEmployeeModal(editUserModalEmployee);
        } catch (error) {
            console.error('Failed to load user for edit modal:', error);
            showAlert('Failed to load user details. Please try again.');
        }
    };

    function renderEmployeeUsersRows(users) {
        if (!employeeUsersTableBody) return;

        if (!users.length) {
            employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#9ca3af;">No users found.</td></tr>';
            return;
        }

        const canOpenEditor = canOpenEmployeeUserEditor();
        const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = Number(currentUserData.user_id);
        const requesterRole = String(currentUserData.role || '').toUpperCase();

        employeeUsersTableBody.innerHTML = users.map(entry => {
            const isSelfAccount = Number(entry.user_id) === currentUserId;
            const isTargetAdmin = String(entry.role || '').toUpperCase() === 'ADMIN';
            const canEditTarget = canOpenEditor && !isSelfAccount && !(requesterRole !== 'ADMIN' && isTargetAdmin);
            const statusLabel = entry.is_active ? 'Active' : 'Inactive';
            const statusClass = entry.is_active ? 'success' : 'warning';
            const createdAt = entry.created_at
                ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '--';
            const hasProfilePhoto = Boolean(entry.profile_photo);
            const userNameCellHtml = `
                <div class="user-name-cell">
                    <span class="user-avatar-chip${hasProfilePhoto ? ' has-image' : ''}">
                        ${hasProfilePhoto
                            ? `<img src="${escapeHtml(entry.profile_photo)}" alt="${escapeHtml(entry.full_name || 'User')} photo">`
                            : '<i class="bi bi-person-fill"></i>'
                        }
                    </span>
                    <span>${escapeHtml(entry.full_name || '--')}</span>
                </div>
            `;

            return `
                <tr>
                    <td>${userNameCellHtml}</td>
                    <td>${escapeHtml(entry.email || '--')}</td>
                    <td>${escapeHtml(entry.contact_number || '--')}</td>
                    <td>${escapeHtml(entry.role || '--')}</td>
                    <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                    <td>${escapeHtml(createdAt)}</td>
                    <td>
                        ${(canEditTarget)
                            ? `<button type="button" class="btn-small view-edit-user-btn" data-user-action="view-edit" data-user-id="${Number(entry.user_id)}"><span><i class="bi bi-pencil"></i></span><span>View/Edit</span></button>`
                            : `<span class="muted-note">${isSelfAccount ? 'Own account' : (requesterRole !== 'ADMIN' && isTargetAdmin ? 'Admin protected' : 'View only')}</span>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    function applyEmployeeUsersFilter() {
        const query = (employeeUsersSearchInput?.value || '').trim().toLowerCase();
        const filtered = employeeUsersCache.filter(entry => {
            const status = entry.is_active ? 'active' : 'inactive';
            const textBlob = `${entry.full_name || ''} ${entry.email || ''} ${entry.role || ''} ${status}`.toLowerCase();
            return !query || textBlob.includes(query);
        });

        renderEmployeeUsersRows(filtered);
    }

    window.loadEmployeeUsersData = async function() {
        if (!employeeUsersTableBody) return;

        if (!hasPermission('can_view_users')) {
            employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view users.</td></tr>';
            return;
        }

        try {
            employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#6b7280;">Loading users...</td></tr>';

            const response = await fetch('http://localhost:5000/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view users.</td></tr>';
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to load users (${response.status})`);
            }

            const data = await response.json();
            employeeUsersCache = data.users || [];
            applyEmployeeUsersFilter();
        } catch (error) {
            console.error('Failed to load users in employee portal:', error);
            employeeUsersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:#ef4444;">Failed to load users.</td></tr>';
        }
    };

    if (employeeUsersSearchInput) {
        employeeUsersSearchInput.addEventListener('input', applyEmployeeUsersFilter);
    }

    if (employeeAddUserBtn) {
        employeeAddUserBtn.addEventListener('click', () => {
            if (!hasPermission('can_add_users')) {
                showAlert('You do not have permission to add users.');
                return;
            }

            if (addUserFormEmployee) addUserFormEmployee.reset();
            if (addUserActiveEmployee) addUserActiveEmployee.checked = true;
            if (addUserRoleEmployee) addUserRoleEmployee.value = '';
            clearEmployeeAddUserEmailField();
            resetEmployeeAddUserPasswordFields();
            openEmployeeModal(addUserModalEmployee);
            addUserFullnameEmployee?.focus();
        });
    }

    if (closeUserModalBtnEmployee) {
        closeUserModalBtnEmployee.addEventListener('click', () => {
            clearEmployeeAddUserEmailField();
            resetEmployeeAddUserPasswordFields();
            closeEmployeeModal(addUserModalEmployee);
        });
    }

    if (cancelUserModalBtnEmployee) {
        cancelUserModalBtnEmployee.addEventListener('click', () => {
            clearEmployeeAddUserEmailField();
            resetEmployeeAddUserPasswordFields();
            closeEmployeeModal(addUserModalEmployee);
        });
    }

    if (addUserModalEmployee) {
        addUserModalEmployee.addEventListener('click', (event) => {
            if (event.target === addUserModalEmployee) {
                clearEmployeeAddUserEmailField();
                resetEmployeeAddUserPasswordFields();
                closeEmployeeModal(addUserModalEmployee);
            }
        });
    }

    if (editUserModalEmployee) {
        editUserModalEmployee.addEventListener('click', (event) => {
            if (event.target === editUserModalEmployee) {
                closeEmployeeModal(editUserModalEmployee);
            }
        });
    }

    if (deleteConfirmModalEmployee) {
        deleteConfirmModalEmployee.addEventListener('click', (event) => {
            if (event.target === deleteConfirmModalEmployee) {
                closeEmployeeDeleteModal();
            }
        });
    }

    if (closeEditUserModalBtnEmployee) {
        closeEditUserModalBtnEmployee.addEventListener('click', () => closeEmployeeModal(editUserModalEmployee));
    }

    if (cancelEditUserModalBtnEmployee) {
        cancelEditUserModalBtnEmployee.addEventListener('click', () => closeEmployeeModal(editUserModalEmployee));
    }

    if (closeDeleteConfirmBtnEmployee) {
        closeDeleteConfirmBtnEmployee.addEventListener('click', closeEmployeeDeleteModal);
    }

    if (cancelDeleteBtnEmployee) {
        cancelDeleteBtnEmployee.addEventListener('click', closeEmployeeDeleteModal);
    }

    if (editUserActiveEmployee) {
        editUserActiveEmployee.addEventListener('change', () => {
            updateEmployeeStatusBadge(Boolean(editUserActiveEmployee.checked));
        });
    }

    if (deleteUserBtnEmployee) {
        deleteUserBtnEmployee.addEventListener('click', () => {
            if (!hasPermission('can_delete_users')) {
                showAlert('You do not have permission to delete users.');
                return;
            }

            const userId = Number(editUserIdEmployee?.value || 0);
            if (!userId) return;
            const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
            const isEditingSelf = userId === Number(currentUserData.user_id);

            employeePendingDeleteUser = {
                userId,
                fullName: String(editUserFullnameEmployee?.textContent || '').trim(),
                email: String(editUserEmailValueEmployee?.textContent || '').trim()
            };

            if (deleteUserNameEmployee) deleteUserNameEmployee.textContent = employeePendingDeleteUser.fullName || '--';
            if (deleteUserEmailEmployee) deleteUserEmailEmployee.textContent = employeePendingDeleteUser.email || '--';
            if (deleteConfirmPasswordEmployee) deleteConfirmPasswordEmployee.value = '';
            openEmployeeModal(deleteConfirmModalEmployee);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        clearEmployeeAddUserEmailField();
        resetEmployeeAddUserPasswordFields();
        closeEmployeeModal(addUserModalEmployee);
        closeEmployeeModal(editUserModalEmployee);
        closeEmployeeDeleteModal();
    });

    if (addUserFormEmployee) {
        addUserFormEmployee.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_add_users')) {
                showAlert('You do not have permission to add users.');
                return;
            }

            const fullName = String(addUserFullnameEmployee?.value || '').trim();
            const email = String(addUserEmailEmployee?.value || '').trim();
            const contact = String(addUserContactEmployee?.value || '').trim();
            const role = String(addUserRoleEmployee?.value || 'EMPLOYEE').trim();
            const password = String(addUserPasswordEmployee?.value || '').trim();
            const passwordConfirm = String(addUserPasswordConfirmEmployee?.value || '').trim();
            const isActive = Boolean(addUserActiveEmployee?.checked);
            const selectedPermissions = {};
            const permissionCheckboxes = addUserModalEmployee?.querySelectorAll('input[name="employee-permission"]') || [];

            permissionCheckboxes.forEach((checkbox) => {
                selectedPermissions[checkbox.value] = checkbox.checked;
            });

            if (!fullName || !email || !password) {
                showAlert('Please complete Full Name, Email, and Password.');
                return;
            }

            if (!role) {
                showAlert('Please select a role.');
                return;
            }

            const namePattern = /^[a-zA-Z\s\-.]{2,100}$/;
            if (!namePattern.test(fullName)) {
                showAlert('Full name must be 2-100 characters and only contain letters, spaces, hyphens, and periods.');
                return;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                showAlert('Please provide a valid email address.');
                return;
            }

            if (contact && !/^\+?[\d\s\-()]+$/.test(contact)) {
                showAlert('Contact number format is invalid.');
                return;
            }

            const hasMinLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /\d/.test(password);
            const hasSpecial = /[^A-Za-z0-9]/.test(password);

            if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
                showAlert('Password must meet all requirements shown in the checklist.');
                return;
            }

            if (password !== passwordConfirm) {
                showAlert('Passwords do not match.');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        full_name: fullName,
                        email,
                        contact_number: contact || null,
                        password,
                        role,
                        is_active: isActive,
                        ...selectedPermissions
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || `Failed to add user (${response.status})`);
                }

                showAlert('User created successfully.');
                if (addUserFormEmployee) addUserFormEmployee.reset();
                clearEmployeeAddUserEmailField();
                resetEmployeeAddUserPasswordFields();
                closeEmployeeModal(addUserModalEmployee);
                await window.loadEmployeeUsersData();
            } catch (error) {
                console.error('Failed to add user:', error);
                showAlert(error.message || 'Failed to add user.');
            }
        });
    }

    if (editUserFormEmployee) {
        editUserFormEmployee.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_edit_users') && !hasPermission('can_manage_permissions') && !hasPermission('can_activate_users')) {
                showAlert('You do not have permission to update this user.');
                return;
            }

            const userId = Number(editUserIdEmployee?.value || 0);
            if (!userId) return;

            const allPermissions = [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database'
            ];

            const permissionCheckboxes = document.querySelectorAll('input[name="employee-edit-permission"]');
            const selectedPermissions = {};
            permissionCheckboxes.forEach((checkbox) => {
                selectedPermissions[checkbox.value] = checkbox.checked;
            });

            const completePermissions = {};
            allPermissions.forEach((permission) => {
                completePermissions[permission] = selectedPermissions[permission] === true;
            });

            try {
                const updateData = {
                    full_name: String(editUserFullnameEmployee?.textContent || '').trim(),
                    email: String(editUserEmailValueEmployee?.textContent || '').trim(),
                    contact_number: String(editUserFormEmployee.dataset.contactNumber || '').trim() || null,
                    role: String(editUserRoleValueEmployee?.textContent || 'EMPLOYEE').trim(),
                    ...((canModifyEmployeePermissions() && !isEditingSelf) ? completePermissions : {})
                };

                if (isEditingSelf && canModifyEmployeePermissions()) {
                    showAlert('Note: You cannot change your own permission settings. Other profile changes can still be saved.');
                }

                if (hasPermission('can_activate_users')) {
                    updateData.is_active = Boolean(editUserActiveEmployee?.checked);
                }

                const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updateData)
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || `Failed to update user (${response.status})`);
                }

                showAlert('User updated successfully.');
                closeEmployeeModal(editUserModalEmployee);
                await window.loadEmployeeUsersData();
            } catch (error) {
                console.error('Failed to update user:', error);
                showAlert(error.message || 'Failed to update user.');
            }
        });
    }

    if (confirmDeleteBtnEmployee) {
        confirmDeleteBtnEmployee.addEventListener('click', async () => {
            if (!hasPermission('can_delete_users')) {
                showAlert('You do not have permission to delete users.');
                closeEmployeeDeleteModal();
                return;
            }

            if (!employeePendingDeleteUser?.userId) {
                closeEmployeeDeleteModal();
                return;
            }

            const password = String(deleteConfirmPasswordEmployee?.value || '').trim();
            if (!password) {
                showAlert('ERROR: Please enter your password to confirm deletion.');
                deleteConfirmPasswordEmployee?.focus();
                return;
            }

            try {
                confirmDeleteBtnEmployee.disabled = true;
                confirmDeleteBtnEmployee.innerHTML = '<span>⏳ Verifying...</span>';

                const verifyResponse = await fetch('http://localhost:5000/api/verify-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ password })
                });

                const verifyData = await verifyResponse.json().catch(() => ({}));
                if (!verifyResponse.ok) {
                    showAlert(`ERROR: Password Verification Failed\n\n${verifyData.error || 'Incorrect password'}`);
                    confirmDeleteBtnEmployee.disabled = false;
                    confirmDeleteBtnEmployee.innerHTML = '<span><i class="bi bi-trash"></i> Delete Permanently</span>';
                    if (deleteConfirmPasswordEmployee) {
                        deleteConfirmPasswordEmployee.value = '';
                        deleteConfirmPasswordEmployee.focus();
                    }
                    return;
                }

                confirmDeleteBtnEmployee.innerHTML = '<span>⏳ Deleting...</span>';

                const response = await fetch(`http://localhost:5000/api/users/${employeePendingDeleteUser.userId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'An error occurred');
                }

                showAlert(`SUCCESS: User Deleted Successfully!\n\n${employeePendingDeleteUser.fullName} has been permanently removed from the system.`);
                closeEmployeeDeleteModal();
                closeEmployeeModal(editUserModalEmployee);
                await window.loadEmployeeUsersData();
            } catch (error) {
                console.error('Delete user failed:', error);
                showAlert(`ERROR: Failed to Delete User\n\n${error.message || 'An error occurred'}`);
            } finally {
                confirmDeleteBtnEmployee.disabled = false;
                confirmDeleteBtnEmployee.innerHTML = '<span><i class="bi bi-trash"></i> Delete Permanently</span>';
            }
        });
    }

    if (employeeUsersTableBody) {
        employeeUsersTableBody.addEventListener('click', async (event) => {
            const actionBtn = event.target.closest('[data-user-action]');
            if (!actionBtn) return;

            const action = actionBtn.getAttribute('data-user-action');
            const userId = Number(actionBtn.getAttribute('data-user-id'));
            if (!userId) return;

            try {
                if (action === 'view-edit') {
                    await window.viewEmployeeUserPermissions(userId);
                }
            } catch (error) {
                console.error('User action failed:', error);
                showAlert(error.message || 'User action failed.');
            }
        });
    }

    if (fileUploadForm) {
        fileUploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_upload_files')) {
                setFileUploadMessage('You do not have permission to upload files.', 'error');
                return;
            }

            const selectedFile = fileUploadInput?.files?.[0];
            if (!selectedFile) {
                setFileUploadMessage('Please choose a file to upload.', 'error');
                return;
            }

            try {
                if (fileUploadBtn) {
                    fileUploadBtn.disabled = true;
                    fileUploadBtn.textContent = 'Uploading...';
                }

                const formData = new FormData();
                formData.append('file', selectedFile);

                const response = await fetch('http://localhost:5000/api/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || `Failed to upload file (${response.status})`);
                }

                if (fileUploadForm) fileUploadForm.reset();
                setFileUploadMessage('File uploaded successfully.', 'success');

                if (hasPermission('can_view_files')) {
                    await window.loadEmployeeFilesData();
                }
            } catch (error) {
                console.error('Failed to upload employee file:', error);
                setFileUploadMessage(error.message || 'File upload failed.', 'error');
            } finally {
                if (fileUploadBtn) {
                    fileUploadBtn.disabled = !hasPermission('can_upload_files');
                    fileUploadBtn.textContent = 'Upload File';
                }
            }
        });
    }

    // --- SCAN EQUIPMENT BUTTON ---
    const scanEquipmentBtn = document.getElementById('scan-equipment-btn');
    if (scanEquipmentBtn) {
        scanEquipmentBtn.addEventListener('click', () => {
            console.log('[Equipment] Opening equipment scanner modal...');
            if (window.openScannerModal) {
                window.openScannerModal();
            } else {
                console.error('[Equipment] ERROR: Scanner modal not initialized');
            }
        });
        console.log('[Equipment] Scan Equipment button listener attached');
    }
    
    // Debug: Log initial state
    console.log('[Employee Dashboard] Employee Dashboard Initialized:', {
        user: user.email,
        role: user.role,
        attendanceTabVisible: !document.getElementById('attendance-tab')?.classList.contains('hidden'),
        buttonsFound: {
            clockIn: !!clockInBtn,
            clockOut: !!clockOutBtn,
            scanEquipment: !!scanEquipmentBtn
        },
        displayElementsFound: {
            todayStatus: !!todayStatus,
            timeIn: !!timeInDisplay,
            timeOut: !!timeOutDisplay
        }
    });
});
