const API_BASE = window.API_BASE || API_BASE + '';
document.addEventListener('DOMContentLoaded', async () => {
    // Handle token injected via URL params from Google OAuth callback
    const _up = new URLSearchParams(window.location.search);
    const _oauthToken = _up.get('token');
    if (_oauthToken) {
        try {
            const _r = await fetch(API_BASE + '/api/me', { headers: { 'Authorization': 'Bearer ' + _oauthToken } });
            if (_r.ok) {
                const _d = await _r.json();
                localStorage.setItem('token', _oauthToken);
                localStorage.setItem('user', JSON.stringify(_d.user || _d));
            }
        } catch (e) { /* ignore, auth check below will redirect */ }
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Admin dashboard bootstrap: authenticate, refresh permissions, then wire UI.
    // --- 1. AUTHENTICATION CHECK ---
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) { window.location.href = 'index.html'; return; }
    let user = JSON.parse(userStr);

    function getCurrentPageName() {
        const path = window.location.pathname || '';
        const name = path.split('/').pop() || 'admin.html';
        return String(name).toLowerCase();
    }

    function redirectToAuthorizedDashboard(userData, reason = 'permission routing') {
        const shouldUseAdminDashboard = hasAdminAccess(userData);
        const targetPage = shouldUseAdminDashboard ? 'admin.html' : 'employee.html';
        const currentPage = getCurrentPageName();

        if (currentPage !== targetPage) {
            console.log(`[Admin Dashboard] Redirecting to ${targetPage} (${reason})`);
            window.location.href = targetPage;
            return true;
        }

        return false;
    }

    function clearSearchAutofill() {
        const inputs = Array.from(document.querySelectorAll('input'));
        const searchInputs = inputs.filter((input) => {
            if (!input || input.type === 'password') return false;
            const id = String(input.id || '').toLowerCase();
            const name = String(input.name || '').toLowerCase();
            const classes = String(input.className || '').toLowerCase();
            const placeholder = String(input.placeholder || '').toLowerCase();
            return id.includes('search') || name.includes('search') || classes.includes('search') || placeholder.includes('search');
        });

        searchInputs.forEach((input) => {
            input.value = '';
            input.defaultValue = '';
        });
    }

    function scheduleSearchAutofillClear() {
        clearSearchAutofill();
        setTimeout(clearSearchAutofill, 0);
        setTimeout(clearSearchAutofill, 180);
    }
    
    // --- 2. FETCH FRESH PERMISSIONS FROM SERVER ---
    async function refreshUserPermissions() {
        // Pull latest permissions so UI reflects server truth, not stale local cache.
        console.log('[Admin Dashboard] Fetching fresh permissions from server...');
        try {
            const response = await fetch(API_BASE + '/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('[Admin Dashboard] API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                const freshUser = data.user;
                
                console.log('[Admin Dashboard] Fresh user data received:', {
                    email: freshUser.email,
                    role: freshUser.role,
                    hasAdminPerms: hasAdminAccess(freshUser),
                    permissionCount: Object.keys(freshUser).filter(k => k.startsWith('can_') && freshUser[k]).length
                });
                
                // Update localStorage with fresh permissions
                localStorage.setItem('user', JSON.stringify(freshUser));
                user = freshUser;
                enforcePermissionDrivenUi();

                if (redirectToAuthorizedDashboard(freshUser, 'fresh permission fetch')) {
                    return freshUser;
                }
                
                console.log('[Admin Dashboard] Permissions refreshed successfully');
                return freshUser;
            } else {
                console.error('[Admin Dashboard] API returned error:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('[Admin Dashboard] Permission refresh failed:', error);
            // Continue with cached permissions if refresh fails
        }
        console.log('[Admin Dashboard] Using cached permissions (fallback)');
        return user;
    }
    
    // Refresh permissions and wait for result
    user = await refreshUserPermissions();
    if (!user) return;
    if (redirectToAuthorizedDashboard(user, 'post-refresh check')) return;
    
    // --- 3. RENDER DYNAMIC NAVIGATION WITH FRESH PERMISSIONS ---
    const sidebarNav = document.getElementById('sidebar-nav');

    // On admin page, always render admin feature set.
    renderDynamicNavigation(user, sidebarNav, true);

    scheduleSearchAutofillClear();
    window.addEventListener('pageshow', scheduleSearchAutofillClear);
    
    // --- 4. PERIODIC PERMISSION REFRESH (Check every 30 seconds for changes) ---
    setInterval(async () => {
        // Keep tabs and actions in sync if an admin updates permissions in real time.
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch(API_BASE + '/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                const freshUser = data.user;

                if (redirectToAuthorizedDashboard(freshUser, 'background permission sync')) {
                    return;
                }
                
                // Compare permission counts to detect changes
                const oldPermCount = Object.keys(user).filter(k => k.startsWith('can_') && user[k]).length;
                const newPermCount = Object.keys(freshUser).filter(k => k.startsWith('can_') && freshUser[k]).length;
                
                if (oldPermCount !== newPermCount) {
                    console.log(`[Admin Dashboard] Permissions changed: ${oldPermCount} â†’ ${newPermCount}`);
                    
                    // Update localStorage
                    localStorage.setItem('user', JSON.stringify(freshUser));
                    user = freshUser;
                    enforcePermissionDrivenUi();
                    
                    // Re-render navigation
                    renderDynamicNavigation(freshUser, sidebarNav, true);
                    
                    // Show notification
                    const message = newPermCount > oldPermCount 
                        ? `New permissions granted! ${newPermCount - oldPermCount} new feature(s) available.`
                        : `WARNING: Permissions updated. ${oldPermCount - newPermCount} feature(s) removed.`;
                    
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
            console.warn('[Admin Dashboard] Background permission check failed:', error);
        }
    }, 30000); // Check every 30 seconds
    
    document.getElementById('welcome-message').textContent = `Welcome, ${user.full_name}`;

    // Cache frequently used DOM nodes once to avoid repeated lookups later.
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserRole = document.getElementById('sidebar-user-role');
    const sidebarProfileAvatar = document.getElementById('sidebar-profile-avatar');
    const sidebarProfileAvatarImage = document.getElementById('sidebar-profile-avatar-image');
    const sidebarProfileMenuBtn = document.getElementById('sidebar-profile-menu-btn');
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
    const topbarNotificationRoot = document.getElementById('topbar-notification-root');
    const topbarNotificationBtn = document.getElementById('topbar-notification-btn');
    const topbarNotificationBadge = document.getElementById('topbar-notification-badge');
    const topbarNotificationMenu = document.getElementById('topbar-notification-menu');
    const topbarNotificationList = document.getElementById('topbar-notification-list');
    const topbarNotificationRefreshBtn = document.getElementById('topbar-notification-refresh-btn');
    const topbarThemeRoot = document.getElementById('topbar-theme-root');
    const topbarThemeBtn = document.getElementById('topbar-theme-btn');
    const topbarThemeBtnIcon = document.getElementById('topbar-theme-btn-icon');
    const topbarThemeOptions = document.querySelectorAll('.topbar-theme-option');
    let notificationFeedCache = [];
    let profilePhotoDraftDataUrl = null;

    // Local storage key for admin theme preference.
    const THEME_STORAGE_KEY = 'cicj_admin_theme_mode';

    function normalizeThemeMode(mode) {
        const value = String(mode || '').toLowerCase().trim();
        if (value === 'light' || value === 'dark' || value === 'neutral') return value;
        return 'neutral';
    }

    function applyThemeMode(mode, persist = true) {
        // Apply one of: neutral, light, dark.
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

    function hasPermission(permissionKey) {
        const role = String(user?.role || '').toUpperCase().trim();
        if (role === 'ADMIN') return true;
        return Boolean(user?.[permissionKey]);
    }

    function canOpenUserEditor() {
        return hasPermission('can_edit_users') || hasPermission('can_manage_permissions') || hasPermission('can_activate_users') || hasPermission('can_delete_users');
    }

    function setSectionVisibility(elementId, isVisible) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.classList.toggle('hidden', !isVisible);
    }

    function setTabPermissionNotice(tabId, shouldShow, message) {
        // Show or hide a clear note when user can open a tab but cannot use its data.
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
            notice.className = 'table-container permission-notice-shell';
            tab.appendChild(notice);
        }

        notice.innerHTML = `
            <div class="permission-notice-card">
                <div class="permission-notice-icon"><i class="bi bi-shield-lock"></i></div>
                <div class="permission-notice-title">Limited access for this section</div>
                <div class="permission-notice-message">${message}</div>
            </div>
        `;
    }

    function enforcePermissionDrivenUi() {
        // Central UI gatekeeper: enable, disable, or hide controls based on can_* flags.
        const canViewUsers = hasPermission('can_view_users');
        const canAddUsers = hasPermission('can_add_users');
        const canDeleteUsers = hasPermission('can_delete_users');
        const canAddEquipment = hasPermission('can_add_equipment');
        const canViewEquipment = hasPermission('can_view_equipment');
        const canUploadFiles = hasPermission('can_upload_files');
        const canViewFiles = hasPermission('can_view_files');
        const canViewInquiries = hasPermission('can_view_inquiries');
        const canAddInquiries = hasPermission('can_add_inquiries');
        const canViewAttendance = hasPermission('can_view_all_attendance');
        const canEditAttendance = hasPermission('can_edit_attendance');
        const canBackupDatabase = hasPermission('can_backup_database');
        const canExportHealthLogs = hasPermission('can_export_health_logs');
        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');
        const canManagePermissions = hasPermission('can_manage_permissions');
        const canViewReports = hasPermission('can_view_reports');
        const canViewArchives = canViewAuditTrail;

        const openUserModalBtn = document.getElementById('open-add-user-modal-btn');
        const userSearchInput = document.getElementById('user-search-input');
        const deleteUserBtn = document.getElementById('delete-user-btn');
        const dangerZoneSection = document.querySelector('#edit-user-form .danger-zone-section');
        const openEquipmentModalBtn = document.getElementById('open-modal-btn');
        const equipmentSearchInput = document.getElementById('equipment-search-input');
        const syncCloudinaryBtn = document.getElementById('sync-cloudinary-btn');
        const openFileUploadBtn = document.getElementById('open-file-upload-btn');
        const filesSearchInput = document.getElementById('files-search-input');
        const filesStorageFilter = document.getElementById('files-storage-filter');
        const inquirySearchInput = document.getElementById('inquiry-search-input');
        const inquiryStatusFilter = document.getElementById('inquiry-status-filter');
        const inquirySubmitBtn = document.getElementById('admin-inquiry-submit-btn');
        const inquiryNameInput = document.getElementById('admin-inquiry-client-name');
        const inquiryEmailInput = document.getElementById('admin-inquiry-client-email');
        const inquirySubjectInput = document.getElementById('admin-inquiry-subject');
        const inquiryMessageInput = document.getElementById('admin-inquiry-message');
        const addSiteBtn = document.getElementById('add-site-btn');
        const triggerBackupBtn = document.getElementById('trigger-backup-btn');
        const exportLogsBtn = document.getElementById('export-logs-btn');
        const reportButtons = document.querySelectorAll('.report-download-btn');

        if (openUserModalBtn) {
            openUserModalBtn.classList.toggle('hidden', !canAddUsers);
        }

        if (userSearchInput) {
            userSearchInput.disabled = !canViewUsers;
        }

        if (deleteUserBtn) {
            deleteUserBtn.classList.toggle('hidden', !canDeleteUsers);
        }

        if (dangerZoneSection) {
            dangerZoneSection.classList.toggle('hidden', !canDeleteUsers);
        }

        if (openEquipmentModalBtn) {
            openEquipmentModalBtn.classList.toggle('hidden', !canAddEquipment);
        }

        if (equipmentSearchInput) {
            equipmentSearchInput.disabled = !canViewEquipment;
        }

        if (openFileUploadBtn) {
            openFileUploadBtn.classList.toggle('hidden', !canUploadFiles);
        }

        if (syncCloudinaryBtn) {
            syncCloudinaryBtn.classList.toggle('hidden', !canUploadFiles);
            syncCloudinaryBtn.disabled = !canUploadFiles;
        }

        if (filesSearchInput) {
            filesSearchInput.disabled = !canViewFiles;
        }

        if (filesStorageFilter) {
            filesStorageFilter.disabled = !canViewFiles;
        }

        if (inquirySearchInput) {
            inquirySearchInput.disabled = !canViewInquiries;
        }

        if (inquiryStatusFilter) {
            inquiryStatusFilter.disabled = !canViewInquiries;
        }

        if (inquirySubmitBtn) {
            inquirySubmitBtn.disabled = !canAddInquiries;
        }

        if (inquiryNameInput) inquiryNameInput.disabled = !canAddInquiries;
        if (inquiryEmailInput) inquiryEmailInput.disabled = !canAddInquiries;
        if (inquirySubjectInput) inquirySubjectInput.disabled = !canAddInquiries;
        if (inquiryMessageInput) inquiryMessageInput.disabled = !canAddInquiries;

        if (addSiteBtn) {
            addSiteBtn.classList.toggle('hidden', !canEditAttendance);
        }

        if (triggerBackupBtn) {
            triggerBackupBtn.classList.toggle('hidden', !canBackupDatabase);
        }

        if (exportLogsBtn) {
            exportLogsBtn.classList.toggle('hidden', !canExportHealthLogs);
        }

        const reportPermissionMap = {
            attendance: hasPermission('can_export_attendance_report'),
            'attendance-sites': canViewAttendance || canEditAttendance,
            'equipment-usage': canViewEquipment,
            'equipment-inventory': canViewEquipment,
            'inquiry-resolution': canViewInquiries,
            'inquiries-detail': canViewInquiries,
            files: canViewFiles,
            'users-directory': canViewUsers,
            'user-access': canManagePermissions,
            'health-siem': canViewHealthLogs || canExportHealthLogs,
            'health-backups': canViewHealthLogs || canBackupDatabase || canExportHealthLogs,
            'health-audit': canViewAuditTrail || canViewHealthLogs,
            'health-activity': canViewAuditTrail || canViewHealthLogs,
            archives: canViewArchives
        };

        reportButtons.forEach(btn => {
            const reportType = btn.getAttribute('data-report-type');
            const allowed = Boolean(reportPermissionMap[reportType]);
            btn.classList.toggle('hidden', !allowed);
        });

        document.querySelectorAll('.report-row[data-report-type]').forEach(row => {
            const reportType = row.getAttribute('data-report-type');
            const allowed = Boolean(reportPermissionMap[reportType]);
            row.classList.toggle('hidden', !allowed);
        });

        // Section-level gating: hide entire subsection blocks if permission is missing.
        setSectionVisibility('user-management-shell', canViewUsers);

        setSectionVisibility('equipment-management-shell', canViewEquipment);

        setSectionVisibility('inquiry-stats-shell', canViewInquiries);
        setSectionVisibility('inquiry-create-shell', canAddInquiries);
        setSectionVisibility('inquiry-management-shell', canViewInquiries);

        setSectionVisibility('files-stats-shell', canViewFiles);
        setSectionVisibility('files-management-shell', canViewFiles);

        setSectionVisibility('attendance-stats-shell', canViewAttendance);
        setSectionVisibility('attendance-logs-shell', canViewAttendance);
        setSectionVisibility('attendance-sites-shell', canViewAttendance || canEditAttendance);

        syncInquirySubtabsWithPermissions();
        syncAttendanceSubtabsWithPermissions();

        setSectionVisibility('health-overview-shell', canViewHealthLogs);
        setSectionVisibility('health-siem-shell', canViewHealthLogs);
        setSectionVisibility('health-backup-shell', canViewHealthLogs || canBackupDatabase);
        setSectionVisibility('health-activity-shell', canViewAuditTrail);
        setSectionVisibility('archives-shell', canViewArchives);

        const anyReportVisible = canViewReports && Object.values(reportPermissionMap).some(Boolean);
        setSectionVisibility('reports-shell', canViewReports);

        setTabPermissionNotice('user-tab', !canViewUsers, 'You do not have permission to view user records.');
        setTabPermissionNotice('equipment-tab', !canViewEquipment, 'You do not have permission to view equipment records.');
        setTabPermissionNotice('inquiry-tab', !canViewInquiries && !canAddInquiries, 'You do not have permission to view or submit inquiry data.');
        setTabPermissionNotice('portfolio-tab', !canViewFiles && !canUploadFiles, 'You do not have permission to view or upload project files.');
        setTabPermissionNotice('attendance-tab', !canViewAttendance && !canEditAttendance, 'You do not have permission to access attendance sections.');
        setTabPermissionNotice('health-tab', !canViewHealthLogs && !canViewAuditTrail && !canBackupDatabase && !canExportHealthLogs, 'You do not have permission to access system health sections.');
        setTabPermissionNotice('reports-tab', !canViewReports, 'You do not have permission to access reports.');
        setTabPermissionNotice('archives-tab', !canViewArchives, 'You do not have permission to view immutable archive records.');
    }

    applyThemeMode(localStorage.getItem(THEME_STORAGE_KEY) || 'neutral', false);
    enforcePermissionDrivenUi();

    function formatRoleLabel(role) {
        if (!role) return '-';
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
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

    function getCurrentUserProfilePhoto() {
        const value = typeof user?.profile_photo === 'string' ? user.profile_photo.trim() : '';
        return value || '';
    }

    function setProfilePhotoStatus(message, tone = 'neutral') {
        if (!profilePhotoStatus) return;
        profilePhotoStatus.textContent = message;
        profilePhotoStatus.classList.remove('success', 'error');
        if (tone === 'success') {
            profilePhotoStatus.classList.add('success');
        }
        if (tone === 'error') {
            profilePhotoStatus.classList.add('error');
        }
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
        const roleLabel = formatRoleLabel(user.role);
        if (sidebarUserName) {
            sidebarUserName.textContent = user.full_name || 'Admin User';
        }
        if (sidebarUserRole) {
            sidebarUserRole.textContent = roleLabel;
        }
        if (profileModalName) {
            profileModalName.textContent = user.full_name || '-';
        }
        if (profileModalRole) {
            profileModalRole.textContent = roleLabel;
        }
        if (profileModalEmail) {
            profileModalEmail.textContent = user.email || '-';
        }
        if (profileModalContact) {
            profileModalContact.textContent = user.contact_number || '-';
        }
        if (profileModalCreatedAt) {
            profileModalCreatedAt.textContent = formatDateTime(user.created_at);
        }
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

    function renderProfileActivity(notifications) {
        if (!profileActivityList) return;
        const items = Array.isArray(notifications) ? notifications : [];

        if (items.length === 0) {
            profileActivityList.innerHTML = '<div class="profile-activity-empty">No recent activity available.</div>';
            return;
        }

        profileActivityList.innerHTML = items.slice(0, 20).map(item => {
            const parsed = parseNotificationText(item.description || '');
            const severity = getNotificationSeverity(item);
            return `
                <article class="profile-activity-item">
                    <div class="profile-activity-item-top">
                        <strong>${escapeHtml(parsed.title)}</strong>
                        <span class="profile-activity-severity ${severity}">${severity.toUpperCase()}</span>
                    </div>
                    <p class="profile-activity-message">${escapeHtml(parsed.message)}</p>
                    <span class="profile-activity-time">${escapeHtml(formatRelativeNotificationTime(item.timestamp))}</span>
                </article>
            `;
        }).join('');
    }

    async function loadProfileAttendanceRecords() {
        if (!profileRecordsList) return;
        profileRecordsList.innerHTML = '<div class="profile-records-empty">Loading records...</div>';

        try {
            const response = await fetch(API_BASE + '/api/attendance/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                profileRecordsList.innerHTML = '<div class="profile-records-empty">You do not currently have access to view attendance records.</div>';
                if (profileRecordsTotal) profileRecordsTotal.textContent = '0';
                if (profileRecordsCheckins) profileRecordsCheckins.textContent = '0';
                if (profileRecordsCheckouts) profileRecordsCheckouts.textContent = '0';
                return;
            }

            if (!response.ok) {
                throw new Error(`Attendance request failed (${response.status})`);
            }

            const data = await response.json();
            renderAttendanceRecords(data.attendance || []);
        } catch (error) {
            console.warn('Profile attendance load failed:', error.message);
            profileRecordsList.innerHTML = '<div class="profile-records-empty">Unable to load attendance records right now.</div>';
            if (profileRecordsTotal) profileRecordsTotal.textContent = '0';
            if (profileRecordsCheckins) profileRecordsCheckins.textContent = '0';
            if (profileRecordsCheckouts) profileRecordsCheckouts.textContent = '0';
        }
    }

    async function loadProfileActivityFeed() {
        if (!profileActivityList) return;

        if (!Array.isArray(notificationFeedCache) || notificationFeedCache.length === 0) {
            await loadNotificationFeed();
        }

        renderProfileActivity(notificationFeedCache);
    }

    async function openProfileModal() {
        if (!profileModal) return;
        renderProfileUserInfo();
        loadProfilePhotoFromUser();
        setProfileModalTab('profile');
        setProfilePhotoStatus('Your profile photo is synced across the system.');
        profileModal.classList.add('active');
        await Promise.all([loadProfileAttendanceRecords(), loadProfileActivityFeed()]);
    }

    renderProfileUserInfo();

    loadProfilePhotoFromUser();

    function closeProfileModal() {
        if (!profileModal) return;
        profileModal.classList.remove('active');
    }

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
                const response = await fetch(API_BASE + '/api/me/profile-photo', {
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
                loadUsers();
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

            let shouldRemove = true;
            if (typeof showConfirm === 'function') {
                shouldRemove = await showConfirm('Are you sure you want to remove your profile photo?', 'Remove Profile Photo');
            } else {
                shouldRemove = window.confirm('Are you sure you want to remove your profile photo?');
            }

            if (!shouldRemove) {
                return;
            }

            try {
                profilePhotoRemoveBtn.disabled = true;
                const response = await fetch(API_BASE + '/api/me/profile-photo', {
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
                loadUsers();
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

    function formatRelativeNotificationTime(value) {
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

    function getNotificationSeverity(notification = {}) {
        const description = String(notification.description || '');
        const match = description.match(/\[NOTIFICATION\]\[([A-Z]+)\]/i);
        const severity = String(match?.[1] || notification.severity || 'LOW').toLowerCase();
        if (severity === 'high' || severity === 'medium') return severity;
        return 'low';
    }

    function parseNotificationText(description = '') {
        const cleaned = String(description)
            .replace(/^\[NOTIFICATION\]\[[A-Z]+\]\s*/i, '')
            .replace(/\s+\|\s*context=.*$/i, '')
            .trim();

        const separatorIndex = cleaned.indexOf(' | ');
        if (separatorIndex === -1) {
            return { title: 'System Notification', message: cleaned || 'A new system notification was received.' };
        }

        const title = cleaned.slice(0, separatorIndex).trim() || 'System Notification';
        const message = cleaned.slice(separatorIndex + 3).trim() || 'A new system notification was received.';
        return { title, message };
    }

    function updateNotificationBadge(unreadCount) {
        if (!topbarNotificationBadge) return;

        const count = Number(unreadCount || 0);
        if (!Number.isFinite(count) || count <= 0) {
            topbarNotificationBadge.classList.add('hidden');
            topbarNotificationBadge.textContent = '0';
            return;
        }

        topbarNotificationBadge.classList.remove('hidden');
        topbarNotificationBadge.textContent = count > 99 ? '99+' : String(count);
    }

    function formatNotificationTargetLabel(targetTab) {
        if (targetTab === 'inquiry-tab') return 'Inquiries';
        if (targetTab === 'portfolio-tab') return 'Project Files';
        if (targetTab === 'equipment-tab') return 'Equipment';
        if (targetTab === 'health-tab') return 'System Health';
        if (targetTab === 'archives-tab') return 'Archives';
        if (targetTab === 'reports-tab') return 'Reports';
        if (targetTab === 'user-tab') return 'Users';
        return 'Dashboard';
    }

    function renderNotificationFeed(notifications) {
        if (!topbarNotificationList) return;

        if (!notifications || notifications.length === 0) {
            topbarNotificationList.innerHTML = '<div class="topbar-notification-empty">No notifications yet.</div>';
            return;
        }

        topbarNotificationList.innerHTML = notifications.slice(0, 20).map(item => {
            const severity = getNotificationSeverity(item);
            const parsed = parseNotificationText(item.description || '');
            const eventType = String(item.event_type || '').trim();
            const targetTab = getTabTargetForNotification(eventType);
            const targetLabel = formatNotificationTargetLabel(targetTab);

            return `
                <article class="topbar-notification-item" data-event-type="${escapeHtml(eventType)}">
                    <div class="topbar-notification-item-head">
                        <h4 class="topbar-notification-title">${escapeHtml(parsed.title)}</h4>
                        <span class="topbar-notification-severity ${severity}">${severity.toUpperCase()}</span>
                    </div>
                    <p class="topbar-notification-message">${escapeHtml(parsed.message)}</p>
                    <p class="topbar-notification-target">Open: ${escapeHtml(targetLabel)}</p>
                    <p class="topbar-notification-time">${escapeHtml(formatRelativeNotificationTime(item.timestamp))}</p>
                </article>
            `;
        }).join('');
    }

    async function loadNotificationFeed() {
        try {
            const apiBase = typeof window.API_BASE === 'string' ? window.API_BASE.replace(/\/$/, '') : '';
            const notificationUrl = apiBase ? `${apiBase}/api/notifications?limit=20` : '/api/notifications?limit=20';
            const response = await fetch(notificationUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error(`Notification request failed (${response.status})`);
            }

            const data = await response.json();
            notificationFeedCache = data.notifications || [];
            renderNotificationFeed(notificationFeedCache);
            updateNotificationBadge(data.unread_count || 0);
        } catch (error) {
            console.warn('Notification feed load failed:', error.message);
            if (topbarNotificationList) {
                topbarNotificationList.innerHTML = '<div class="topbar-notification-empty">Unable to load notifications.</div>';
            }
            updateNotificationBadge(0);
        }
    }

    if (topbarNotificationBtn && topbarNotificationRoot) {
        topbarNotificationBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (topbarThemeRoot) {
                topbarThemeRoot.classList.remove('open');
            }
            const isOpen = topbarNotificationRoot.classList.toggle('open');
            topbarNotificationBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                await loadNotificationFeed();
            }
        });
    }

    if (topbarThemeBtn && topbarThemeRoot) {
        topbarThemeBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (topbarNotificationRoot) {
                topbarNotificationRoot.classList.remove('open');
            }
            const isOpen = topbarThemeRoot.classList.toggle('open');
            topbarThemeBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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

    if (topbarNotificationRefreshBtn) {
        topbarNotificationRefreshBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            await loadNotificationFeed();
        });
    }

    if (topbarNotificationMenu) {
        topbarNotificationMenu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    function setActiveInquirySubtab(targetShellId) {
        if (!targetShellId) return;

        const buttons = document.querySelectorAll('.inquiry-subtab-btn');
        const shells = document.querySelectorAll('.inquiry-subtab-shell');
        if (buttons.length === 0 || shells.length === 0) return;

        buttons.forEach((button) => {
            const isActive = button.dataset.inquiryShell === targetShellId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        shells.forEach((shell) => {
            const shouldShow = shell.id === targetShellId;
            shell.classList.toggle('inquiry-subtab-hidden', !shouldShow);
            shell.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        });
    }

    function syncInquirySubtabsWithPermissions() {
        const buttons = Array.from(document.querySelectorAll('.inquiry-subtab-btn'));
        if (buttons.length === 0) return;

        const visibleButtons = [];
        buttons.forEach((button) => {
            const shellId = button.dataset.inquiryShell || '';
            const shell = document.getElementById(shellId);
            const allowed = !!shell && !shell.classList.contains('hidden');
            button.classList.toggle('hidden', !allowed);
            if (allowed) visibleButtons.push(button);
        });

        if (visibleButtons.length === 0) return;

        const activeVisible = visibleButtons.find((button) => button.classList.contains('active'));
        const target = activeVisible || visibleButtons[0];
        setActiveInquirySubtab(target.dataset.inquiryShell || '');
    }

    function setActiveAttendanceSubtab(targetShellId) {
        if (!targetShellId) return;

        const buttons = document.querySelectorAll('.attendance-subtab-btn');
        const shells = document.querySelectorAll('.attendance-subtab-shell');
        if (buttons.length === 0 || shells.length === 0) return;

        buttons.forEach((button) => {
            const isActive = button.dataset.attendanceShell === targetShellId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        shells.forEach((shell) => {
            const shouldShow = shell.id === targetShellId;
            shell.classList.toggle('attendance-subtab-hidden', !shouldShow);
            shell.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        });
    }

    function syncAttendanceSubtabsWithPermissions() {
        const buttons = Array.from(document.querySelectorAll('.attendance-subtab-btn'));
        if (buttons.length === 0) return;

        const visibleButtons = [];
        buttons.forEach((button) => {
            const shellId = button.dataset.attendanceShell || '';
            const shell = document.getElementById(shellId);
            const allowed = !!shell && !shell.classList.contains('hidden');
            button.classList.toggle('hidden', !allowed);
            if (allowed) visibleButtons.push(button);
        });

        if (visibleButtons.length === 0) return;

        const activeVisible = visibleButtons.find((button) => button.classList.contains('active'));
        const target = activeVisible || visibleButtons[0];
        setActiveAttendanceSubtab(target.dataset.attendanceShell || '');
    }

    const GENERIC_TABLE_PAGINATION_MIN_ROWS = 8;
    const genericPaginationState = new WeakMap();
    const genericPaginationExcludedBodyIds = new Set([
        'siem-alerts-body',
        'backup-table-body',
        'health-table-body',
        'activity-table-body'
    ]);
    let isApplyingGenericPagination = false;
    let genericPaginationResizeTimer = null;

    function getGenericPaginationState(tbody) {
        if (!genericPaginationState.has(tbody)) {
            genericPaginationState.set(tbody, {
                sourceRowsHtml: [],
                currentPage: 1,
                observer: null,
                suppressObserver: false,
                refreshTimer: null
            });
        }
        return genericPaginationState.get(tbody);
    }

    function getGenericPaginationKey(tbody) {
        if (tbody.dataset.paginationKey) return tbody.dataset.paginationKey;
        const key = tbody.id || `table-body-${Math.random().toString(36).slice(2, 10)}`;
        tbody.dataset.paginationKey = key;
        return key;
    }

    function getGenericTableScrollShell(tbody) {
        return tbody.closest('.table-scroll-shell, .inquiry-table-scroll, .health-logs-scroll');
    }

    function ensureGenericPaginationContainer(tbody) {
        const key = getGenericPaginationKey(tbody);
        const existing = document.querySelector(`.generic-table-pagination[data-pagination-for="${key}"]`);
        if (existing) return existing;

        const shell = getGenericTableScrollShell(tbody);
        const table = tbody.closest('table');
        const container = document.createElement('div');
        container.className = 'table-pagination hidden generic-table-pagination';
        container.dataset.paginationFor = key;

        if (shell && shell.parentNode) {
            shell.parentNode.insertBefore(container, shell.nextSibling);
        } else if (table && table.parentNode) {
            table.parentNode.insertBefore(container, table.nextSibling);
        }

        return container;
    }

    function stripHtml(html) {
        return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function isPlaceholderRows(rowsHtml) {
        if (!Array.isArray(rowsHtml) || rowsHtml.length !== 1) return false;
        const rowHtml = String(rowsHtml[0] || '');
        const text = stripHtml(rowHtml).toLowerCase();
        if (!/colspan\s*=/.test(rowHtml)) return false;
        return /(loading|open the tab|no\s+\w+|failed|permission|unable|connection error|not found)/i.test(text);
    }

    function toggleShellScrollable(shell, shouldScroll) {
        if (!shell) return;
        shell.classList.toggle('is-scrollable', !!shouldScroll);
    }

    function lockGenericTableColumnWidths(table) {
        if (!table) return;

        const thead = table.querySelector('thead');
        if (!thead) return;

        const headerCells = Array.from(thead.querySelectorAll('th'));
        if (!headerCells.length) return;

        const columnCount = headerCells.length;
        const tableWidth = Math.round(table.getBoundingClientRect().width);
        const lockedWidth = Number(table.dataset.lockedTableWidth || 0);
        const lockedColumns = Number(table.dataset.lockedColumnCount || 0);

        if (table.dataset.lockedColumns === 'true' && lockedWidth === tableWidth && lockedColumns === columnCount) {
            return;
        }

        headerCells.forEach((cell) => {
            cell.style.width = '';
        });

        // Measure current rendered widths, then lock them.
        table.style.tableLayout = 'auto';
        const widths = headerCells.map((cell) => Math.max(44, Math.round(cell.getBoundingClientRect().width)));
        widths.forEach((width, index) => {
            headerCells[index].style.width = `${width}px`;
        });

        table.style.tableLayout = 'fixed';
        table.dataset.lockedColumns = 'true';
        table.dataset.lockedTableWidth = String(tableWidth);
        table.dataset.lockedColumnCount = String(columnCount);
    }

    function renderGenericRows(tbody, rowsHtml) {
        const state = getGenericPaginationState(tbody);
        state.suppressObserver = true;
        isApplyingGenericPagination = true;
        tbody.innerHTML = rowsHtml.join('');
        isApplyingGenericPagination = false;
        setTimeout(() => {
            state.suppressObserver = false;
        }, 0);
    }

    function getPaginationTokens(totalPages, currentPage) {
        const tokens = [];
        if (totalPages <= 7) {
            for (let page = 1; page <= totalPages; page += 1) tokens.push(page);
            return tokens;
        }

        tokens.push(1);
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        if (start > 2) tokens.push('ellipsis-start');
        for (let page = start; page <= end; page += 1) tokens.push(page);
        if (end < totalPages - 1) tokens.push('ellipsis-end');
        tokens.push(totalPages);
        return tokens;
    }

    function shouldSkipGenericPagination(tbody) {
        if (!tbody) return true;
        if (genericPaginationExcludedBodyIds.has(tbody.id)) return true;
        if (tbody.closest('#health-tab')) return true;
        return false;
    }

    function refreshGenericPaginationForBody(tbody, options = {}) {
        if (!tbody || shouldSkipGenericPagination(tbody)) return;

        const { captureFromDom = false } = options;
        const hostTab = tbody.closest('.tab-section');
        const isHiddenTab = !!hostTab && hostTab.classList.contains('hidden');
        const hiddenSubtabShell = tbody.closest('.health-subtab-hidden, .inquiry-subtab-hidden, .attendance-subtab-hidden');
        const state = getGenericPaginationState(tbody);

        if (captureFromDom) {
            const domRows = Array.from(tbody.querySelectorAll('tr'));
            state.sourceRowsHtml = domRows.map((row) => row.outerHTML);
            state.currentPage = 1;
        } else if (!state.sourceRowsHtml.length) {
            const domRows = Array.from(tbody.querySelectorAll('tr'));
            state.sourceRowsHtml = domRows.map((row) => row.outerHTML);
        }

        if (isHiddenTab || hiddenSubtabShell) return;

        const sourceRows = Array.isArray(state.sourceRowsHtml) ? state.sourceRowsHtml : [];
        const shell = getGenericTableScrollShell(tbody);
        const paginationContainer = ensureGenericPaginationContainer(tbody);

        if (!sourceRows.length || isPlaceholderRows(sourceRows)) {
            toggleShellScrollable(shell, false);
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
                paginationContainer.classList.add('hidden');
            }
            if (sourceRows.length) {
                renderGenericRows(tbody, sourceRows);
            }
            return;
        }

        const table = tbody.closest('table');
        const tableTop = (shell || table || tbody).getBoundingClientRect().top;
        const headerHeight = table?.querySelector('thead')?.getBoundingClientRect().height || 42;
        const sampleRows = Array.from(tbody.querySelectorAll('tr')).slice(0, 6);
        const measuredHeight = sampleRows.length
            ? sampleRows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) / sampleRows.length
            : 46;
        const rowHeight = measuredHeight > 0 ? measuredHeight : 46;
        const viewportRoom = Math.max(220, window.innerHeight - tableTop - 120);
        const estimatedHeight = headerHeight + sourceRows.length * rowHeight;
        const shouldPaginate = estimatedHeight > viewportRoom + 12;

        if (!shouldPaginate) {
            renderGenericRows(tbody, sourceRows);
            toggleShellScrollable(shell, false);
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
                paginationContainer.classList.add('hidden');
            }
            return;
        }

        const pageSize = Math.max(
            GENERIC_TABLE_PAGINATION_MIN_ROWS,
            Math.floor((viewportRoom - headerHeight) / Math.max(rowHeight, 32))
        );
        const totalItems = sourceRows.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(Math.max(state.currentPage || 1, 1), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        const pageRows = sourceRows.slice(startIndex, endIndex);
        state.currentPage = currentPage;

        lockGenericTableColumnWidths(table);
        renderGenericRows(tbody, pageRows);
        toggleShellScrollable(shell, true);

        if (!paginationContainer) return;
        const prevDisabled = currentPage <= 1 ? 'disabled' : '';
        const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
        const tokens = getPaginationTokens(totalPages, currentPage);
        const numberButtons = tokens.map((token) => {
            if (typeof token !== 'number') {
                return '<span class="table-page-ellipsis">...</span>';
            }
            const activeClass = token === currentPage ? 'active-page' : '';
            return `<button type="button" class="table-page-btn table-page-num ${activeClass}" data-generic-page="${token}" aria-label="Go to page ${token}">${token}</button>`;
        }).join('');

        paginationContainer.classList.remove('hidden');
        paginationContainer.innerHTML = `
            <div class="table-pagination-meta">Showing ${startIndex + 1}-${endIndex} of ${totalItems}</div>
            <div class="table-pagination-controls">
                <button type="button" class="table-page-btn" data-generic-action="prev" ${prevDisabled}>Previous</button>
                <div class="table-page-numbers">${numberButtons}</div>
                <span class="table-page-indicator">Page ${currentPage} of ${totalPages}</span>
                <button type="button" class="table-page-btn" data-generic-action="next" ${nextDisabled}>Next</button>
            </div>
        `;

        paginationContainer.querySelectorAll('[data-generic-action]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-generic-action');
                if (action === 'prev' && state.currentPage > 1) {
                    state.currentPage -= 1;
                    refreshGenericPaginationForBody(tbody, { captureFromDom: false });
                }
                if (action === 'next' && state.currentPage < totalPages) {
                    state.currentPage += 1;
                    refreshGenericPaginationForBody(tbody, { captureFromDom: false });
                }
            });
        });

        paginationContainer.querySelectorAll('[data-generic-page]').forEach((button) => {
            button.addEventListener('click', () => {
                const page = Number(button.getAttribute('data-generic-page') || 1);
                if (!Number.isFinite(page) || page === state.currentPage) return;
                state.currentPage = page;
                refreshGenericPaginationForBody(tbody, { captureFromDom: false });
            });
        });
    }

    function refreshAllTablePaginations(options = {}) {
        const { captureFromDom = false, onlyVisible = false } = options;
        const bodies = document.querySelectorAll('.tab-section .data-table tbody');
        bodies.forEach((tbody) => {
            if (onlyVisible) {
                const hostTab = tbody.closest('.tab-section');
                if (hostTab?.classList.contains('hidden')) return;

                const hiddenSubtabShell = tbody.closest('.health-subtab-hidden, .inquiry-subtab-hidden, .attendance-subtab-hidden');
                if (hiddenSubtabShell) return;
            }
            refreshGenericPaginationForBody(tbody, { captureFromDom });
        });
    }

    function initializeGenericTablePaginationObservers() {
        const bodies = document.querySelectorAll('.tab-section .data-table tbody');
        bodies.forEach((tbody) => {
            if (shouldSkipGenericPagination(tbody)) return;
            const state = getGenericPaginationState(tbody);
            if (state.observer) return;

            state.observer = new MutationObserver(() => {
                if (isApplyingGenericPagination) return;
                if (state.suppressObserver) return;

                if (state.refreshTimer) {
                    clearTimeout(state.refreshTimer);
                }
                state.refreshTimer = setTimeout(() => {
                    refreshGenericPaginationForBody(tbody, { captureFromDom: true });
                }, 60);
            });
            state.observer.observe(tbody, { childList: true });
        });
    }

    function activateTabByTarget(targetId) {
        if (!targetId) return;

        const navLink = sidebarNav.querySelector(`a[data-target="${targetId}"]`);
        const targetTab = document.getElementById(targetId);
        if (!navLink || !targetTab) return;

        const navLinks = sidebarNav.querySelectorAll('a');
        const tabSections = document.querySelectorAll('.tab-section');

        navLinks.forEach(l => l.classList.remove('active'));
        tabSections.forEach(tab => tab.classList.add('hidden'));

        navLink.classList.add('active');
        targetTab.classList.remove('hidden');

        if (pageTitle) {
            pageTitle.textContent = navLink.textContent.trim();
        }

        if (targetId === 'user-tab') {
            loadUsers();
        } else if (targetId === 'equipment-tab') {
            loadEquipmentTable();
        } else if (targetId === 'portfolio-tab') {
            resetProjectFilesSearch();
            loadProjectFiles();
        } else if (targetId === 'inquiry-tab') {
            syncInquirySubtabsWithPermissions();
            loadInquiries();
        } else if (targetId === 'attendance-tab') {
            syncAttendanceSubtabsWithPermissions();
        } else if (targetId === 'reports-tab') {
            initializeReportDateRange();
        } else if (targetId === 'health-tab') {
            const healthSearch = document.getElementById('health-search-input');
            if (healthSearch) {
                healthSearch.value = '';
                healthSearch.defaultValue = '';
            }
            loadSystemHealthTab();
        } else if (targetId === 'archives-tab') {
            loadArchivesTab();
        }

        setTimeout(() => {
            refreshAllTablePaginations({ captureFromDom: false, onlyVisible: true });
        }, 0);
    }

    function getTabTargetForNotification(eventType) {
        const type = String(eventType || '').toUpperCase();
        if (!type) return null;

        if (type.includes('INQUIRY')) return 'inquiry-tab';
        if (type.includes('FILE')) return 'portfolio-tab';
        if (type.includes('INVENTORY') || type.includes('EQUIPMENT')) return 'equipment-tab';
        if (type.includes('ARCHIVE')) return 'archives-tab';
        if (type.includes('PASSWORD') || type.includes('SECURITY')) return 'health-tab';

        return 'health-tab';
    }

    if (topbarNotificationList) {
        topbarNotificationList.addEventListener('click', (event) => {
            const item = event.target.closest('.topbar-notification-item');
            if (!item) return;

            const eventType = item.getAttribute('data-event-type') || '';
            const targetTab = getTabTargetForNotification(eventType);
            if (!targetTab) return;

            activateTabByTarget(targetTab);

            if (topbarNotificationRoot) {
                topbarNotificationRoot.classList.remove('open');
            }
            if (topbarNotificationBtn) {
                topbarNotificationBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.addEventListener('click', (event) => {
        if (topbarNotificationRoot && !topbarNotificationRoot.contains(event.target)) {
            topbarNotificationRoot.classList.remove('open');
            if (topbarNotificationBtn) {
                topbarNotificationBtn.setAttribute('aria-expanded', 'false');
            }
        }

        if (topbarThemeRoot && !topbarThemeRoot.contains(event.target)) {
            topbarThemeRoot.classList.remove('open');
            if (topbarThemeBtn) {
                topbarThemeBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Logout functionality with confirmation modal
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

    // --- 3. TAB SWITCHING LOGIC (using event delegation for dynamic links) ---
    const pageTitle = document.getElementById('page-title');
    const overviewSearchInput = document.getElementById('overview-search-input');
    const overviewPeriodSelect = document.getElementById('overview-period-select');
    const overviewRefreshBtn = document.getElementById('overview-refresh-btn');
    if (overviewSearchInput) {
        overviewSearchInput.value = '';
        overviewSearchInput.defaultValue = '';
        setTimeout(() => { overviewSearchInput.value = ''; }, 0);
    }
    if (overviewPeriodSelect) {
        overviewPeriodSelect.addEventListener('change', () => loadOverview());
    }
    if (overviewRefreshBtn) {
        overviewRefreshBtn.addEventListener('click', () => {
            const icon = overviewRefreshBtn.querySelector('i');
            if (icon) icon.style.animation = 'overviewSpin 0.6s linear';
            loadOverview().finally(() => {
                setTimeout(() => { if (icon) icon.style.animation = ''; }, 680);
            });
        });
    }
    setupOverviewSearch();

    const overviewTab = document.getElementById('overview-tab');
    if (overviewTab) {
        const clickableCards = overviewTab.querySelectorAll('[data-overview-target]');
        clickableCards.forEach(card => {
            card.classList.add('overview-clickable');
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
        });

        const handleOverviewShortcut = (targetId) => {
            if (!targetId) return;
            const navLink = sidebarNav.querySelector(`a[data-target="${targetId}"]`);
            if (!navLink) {
                if (typeof showAlert === 'function') {
                    showAlert('You do not have access to that section.');
                }
                return;
            }
            activateTabByTarget(targetId);
        };

        overviewTab.addEventListener('click', (event) => {
            if (event.target.closest('button, a, input, select, textarea, label')) return;
            const card = event.target.closest('[data-overview-target]');
            if (!card) return;
            handleOverviewShortcut(card.getAttribute('data-overview-target'));
        });

        overviewTab.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('[data-overview-target]');
            if (!card) return;
            event.preventDefault();
            handleOverviewShortcut(card.getAttribute('data-overview-target'));
        });
    }

    sidebarNav.addEventListener('click', (e) => {
        e.preventDefault();
        const link = e.target.closest('a');
        if (!link) return;
        const targetId = link.getAttribute('data-target');
        activateTabByTarget(targetId);
    });
    
    // Set initial page title
    const firstLink = sidebarNav.querySelector('a');
    if (firstLink) {
        pageTitle.textContent = firstLink.textContent.trim();
    }


    // --- 3. MODAL LOGIC & FORM CAPTURE (Add/Edit Equipment) ---
    const modal = document.getElementById('equipment-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtns = document.querySelectorAll('#close-modal-btn, #cancel-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            if (!hasPermission('can_add_equipment')) {
                showAlert('You do not have permission to add equipment.');
                return;
            }

            // Reset form for adding new equipment
            document.getElementById('add-equipment-form').reset();
            document.getElementById('equip-id').value = '';
            document.getElementById('equip-qty').disabled = false; // Enable quantity for new equipment
            document.getElementById('equipment-modal-title').textContent = 'Add New Equipment';
            document.getElementById('equipment-danger-actions').classList.add('hidden');
            modal.classList.remove('hidden');
        });
    }
    
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
    
    // Close equipment modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Form Capture Logic - Now fully functional!
    const addEquipmentForm = document.getElementById('add-equipment-form');
    addEquipmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const equipmentId = document.getElementById('equip-id').value;
        if (equipmentId && !hasPermission('can_edit_equipment')) {
            showAlert('You do not have permission to edit equipment.');
            return;
        }
        if (!equipmentId && !hasPermission('can_add_equipment')) {
            showAlert('You do not have permission to add equipment.');
            return;
        }

        const equipmentName = document.getElementById('equip-name').value;
        const equipmentQty = parseInt(document.getElementById('equip-qty').value, 10);
        const equipmentCondition = document.getElementById('equip-condition').value;
        const equipmentStatus = document.getElementById('equip-status').value;
        const equipmentLocation = document.getElementById('equip-location').value;

        const equipmentData = {
            name: equipmentName,
            quantity: equipmentQty,
            condition: equipmentCondition,
            status: equipmentStatus,
            current_location: equipmentLocation || null
        };

        try {
            const url = equipmentId 
                ? `${API_BASE}/api/equipment/${equipmentId}`
                : API_BASE + '/api/equipment';
            
            const method = equipmentId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(equipmentData)
            });
            
            if (response.ok) {
                modal.classList.add('hidden');
                addEquipmentForm.reset();
                document.getElementById('equip-qty').disabled = false; // Re-enable for next time
                loadEquipmentTable(); // Reload the table
                
                const data = await response.json();
                if (equipmentId) {
                    showNotification('Equipment updated successfully!', 'success');
                } else {
                    // Show count of items created
                    const count = data.count || 1;
                    showNotification(`Successfully added ${count} equipment item(s) with individual QR codes!`, 'success');
                }
            } else {
                const errorData = await response.json();
                showNotification(errorData.error || 'Failed to save equipment', 'error');
            }
        } catch (error) {
            console.error("Equipment save error:", error);
            showNotification('Network error. Please try again.', 'error');
        }
    });

    // Delete Equipment
    const deleteEquipmentBtn = document.getElementById('delete-equipment-btn');
    deleteEquipmentBtn.addEventListener('click', async () => {
        if (!hasPermission('can_delete_equipment')) {
            showAlert('You do not have permission to delete equipment.');
            return;
        }

        const equipmentId = document.getElementById('equip-id').value;
        if (!equipmentId) return;

        if (!await showConfirm('Archive this equipment record? It will be removed from active inventory and preserved in Archives.', 'Archive Equipment')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/equipment/${equipmentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                modal.classList.add('hidden');
                addEquipmentForm.reset();
                loadEquipmentTable();
                showNotification('Equipment deleted successfully!', 'success');
            } else {
                const errorData = await response.json();
                showNotification(errorData.error || 'Failed to delete equipment', 'error');
            }
        } catch (error) {
            console.error("Equipment delete error:", error);
            showNotification('Network error. Please try again.', 'error');
        }
    });

    // --- 4. ADD NEW HIRE MODAL & PERMISSIONS MATRIX ---
    const userModal = document.getElementById('add-user-modal');
    const openUserModalBtn = document.getElementById('open-add-user-modal-btn');
    const closeUserModalBtns = document.querySelectorAll('#close-user-modal-btn, #cancel-user-modal-btn');
    const addUserForm = document.getElementById('add-user-form');
    const addUserEmailInput = document.getElementById('user-email');
    const addUserNameInput = document.getElementById('user-fullname');
    const addUserPasswordInput = document.getElementById('user-password');
    const addUserPasswordConfirmInput = document.getElementById('user-password-confirm');
    const addUserPasswordToggleBtn = document.getElementById('user-password-toggle');
    const addUserPasswordConfirmToggleBtn = document.getElementById('user-password-confirm-toggle');

    const passwordRuleLength = document.getElementById('password-rule-length');
    const passwordRuleUppercase = document.getElementById('password-rule-uppercase');
    const passwordRuleLowercase = document.getElementById('password-rule-lowercase');
    const passwordRuleNumber = document.getElementById('password-rule-number');
    const passwordRuleSpecial = document.getElementById('password-rule-special');
    const passwordRuleMatch = document.getElementById('password-rule-match');

    function setPasswordRuleState(ruleElement, isMet) {
        if (!ruleElement) return;
        ruleElement.classList.toggle('met', Boolean(isMet));
        ruleElement.classList.toggle('unmet', !isMet);
        const icon = ruleElement.querySelector('i');
        if (!icon) return;
        icon.className = isMet ? 'bi bi-check-circle-fill' : 'bi bi-circle';
    }

    function updatePasswordRequirementStates() {
        const value = String(addUserPasswordInput?.value || '');
        const confirmValue = String(addUserPasswordConfirmInput?.value || '');
        setPasswordRuleState(passwordRuleLength, value.length >= 8);
        setPasswordRuleState(passwordRuleUppercase, /[A-Z]/.test(value));
        setPasswordRuleState(passwordRuleLowercase, /[a-z]/.test(value));
        setPasswordRuleState(passwordRuleNumber, /\d/.test(value));
        setPasswordRuleState(passwordRuleSpecial, /[^A-Za-z0-9]/.test(value));
        setPasswordRuleState(passwordRuleMatch, value.length > 0 && confirmValue.length > 0 && value === confirmValue);
    }

    function updateEditPasswordRequirementStates() {
        const value = String(editUserPasswordInput?.value || '');
        const confirmValue = String(editUserPasswordConfirmInput?.value || '');
        setPasswordRuleState(editPasswordRuleLength, value.length >= 8);
        setPasswordRuleState(editPasswordRuleUppercase, /[A-Z]/.test(value));
        setPasswordRuleState(editPasswordRuleLowercase, /[a-z]/.test(value));
        setPasswordRuleState(editPasswordRuleNumber, /\d/.test(value));
        setPasswordRuleState(editPasswordRuleSpecial, /[^A-Za-z0-9]/.test(value));
        setPasswordRuleState(editPasswordRuleMatch, value.length > 0 && confirmValue.length > 0 && value === confirmValue);
    }

    function configurePasswordToggle(inputEl, toggleBtn, defaultLabel) {
        if (!inputEl || !toggleBtn) return;
        toggleBtn.addEventListener('click', () => {
            const isPasswordType = inputEl.type === 'password';
            inputEl.type = isPasswordType ? 'text' : 'password';
            toggleBtn.setAttribute('aria-pressed', isPasswordType ? 'true' : 'false');
            toggleBtn.setAttribute('aria-label', isPasswordType ? `Hide ${defaultLabel}` : `Show ${defaultLabel}`);
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = isPasswordType ? 'bi bi-eye-slash' : 'bi bi-eye';
            }
        });
    }

    function clearAddUserEmailField() {
        if (!addUserEmailInput) return;
        addUserEmailInput.value = '';
        addUserEmailInput.defaultValue = '';
        // Some browsers may attempt to restore autofill asynchronously.
        setTimeout(() => {
            addUserEmailInput.value = '';
        }, 0);
    }

    function resetAddUserPasswordFields() {
        if (addUserPasswordInput) addUserPasswordInput.type = 'password';
        if (addUserPasswordConfirmInput) addUserPasswordConfirmInput.type = 'password';

        if (addUserPasswordToggleBtn) {
            addUserPasswordToggleBtn.setAttribute('aria-pressed', 'false');
            addUserPasswordToggleBtn.setAttribute('aria-label', 'Show password');
            const icon = addUserPasswordToggleBtn.querySelector('i');
            if (icon) icon.className = 'bi bi-eye';
        }

        if (addUserPasswordConfirmToggleBtn) {
            addUserPasswordConfirmToggleBtn.setAttribute('aria-pressed', 'false');
            addUserPasswordConfirmToggleBtn.setAttribute('aria-label', 'Show confirm password');
            const icon = addUserPasswordConfirmToggleBtn.querySelector('i');
            if (icon) icon.className = 'bi bi-eye';
        }

        updatePasswordRequirementStates();
    }

    configurePasswordToggle(addUserPasswordInput, addUserPasswordToggleBtn, 'password');
    configurePasswordToggle(addUserPasswordConfirmInput, addUserPasswordConfirmToggleBtn, 'confirm password');

    if (addUserPasswordInput) {
        addUserPasswordInput.addEventListener('input', updatePasswordRequirementStates);
        addUserPasswordInput.addEventListener('change', updatePasswordRequirementStates);
    }
    if (addUserPasswordConfirmInput) {
        addUserPasswordConfirmInput.addEventListener('input', updatePasswordRequirementStates);
        addUserPasswordConfirmInput.addEventListener('change', updatePasswordRequirementStates);
    }

    updatePasswordRequirementStates();

    openUserModalBtn.addEventListener('click', () => {
        if (!hasPermission('can_add_users')) {
            showAlert('You do not have permission to add users.');
            return;
        }

        if (addUserForm) {
            addUserForm.reset();
        }
        clearAddUserEmailField();
        resetAddUserPasswordFields();
        if (addUserNameInput) {
            addUserNameInput.focus();
        }
        userModal.classList.remove('hidden');
    });

    closeUserModalBtns.forEach(btn => btn.addEventListener('click', () => {
        clearAddUserEmailField();
        resetAddUserPasswordFields();
        userModal.classList.add('hidden');
    }));
    
    // Close modal when clicking outside the modal content
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) {
            clearAddUserEmailField();
            resetAddUserPasswordFields();
            userModal.classList.add('hidden');
        }
    });
    
    // Close any open modal with Escape key (global handler)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
            if (!userModal.classList.contains('hidden')) {
                clearAddUserEmailField();
                resetAddUserPasswordFields();
                userModal.classList.add('hidden');
            }
        }
    });

    // Permission Preset Buttons (Predefined Permission Templates)
    const PERMISSION_PRESETS = {
        'field-worker': {
            description: 'Field Worker (Minimal Access)',
            permissions: [
                'can_view_own_attendance',
                'can_view_equipment',
                'can_view_files', 'can_download_files',
                'can_view_reports', 'can_export_attendance_report'
            ]
        },
        'supervisor': {
            description: 'Field Supervisor (Team Management)',
            permissions: [
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_download_files',
                'can_view_inquiries',
                'can_view_reports', 'can_export_attendance_report', 'can_export_equipment_report'
            ]
        },
        'hr-admin': {
            description: 'HR Admin (People Operations)',
            permissions: [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance',
                'can_view_equipment',
                'can_view_files', 'can_download_files',
                'can_view_audit_trail',
                'can_view_reports', 'can_export_attendance_report', 'can_export_equipment_report'
            ]
        },
        'sales-manager': {
            description: 'Sales Manager (Customer Relations)',
            permissions: [
                'can_view_own_attendance',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_download_files',
                'can_view_reports', 'can_export_inquiry_report', 'can_export_files_report'
            ]
        },
        'super-admin': {
            description: 'Select All (Full Access)',
            permissions: [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database',
                'can_view_reports', 'can_export_attendance_report', 'can_export_equipment_report', 'can_export_inquiry_report', 'can_export_files_report'
            ]
        }
    };

    // Apply Permission Presets
    function applyPermissionPreset(presetKey) {
        const checkboxes = document.querySelectorAll('input[name="permission"]');
        const preset = PERMISSION_PRESETS[presetKey];
        
        if (!preset) return;

        // Clear all checkboxes first
        checkboxes.forEach(cb => cb.checked = false);

        // Check only the preset permissions
        preset.permissions.forEach(perm => {
            const checkbox = document.querySelector(`input[value="${perm}"]`);
            if (checkbox) checkbox.checked = true;
        });

        console.log(`Applied preset: ${preset.description}`);
        showAlert(`Preset applied: ${preset.description}\nCheck the permission matrix!`);
    }

    // Preset Button Event Listeners
    document.getElementById('preset-field-worker').addEventListener('click', () => applyPermissionPreset('field-worker'));
    document.getElementById('preset-supervisor').addEventListener('click', () => applyPermissionPreset('supervisor'));
    document.getElementById('preset-hr-admin').addEventListener('click', () => applyPermissionPreset('hr-admin'));
    document.getElementById('preset-sales-manager').addEventListener('click', () => applyPermissionPreset('sales-manager'));
    document.getElementById('preset-super-admin').addEventListener('click', () => applyPermissionPreset('super-admin'));
    
    document.getElementById('preset-clear-all').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('input[name="permission"]');
        checkboxes.forEach(cb => cb.checked = false);
        console.log('All permissions cleared');
    });

    // Add User Form Submission with Permissions Matrix
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const fullName = document.getElementById('user-fullname').value;
        const email = document.getElementById('user-email').value;
        const contactNumber = document.getElementById('user-contact').value;
        const password = document.getElementById('user-password').value;
        const passwordConfirm = document.getElementById('user-password-confirm').value;

        // ===== FRONTEND INPUT VALIDATION (Security Hardening) =====
        
        // Validate full name
        const nameValidation = window.ValidationUtils.validateName(fullName, 'Full name');
        if (!nameValidation.valid) {
            showAlert('ERROR: ' + nameValidation.message);
            return;
        }

        // Validate email
        const emailValidation = window.ValidationUtils.validateEmail(email);
        if (!emailValidation.valid) {
            showAlert('ERROR: ' + emailValidation.message);
            return;
        }

        // Validate password
        const passwordValidation = window.ValidationUtils.validatePassword(password);
        if (!passwordValidation.valid) {
            showAlert('ERROR: ' + passwordValidation.message);
            return;
        }

        // Password confirmation
        if (password !== passwordConfirm) {
            showAlert('ERROR: Passwords do not match!');
            return;
        }

        // Validate phone number (optional field)
        if (contactNumber) {
            const phoneValidation = window.ValidationUtils.validatePhone(contactNumber);
            if (!phoneValidation.valid) {
                showAlert('ERROR: ' + phoneValidation.message);
                return;
            }
        }

        // Capture Basic User Data
        const userData = {
            full_name: fullName,
            email: email,
            contact_number: contactNumber || null,
            role: document.getElementById('user-role').value,
            password: password,
            is_active: document.getElementById('user-active').checked
        };

        // Capture ALL Selected Permissions
        const selectedPermissions = {};
        const allPermissionCheckboxes = document.querySelectorAll('input[name="permission"]');
        
        allPermissionCheckboxes.forEach(checkbox => {
            selectedPermissions[checkbox.value] = checkbox.checked;
        });

        // Merge permissions into userData
        const completeUserData = {
            ...userData,
            ...selectedPermissions
        };

        console.log('Complete User Data with Permissions:', completeUserData);
        console.log('Total Permissions Set:', Object.keys(selectedPermissions).filter(k => selectedPermissions[k]).length);

        // ===== BACKEND INTEGRATION ACTIVE =====
        try {
            // Get JWT token from localStorage (set during login)
            const token = localStorage.getItem('token');
            
            if (!token) {
                showAlert('Authentication required. Please login as admin first.');
                window.location.href = 'index.html';
                return;
            }

            const response = await fetch(API_BASE + '/register', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(completeUserData)
            });
            
            if (response.ok) {
                const result = await response.json();
                showAlert(`SUCCESS: User Created Successfully!\n\nName: ${userData.full_name}\nEmail: ${userData.email}\nPermissions Granted: ${result.user.permissions_granted} / 30\n\nThe new user can now login with their credentials.`);
                userModal.classList.add('hidden');
                addUserForm.reset();
                
                // Reload user table if on User Management tab
                loadUsers(); // Will implement this function
            } else {
                const error = await response.json();
                showAlert(`ERROR: Failed to create user:\n\n${error.error}\n\n${error.hint || ''}`);
            }
        } catch (error) {
            console.error('Network error:', error);
            showAlert('ERROR: Network error. Please refresh the page and try again. If the problem persists, contact your system administrator.');
        }
    });

    // --- 5. LOAD USERS FUNCTION (Fetch and Display) ---
    const userSearchInput = document.getElementById('user-search-input');
    let usersCache = [];

    function renderUserTableRows(users) {
        const userTableBody = document.getElementById('user-table-body');
        if (!userTableBody) return;

        userTableBody.innerHTML = '';

        if (!users || users.length === 0) {
            userTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                        <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-search"></i></div>
                        <div style="font-size: 16px; font-weight: 600;">No users found</div>
                        <div style="font-size: 14px; margin-top: 8px;">Try a different search keyword.</div>
                    </td>
                </tr>
            `;
            return;
        }

        users.forEach(user => {
            const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
            const isSelfAccount = Number(user.user_id) === Number(currentUserData.user_id);
            const createdDate = new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            const hasProfilePhoto = Boolean(user.profile_photo);
            const userNameCellHtml = `
                <div class="user-name-cell">
                    <span class="user-avatar-chip${hasProfilePhoto ? ' has-image' : ''}">
                        ${hasProfilePhoto
                            ? `<img src="${escapeHtml(user.profile_photo)}" alt="${escapeHtml(user.full_name || 'User')} photo">`
                            : '<i class="bi bi-person-fill"></i>'
                        }
                    </span>
                    <span>${escapeHtml(user.full_name || '-')}</span>
                </div>
            `;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${userNameCellHtml}</td>
                <td>${user.email}</td>
                <td>${user.contact_number || 'N/A'}</td>
                <td><span class="badge ${user.role === 'ADMIN' ? '' : 'warning'}">${user.role}</span></td>
                <td><span class="badge ${user.is_active ? 'success' : 'warning'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style="font-size: 13px; color: #6b7280;">${createdDate}</td>
                <td>
                    ${isSelfAccount
                        ? '<span class="muted-note">Own account</span>'
                        : `<button class="btn-small view-edit-user-btn" data-user-id="${user.user_id}"><span><i class="bi bi-pencil"></i></span><span>View/Edit</span></button>`
                    }
                </td>
            `;
            userTableBody.appendChild(row);
        });
    }

    function applyUserFilters() {
        const query = (userSearchInput?.value || '').trim().toLowerCase();
        const filtered = usersCache.filter(item => {
            const status = item.is_active ? 'active' : 'inactive';
            const textBlob = `${item.full_name || ''} ${item.email || ''} ${item.contact_number || ''} ${item.role || ''} ${status}`.toLowerCase();
            return !query || textBlob.includes(query);
        });

        renderUserTableRows(filtered);
    }

    async function loadUsers() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            if (!hasPermission('can_view_users')) {
                const userTableBody = document.getElementById('user-table-body');
                if (userTableBody) {
                    userTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                                <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-shield-lock-fill"></i></div>
                                <div style="font-size: 16px; font-weight: 600;">Access denied</div>
                                <div style="font-size: 14px; margin-top: 8px;">You do not have permission to view users.</div>
                            </td>
                        </tr>
                    `;
                }
                return;
            }

            const response = await fetch(API_BASE + '/api/users', {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const userTableBody = document.getElementById('user-table-body');
                
                if (!userTableBody) return;

                usersCache = data.users || [];

                if (usersCache.length === 0) {
                    userTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                                <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-inbox"></i></div>
                                <div style="font-size: 16px; font-weight: 600;">No users found</div>
                                <div style="font-size: 14px; margin-top: 8px;">Click "+ Add New Hire" to create your first user</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                applyUserFilters();
                
                console.log(`[Admin Dashboard] Loaded ${usersCache.length} users from database`);
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to load users:', error);
                const userTableBody = document.getElementById('user-table-body');
                if (userTableBody) {
                    userTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                                <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-exclamation-triangle-fill"></i></div>
                                <div style="font-size: 16px; font-weight: 600;">Failed to load users</div>
                                <div style="font-size: 14px; margin-top: 8px;">${error.error || 'You may not have permission to view users'}</div>
                            </td>
                        </tr>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading users:', error);
            const userTableBody = document.getElementById('user-table-body');
            if (userTableBody) {
                userTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                            <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-x-circle-fill"></i></div>
                            <div style="font-size: 16px; font-weight: 600;">Connection Error</div>
                            <div style="font-size: 14px; margin-top: 8px;">Make sure the server is running on port 5000</div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // --- LOAD EQUIPMENT TABLE FUNCTION ---
    const equipmentSearchInput = document.getElementById('equipment-search-input');
    let equipmentCache = [];

    async function fetchAdminAssignableEquipmentUsers() {
        const response = await fetch(API_BASE + '/api/equipment/assignable-users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to load assignable users (${response.status})`);
        }

        return Array.isArray(data.users) ? data.users : [];
    }

    function openAdminAssignPickerModal(item, users) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modern-modal modal-compact admin-assign-modal" role="dialog" aria-modal="true" aria-label="Assign equipment">
                <div class="modal-header">
                    <div class="modal-header-content">
                        <div class="modal-icon"><i class="bi bi-pencil-square"></i></div>
                        <div>
                            <h2 class="modal-title">Assign Equipment</h2>
                            <p class="modal-subtitle">Assign ${escapeHtml(item?.name || 'equipment')} (${escapeHtml(item?.qr_number || 'N/A')})</p>
                        </div>
                    </div>
                    <span class="close-modal" id="assign-picker-close-btn">&times;</span>
                </div>
                <div class="form-scroll-body admin-assign-body">
                    <label class="modern-label" for="assign-user-search-input">Search User</label>
                    <input type="text" id="assign-user-search-input" class="modern-input" placeholder="Type name or email..." autocomplete="off">
                    <div class="assign-user-search-list" id="assign-user-search-list"></div>
                </div>
                <div class="modal-actions admin-assign-actions">
                    <button type="button" class="btn-secondary" id="assign-picker-cancel-btn">Cancel</button>
                    <button type="button" class="btn-primary" id="assign-picker-confirm-btn" disabled>Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#assign-picker-close-btn');
        const cancelBtn = modal.querySelector('#assign-picker-cancel-btn');
        const confirmBtn = modal.querySelector('#assign-picker-confirm-btn');
        const searchInput = modal.querySelector('#assign-user-search-input');
        const listEl = modal.querySelector('#assign-user-search-list');
        let selectedUser = null;

        const closeModal = (result = null) => {
            modal.remove();
            return result;
        };

        return new Promise((resolve) => {
            const handleClose = (result = null) => resolve(closeModal(result));

            const setSelectedUser = (userItem) => {
                selectedUser = userItem || null;
                if (confirmBtn) {
                    confirmBtn.disabled = !selectedUser;
                }

                if (listEl) {
                    listEl.querySelectorAll('.assign-user-option').forEach((option) => {
                        const userId = Number(option.getAttribute('data-user-id') || 0);
                        option.classList.toggle('selected', Boolean(selectedUser) && userId === Number(selectedUser.user_id));
                    });
                }
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
                    <button type="button" class="assign-user-option" data-user-id="${Number(u.user_id || 0)}" data-user-name="${escapeHtml(u.full_name || '')}" data-user-email="${escapeHtml(u.email || '')}">
                        <span class="assign-user-name">${escapeHtml(u.full_name || 'Unknown')}</span>
                        <span class="assign-user-email">${escapeHtml(u.email || '--')}</span>
                    </button>
                `).join('');
            };

            if (closeBtn) closeBtn.addEventListener('click', () => handleClose(null));
            if (cancelBtn) cancelBtn.addEventListener('click', () => handleClose(null));
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    if (!selectedUser) return;
                    handleClose(selectedUser);
                });
            }

            modal.addEventListener('click', (event) => {
                if (event.target === modal) handleClose(null);
            });

            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    renderList(searchInput.value);
                });
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

    async function assignEquipmentFromAdminRow(item) {
        if (!hasPermission('can_assign_equipment')) {
            showAlert('You do not have permission to assign equipment.');
            return;
        }

        if (!item || !item.equipment_id) {
            showAlert('Equipment record not found. Please refresh and try again.');
            return;
        }

        if (String(item.status || '').toLowerCase() !== 'available') {
            showAlert(`Only available equipment can be assigned. Current status: ${item.status || 'Unknown'}`);
            return;
        }

        const users = await fetchAdminAssignableEquipmentUsers();
        if (!users.length) {
            showAlert('No active employees available for assignment.');
            return;
        }

        const selectedUser = await openAdminAssignPickerModal(item, users);
        if (!selectedUser) return;

        const response = await fetch(API_BASE + '/api/equipment/assign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                equipment_id: Number(item.equipment_id),
                user_id: Number(selectedUser.user_id),
                notes: null
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to assign equipment (${response.status})`);
        }

        showNotification(data.message || 'Equipment assigned successfully!', 'success');
        await loadEquipmentTable();
    }

    function renderEquipmentTableRows(equipment) {
        const equipmentTableBody = document.getElementById('equipment-table-body');
        if (!equipmentTableBody) return;

        if (equipment.length === 0) {
            equipmentTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                        <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-search"></i></div>
                        <div style="font-size: 16px; font-weight: 600;">No equipment records found</div>
                        <div style="font-size: 14px; margin-top: 8px;">Try a different search keyword.</div>
                    </td>
                </tr>
            `;
            return;
        }

        equipmentTableBody.innerHTML = equipment.map(item => {
            const statusClass = 
                item.status === 'Available' ? 'success' :
                item.status === 'Checked Out' ? 'warning' : '';
            
            const conditionClass = 
                ['Excellent', 'Good'].includes(item.condition) ? 'success' :
                item.condition === 'Fair' ? 'warning' : '';

            const canEditEquipment = hasPermission('can_edit_equipment');
            const canAssignEquipment = hasPermission('can_assign_equipment');

            return `
                <tr>
                    <td>${item.name || 'Unknown'}</td>
                    <td style="text-align: center;">
                        ${item.qr_code ? `<img src="${item.qr_code}" alt="QR Code" class="qr-code-img" data-qr-code="${item.qr_code}" data-qr-number="${item.qr_number || 'Equipment'}" data-equip-name="${(item.name || 'Equipment').replace(/"/g, '&quot;')}" style="width: 50px; height: 50px; cursor: pointer;">` : 'N/A'}
                    </td>
                    <td style="font-family: monospace; font-weight: 600;">${item.qr_number || 'N/A'}</td>
                    <td>1</td>
                    <td><span class="badge ${conditionClass}">${item.condition || 'N/A'}</span></td>
                    <td><span class="badge ${statusClass}">${item.status || 'Unknown'}</span></td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            ${canEditEquipment ? `
                            <button class="btn-small edit-equipment-btn" data-equipment-id="${item.equipment_id}" title="Edit Equipment">
                                <i class="bi bi-pencil"></i>
                            </button>
                            ` : ''}
                            ${canAssignEquipment ? `
                            <button class="btn-small assign-equipment-btn" data-equipment-id="${item.equipment_id}" title="Assign Equipment" style="background: #2dad50;">
                                <i class="bi bi-person-check"></i>
                            </button>
                            ` : ''}
                            ${item.qr_code ? `
                            <button class="btn-small download-qr-btn" data-qr-code="${item.qr_code}" data-qr-number="${item.qr_number || 'QR'}" data-equip-name="${(item.name || 'Equipment').replace(/"/g, '&quot;')}" title="Download QR Code" style="background: #2dad50;">
                                <i class="bi bi-download"></i>
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Delegation is set up once on the tbody; it survives every pagination
        // re-render because the tbody element itself is never replaced.
        if (!equipmentTableBody.dataset.delegationBound) {
            equipmentTableBody.dataset.delegationBound = 'true';

            equipmentTableBody.addEventListener('click', async function(e) {
                // QR code image click (view/download)
                const qrImg = e.target.closest('.qr-code-img');
                if (qrImg) {
                    downloadQRCode(qrImg.dataset.qrCode, qrImg.dataset.qrNumber, qrImg.dataset.equipName);
                    return;
                }

                // Download QR button
                const dlBtn = e.target.closest('.download-qr-btn');
                if (dlBtn) {
                    downloadQRCode(dlBtn.dataset.qrCode, dlBtn.dataset.qrNumber, dlBtn.dataset.equipName);
                    return;
                }

                // Edit button
                const editBtn = e.target.closest('.edit-equipment-btn');
                if (editBtn) {
                    if (!hasPermission('can_edit_equipment')) {
                        showAlert('You do not have permission to edit equipment.');
                        return;
                    }
                    const equipmentId = parseInt(editBtn.dataset.equipmentId, 10);
                    if (equipmentId) editEquipment(equipmentId);
                    return;
                }

                // Assign button
                const assignBtn = e.target.closest('.assign-equipment-btn');
                if (assignBtn) {
                    if (!hasPermission('can_assign_equipment')) {
                        showAlert('You do not have permission to assign equipment.');
                        return;
                    }
                    const equipmentId = parseInt(assignBtn.dataset.equipmentId, 10);
                    if (!equipmentId) return;
                    const selectedItem = equipmentCache.find(item => Number(item.equipment_id) === equipmentId);
                    if (!selectedItem) {
                        showAlert('Equipment record not found. Please refresh and try again.');
                        return;
                    }
                    try {
                        await assignEquipmentFromAdminRow(selectedItem);
                    } catch (error) {
                        console.error('Assign equipment error:', error);
                        showNotification(error.message || 'Failed to assign equipment.', 'error');
                    }
                    return;
                }
            });
        }
    }

    function applyEquipmentFilters() {
        const query = (equipmentSearchInput?.value || '').trim().toLowerCase();
        const filtered = equipmentCache.filter(item => {
            const textBlob = `${item.name || ''} ${item.qr_number || ''} ${item.condition || ''} ${item.status || ''} ${item.current_location || ''}`.toLowerCase();
            return !query || textBlob.includes(query);
        });

        renderEquipmentTableRows(filtered);
    }

    async function loadEquipmentTable() {
        if (!hasPermission('can_view_equipment')) {
            const equipmentTableBody = document.getElementById('equipment-table-body');
            if (equipmentTableBody) {
                equipmentTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">You do not have permission to view equipment.</td>
                    </tr>
                `;
            }
            return;
        }

        try {
            const response = await fetch(API_BASE + '/api/equipment', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const equipmentTableBody = document.getElementById('equipment-table-body');
            if (!equipmentTableBody) return;

            if (response.ok) {
                const data = await response.json();
                const equipment = data.equipment || [];
                equipmentCache = equipment;

                if (equipment.length === 0) {
                    equipmentTableBody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                                <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-box-seam"></i></div>
                                <div style="font-size: 16px; font-weight: 600;">No equipment found</div>
                                <div style="font-size: 14px; margin-top: 8px;">Click "+ Add Equipment" to add your first item</div>
                            </td>
                        </tr>
                    `;
                    return;
                }

                applyEquipmentFilters();

                console.log(`[Admin Dashboard] Loaded ${equipment.length} equipment items`);
            } else {
                equipmentTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                            <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-exclamation-triangle-fill"></i></div>
                            <div style="font-size: 16px; font-weight: 600;">Failed to load equipment</div>
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Error loading equipment:', error);
            const equipmentTableBody = document.getElementById('equipment-table-body');
            if (equipmentTableBody) {
                equipmentTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 40px; color: #ef4444;">
                            <div style="font-size: 48px; margin-bottom: 12px;"><i class="bi bi-x-circle-fill"></i></div>
                            <div style="font-size: 16px; font-weight: 600;">Network error</div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    if (equipmentSearchInput) {
        equipmentSearchInput.addEventListener('input', applyEquipmentFilters);
    }

    if (userSearchInput) {
        userSearchInput.addEventListener('input', applyUserFilters);
    }

    // --- PROJECT FILES TAB FUNCTIONS ---
    const filesTableBody = document.getElementById('files-table-body');
    const syncCloudinaryBtn = document.getElementById('sync-cloudinary-btn');
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

    let projectFilesCache = [];

    function resetProjectFilesSearch() {
        const input = document.getElementById('files-search-input');
        if (!input) return;
        input.value = '';
        input.defaultValue = '';
    }

    // Some browsers restore typed email values into text fields from history/autofill.
    resetProjectFilesSearch();
    window.addEventListener('pageshow', resetProjectFilesSearch);

    function escapeHtml(value) {
        const text = String(value || '');
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updateFilesStats(files) {
        const total = files.length;
        const cloudMb = files
            .filter(f => f.storage_location === 'CLOUD')
            .reduce((sum, file) => sum + (Number(file.file_size_mb) || 0), 0);
        const ftpMb = files
            .filter(f => f.storage_location === 'LOCAL_FTP')
            .reduce((sum, file) => sum + (Number(file.file_size_mb) || 0), 0);
        const totalMb = cloudMb + ftpMb;

        if (filesTotalCount) filesTotalCount.textContent = total;
        if (filesCloudStorage) filesCloudStorage.textContent = cloudMb.toFixed(2);
        if (filesFtpStorage) filesFtpStorage.textContent = ftpMb.toFixed(2);
        if (filesStorageTotal) filesStorageTotal.textContent = totalMb.toFixed(2);
    }

    async function loadStorageSummary() {
        try {
            const response = await fetch(API_BASE + '/api/files/storage-summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;

            const data = await response.json();
            const summary = data?.summary;
            if (!summary) return;

            const project = summary.project || {};
            const platform = summary.platform || {};

            // Show project-level totals so newly uploaded files reflect immediately.
            const cloudMb = Number(project.cloudinary_mb ?? platform.cloudinary_mb ?? 0);
            const ftpMb = Number(project.local_ftp_mb ?? platform.local_ftp_mb ?? 0);
            const totalMb = Number(project.total_mb ?? (cloudMb + ftpMb));
            const fileCount = Number(project.file_count ?? projectFilesCache.length ?? 0);

            if (filesTotalCount) filesTotalCount.textContent = fileCount;
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

        filesTableBody.innerHTML = files.map(file => {
            const storage = file.storage_location || 'UNKNOWN';
            const isCloud = storage === 'CLOUD';
            const storageClass = isCloud ? 'storage-cloud' : 'storage-ftp';
            const storageIcon = isCloud ? 'bi-cloud-check' : 'bi-hdd-network';
            const viewUrl = file.cloudinary_url || file.local_ftp_path || '';
            const uploadedBy = file.uploader?.full_name || 'Unknown';
            const uploadedAt = file.uploaded_at
                ? new Date(file.uploaded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '-';

            const canDownloadFiles = hasPermission('can_download_files');
            const canViewFiles = hasPermission('can_view_files');
            const canEditFiles = hasPermission('can_edit_files');
            const canDeleteFiles = hasPermission('can_delete_files');

            return `
                <tr>
                    <td class="file-name-cell">
                        <div class="file-name-primary" title="${escapeHtml(file.file_name)}">${escapeHtml(file.file_name)}</div>
                        <div class="file-name-secondary">ID #${file.file_id}</div>
                    </td>
                    <td>${escapeHtml(file.file_type || '-')}</td>
                    <td>${Number(file.file_size_mb || 0).toFixed(2)}</td>
                    <td>
                        <span class="storage-badge ${storageClass}">
                            <i class="bi ${storageIcon}"></i>${storage}
                        </span>
                    </td>
                    <td>${uploadedAt}</td>
                    <td>${escapeHtml(uploadedBy)}</td>
                    <td>
                        <div class="files-actions">
                            ${canEditFiles ? `
                                <button class="btn-small btn-edit-file" data-file-id="${file.file_id}" data-file-name="${escapeHtml(file.file_name || '')}" title="Edit File Name">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                            ` : ''}
                            ${viewUrl && canViewFiles ? `
                                <button class="btn-small btn-view-file" data-file-url="${escapeHtml(viewUrl)}" title="View File">
                                    <i class="bi bi-eye"></i>
                                </button>
                            ` : ''}
                            ${viewUrl && canDownloadFiles ? `
                                <button class="btn-small btn-download-file" data-file-id="${file.file_id}" title="Download File">
                                    <i class="bi bi-download"></i>
                                </button>
                            ` : ''}
                            ${canDeleteFiles ? `<button class="btn-small btn-delete-file" data-file-id="${file.file_id}" title="Delete File" style="background:#ef4444;">
                                <i class="bi bi-trash"></i>
                            </button>` : ''}
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

    async function loadProjectFiles() {
        if (!filesTableBody) return;

        if (!hasPermission('can_view_files')) {
            filesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding: 24px; color:#9ca3af;">You do not have permission to view files.</td>
                </tr>
            `;
            return;
        }

        filesTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 24px; color:#6b7280;">Loading project files...</td>
            </tr>
        `;

        try {
            const response = await fetch(API_BASE + '/api/files', {
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
    }

    if (openFileUploadBtn && fileUploadPanel) {
        openFileUploadBtn.addEventListener('click', () => {
            if (!hasPermission('can_upload_files')) {
                showAlert('You do not have permission to upload files.');
                return;
            }
            fileUploadPanel.classList.remove('hidden');
        });
    }

    if (syncCloudinaryBtn) {
        syncCloudinaryBtn.addEventListener('click', async () => {
            if (!hasPermission('can_upload_files')) {
                showAlert('You do not have permission to sync Cloudinary files.');
                return;
            }

            const originalHtml = syncCloudinaryBtn.innerHTML;
            syncCloudinaryBtn.disabled = true;
            syncCloudinaryBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Syncing...';

            try {
                const response = await fetch(API_BASE + '/api/files/sync-cloudinary', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Cloudinary sync failed');
                }

                const imported = Number(data?.stats?.imported || 0);
                const scanned = Number(data?.stats?.scanned || 0);
                showAlert(imported > 0
                    ? `Cloudinary sync complete: imported ${imported} of ${scanned} files.`
                    : (data.message || 'No new Cloudinary files found to import.'));

                if (filesStorageFilter) filesStorageFilter.value = 'ALL';
                if (filesSearchInput) filesSearchInput.value = '';
                await loadProjectFiles();
            } catch (error) {
                console.error('Cloudinary sync error:', error);
                showAlert(`Cloudinary sync failed: ${error.message}`);
            } finally {
                syncCloudinaryBtn.disabled = !hasPermission('can_upload_files');
                syncCloudinaryBtn.innerHTML = originalHtml;
            }
        });
    }

    if (cancelFileUploadBtn && fileUploadPanel && projectFileUploadForm) {
        cancelFileUploadBtn.addEventListener('click', () => {
            projectFileUploadForm.reset();
            fileUploadPanel.classList.add('hidden');
        });
    }

    const uploadStorageToggle = document.getElementById('upload-storage-toggle');
    const uploadPreferredStorage = document.getElementById('upload-preferred-storage');
    const uploadStorageHint = document.getElementById('upload-storage-hint');
    const fileUploadInfo = document.getElementById('file-upload-info');
    const fileUploadNameEl = document.getElementById('file-upload-name');
    const fileUploadSizeEl = document.getElementById('file-upload-size');
    const fileUploadProgress = document.getElementById('file-upload-progress');
    const fileUploadProgressBar = document.getElementById('file-upload-progress-bar');
    const fileUploadProgressLabel = document.getElementById('file-upload-progress-label');

    const storageHints = {
        AUTO: 'Auto \u2014 images go to Cloudinary, documents go to Local FTP',
        CLOUD: 'Force upload to Cloudinary (images optimized; PDFs stored as raw)',
        LOCAL_FTP: 'Force save to Local FTP storage'
    };

    if (uploadStorageToggle) {
        uploadStorageToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.fup-storage-btn');
            if (!btn) return;
            uploadStorageToggle.querySelectorAll('.fup-storage-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const val = btn.dataset.storage || 'AUTO';
            if (uploadPreferredStorage) uploadPreferredStorage.value = val;
            if (uploadStorageHint) uploadStorageHint.textContent = storageHints[val] || '';
        });
    }

    if (projectFileInput) {
        projectFileInput.addEventListener('change', () => {
            const file = projectFileInput.files?.[0];
            if (!file || !fileUploadInfo) return;
            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
            if (fileUploadNameEl) fileUploadNameEl.textContent = file.name;
            if (fileUploadSizeEl) fileUploadSizeEl.textContent = `${sizeMb} MB`;
            fileUploadInfo.classList.remove('hidden');
        });
    }

    if (projectFileUploadForm) {
        projectFileUploadForm.addEventListener('submit', (e) => {
            e.preventDefault();

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

            if (fileUploadProgress) {
                fileUploadProgress.classList.remove('hidden');
                if (fileUploadProgressBar) fileUploadProgressBar.style.width = '0%';
                if (fileUploadProgressLabel) fileUploadProgressLabel.textContent = 'Uploading\u2026 0%';
            }

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('category', projectFileCategory?.value || 'project_progress');
            const pref = uploadPreferredStorage?.value || 'AUTO';
            if (pref !== 'AUTO') formData.append('preferred_storage', pref);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', API_BASE + '/api/files');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);

            xhr.upload.addEventListener('progress', (evt) => {
                if (!evt.lengthComputable) return;
                const pct = Math.round((evt.loaded / evt.total) * 90);
                if (fileUploadProgressBar) fileUploadProgressBar.style.width = `${pct}%`;
                if (fileUploadProgressLabel) fileUploadProgressLabel.textContent = `Uploading\u2026 ${pct}%`;
            });

            xhr.addEventListener('load', async () => {
                if (fileUploadProgressBar) fileUploadProgressBar.style.width = '100%';
                if (fileUploadProgressLabel) fileUploadProgressLabel.textContent = 'Processing\u2026';

                let data = {};
                try { data = JSON.parse(xhr.responseText); } catch (_) {}

                if (xhr.status >= 200 && xhr.status < 300) {
                    if (fileUploadProgressLabel) fileUploadProgressLabel.textContent = 'Upload complete!';
                    setTimeout(() => {
                        if (fileUploadProgress) fileUploadProgress.classList.add('hidden');
                        if (fileUploadInfo) fileUploadInfo.classList.add('hidden');
                    }, 800);
                    showAlert('File uploaded successfully.');
                    projectFileUploadForm.reset();
                    fileUploadPanel.classList.add('hidden');
                    if (filesStorageFilter) filesStorageFilter.value = 'ALL';
                    if (filesSearchInput) filesSearchInput.value = '';
                    await loadProjectFiles();
                } else {
                    if (fileUploadProgress) fileUploadProgress.classList.add('hidden');
                    showAlert(`Upload failed: ${data.error || 'Server error'}`);
                }

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';
                }
            });

            xhr.addEventListener('error', () => {
                if (fileUploadProgress) fileUploadProgress.classList.add('hidden');
                showAlert('Upload failed: Could not reach the server. Please check your connection.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-upload"></i> Upload';
                }
            });

            xhr.send(formData);

            /* dummy block to keep original finally shape */
            if (false) {
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
            const viewBtn = event.target.closest('.btn-view-file');
            const downloadBtn = event.target.closest('.btn-download-file');
            const deleteBtn = event.target.closest('.btn-delete-file');

            if (editBtn) {
                if (!hasPermission('can_edit_files')) {
                    showAlert('You do not have permission to edit file metadata.');
                    return;
                }

                const fileId = editBtn.getAttribute('data-file-id');
                const currentName = editBtn.getAttribute('data-file-name') || '';
                if (!fileId) return;

                const newName = await showPrompt('Enter new file name:', currentName, 'Edit File Name');
                if (newName === null) return;

                const trimmedName = String(newName).trim();
                if (!trimmedName) {
                    showAlert('File name cannot be empty.');
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ file_name: trimmedName })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || 'Update failed');
                    }

                    showAlert('File name updated successfully.');
                    await loadProjectFiles();
                } catch (error) {
                    console.error('Edit file error:', error);
                    showAlert(`Edit failed: ${error.message}`);
                }
            }

            if (viewBtn) {
                if (!hasPermission('can_view_files')) {
                    showAlert('You do not have permission to view files.');
                    return;
                }

                const fileUrl = viewBtn.getAttribute('data-file-url') || '';
                if (!fileUrl) {
                    showAlert('File URL unavailable.');
                    return;
                }

                window.open(fileUrl, '_blank', 'noopener,noreferrer');
            }

            if (downloadBtn) {
                if (!hasPermission('can_download_files')) {
                    showAlert('You do not have permission to download files.');
                    return;
                }

                const fileId = downloadBtn.getAttribute('data-file-id');
                if (!fileId) return;

                try {
                    const response = await fetch(`${API_BASE}/api/files/${fileId}/download`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || 'Download failed');
                    }

                    const url = data?.file?.url;
                    const fileName = data?.file?.file_name || `file-${fileId}`;
                    if (!url) {
                        throw new Error('File URL unavailable.');
                    }

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
                const fileId = deleteBtn.getAttribute('data-file-id');
                if (!fileId) return;

                const confirmed = await showConfirm(
                    'Archive this file record? It will be removed from active files and preserved in Archives.',
                    'Archive File',
                    'Archive',
                    'Cancel'
                );

                if (!confirmed) return;

                try {
                    const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || 'Delete failed');
                    }

                    showAlert('File deleted successfully.');
                    await loadProjectFiles();
                } catch (error) {
                    console.error('Delete file error:', error);
                    showAlert(`Delete failed: ${error.message}`);
                }
            }
        });
    }

    // --- CLIENT INQUIRIES TAB FUNCTIONS ---
    const inquiryTableBody = document.getElementById('inquiry-table-body');
    const inquirySearchInput = document.getElementById('inquiry-search-input');
    const inquiryStatusFilter = document.getElementById('inquiry-status-filter');
    const adminInquiryForm = document.getElementById('admin-inquiry-form');
    const adminInquiryClientName = document.getElementById('admin-inquiry-client-name');
    const adminInquiryClientEmail = document.getElementById('admin-inquiry-client-email');
    const adminInquirySubject = document.getElementById('admin-inquiry-subject');
    const adminInquiryMessage = document.getElementById('admin-inquiry-message');
    const adminInquirySubmitBtn = document.getElementById('admin-inquiry-submit-btn');
    const adminInquiryFormMessage = document.getElementById('admin-inquiry-form-message');
    const inquiriesStatTotal = document.getElementById('inquiries-stat-total');
    const inquiriesStatPending = document.getElementById('inquiries-stat-pending');
    const inquiriesStatProgress = document.getElementById('inquiries-stat-progress');
    const inquiriesStatResolved = document.getElementById('inquiries-stat-resolved');

    let inquiriesCache = [];
    let assignableInquiryUsersCache = [];
    const expandedInquirySubjectIds = new Set();
    const expandedInquiryMessageIds = new Set();

    function setInquiryFormMessage(message, tone = 'neutral') {
        if (!adminInquiryFormMessage) return;
        adminInquiryFormMessage.textContent = message;
        adminInquiryFormMessage.classList.remove('success', 'error');
        if (tone === 'success') adminInquiryFormMessage.classList.add('success');
        if (tone === 'error') adminInquiryFormMessage.classList.add('error');
    }

    function getInquiryStatusBadgeClass(status) {
        if (status === 'Resolved' || status === 'Closed') return 'success';
        if (status === 'In Progress') return '';
        return 'warning';
    }

    function updateInquiryStats(inquiries) {
        const total = inquiries.length;
        const pending = inquiries.filter(i => i.status === 'Pending').length;
        const inProgress = inquiries.filter(i => i.status === 'In Progress').length;
        const resolved = inquiries.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;

        if (inquiriesStatTotal) inquiriesStatTotal.textContent = total;
        if (inquiriesStatPending) inquiriesStatPending.textContent = pending;
        if (inquiriesStatProgress) inquiriesStatProgress.textContent = inProgress;
        if (inquiriesStatResolved) inquiriesStatResolved.textContent = resolved;
    }

    function getCollapsibleInquiryCellHtml({ inquiryId, textValue, field, expandedSet, maxLength }) {
        const rawText = String(textValue || '').trim();
        const safeText = rawText || '-';
        const isExpanded = expandedSet.has(inquiryId);
        const shouldCollapse = safeText.length > maxLength;
        const displayText = shouldCollapse && !isExpanded
            ? `${safeText.slice(0, maxLength).trimEnd()}...`
            : safeText;

        return {
            text: displayText,
            hasToggle: shouldCollapse,
            toggleHtml: shouldCollapse
                ? `<button type="button" class="inquiry-view-more-btn" data-inquiry-id="${inquiryId}" data-field="${field}">${isExpanded ? 'View less' : 'View more'}</button>`
                : ''
        };
    }

    function renderInquiryTable(inquiries) {
        if (!inquiryTableBody) return;

        const canUpdateInquiries = Boolean(user?.role === 'ADMIN' || user?.can_update_inquiries);
        const canDeleteInquiries = hasPermission('can_delete_inquiries');
        const canAssignInquiries = hasPermission('can_assign_inquiries');

        if (!inquiries.length) {
            inquiryTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">No inquiries found for current filters</td>
                </tr>
            `;
            return;
        }

        const INQUIRY_TYPE_LABELS = {
            residential: 'Residential Project',
            commercial: 'Commercial Project',
            infrastructure: 'Infrastructure',
            renovation: 'Renovation/Restoration',
            other: 'Other'
        };
        function formatInquiryType(raw) {
            if (!raw) return '-';
            return INQUIRY_TYPE_LABELS[String(raw).toLowerCase()] || raw;
        }

        inquiryTableBody.innerHTML = inquiries.map(inquiry => {
            const submitted = inquiry.submitted_at
                ? new Date(inquiry.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '-';
            const badgeClass = getInquiryStatusBadgeClass(inquiry.status);
            const inquiryId = Number(inquiry.inquiry_id || 0);
            const inquiryMessage = String(inquiry.message || inquiry.message_body || '');
            const inquiryTypeLabel = formatInquiryType(inquiry.subject);
            const subjectCell = getCollapsibleInquiryCellHtml({
                inquiryId,
                textValue: inquiryTypeLabel,
                field: 'subject',
                expandedSet: expandedInquirySubjectIds,
                maxLength: 48
            });
            const messageCell = getCollapsibleInquiryCellHtml({
                inquiryId,
                textValue: inquiryMessage,
                field: 'message',
                expandedSet: expandedInquiryMessageIds,
                maxLength: 110
            });
            const statusControlHtml = canUpdateInquiries
                ? `
                        <select class="modern-select inquiry-status-select" data-inquiry-id="${inquiry.inquiry_id}" style="padding: 6px 8px; min-width: 128px;">
                            <option value="Pending" ${inquiry.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${inquiry.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${inquiry.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="Closed" ${inquiry.status === 'Closed' ? 'selected' : ''}>Closed</option>
                        </select>
                    `
                : `<span class="badge ${badgeClass}">${escapeHtml(inquiry.status || 'Pending')}</span>`;

            return `
                <tr>
                    <td>${submitted}</td>
                    <td>${escapeHtml(inquiry.client_name || '-')}</td>
                    <td>${escapeHtml(inquiry.client_email || '-')}</td>
                    <td class="inquiry-subject-cell" title="${escapeHtml(inquiryTypeLabel)}">
                        <span>${escapeHtml(subjectCell.text)}</span>
                        ${subjectCell.toggleHtml}
                    </td>
                    <td class="inquiry-message-cell" title="${escapeHtml(inquiryMessage)}">
                        <span>${escapeHtml(messageCell.text)}</span>
                        ${messageCell.toggleHtml}
                    </td>
                    <td>${statusControlHtml}</td>
                    <td>
                        ${inquiry.manager
                            ? `<span class="inquiry-assignee"><i class="bi bi-person-check"></i> ${escapeHtml(inquiry.manager.full_name || 'Assigned')}</span>`
                            : '<span class="muted-note">Unassigned</span>'
                        }
                    </td>
                    <td>
                        <div class="inquiry-actions">
                            ${canAssignInquiries ? `<button class="btn-small btn-assign-inquiry" data-inquiry-id="${inquiry.inquiry_id}" style="background:#2dad50;"><i class="bi bi-person-check"></i></button>` : ''}
                            ${canDeleteInquiries ? `<button class="btn-small btn-delete-inquiry" data-inquiry-id="${inquiry.inquiry_id}" style="background:#ef4444;"><i class="bi bi-trash"></i></button>` : ''}
                            ${!canAssignInquiries && !canDeleteInquiries ? '<span class="muted-note">No actions</span>' : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function fetchAssignableInquiryUsers() {
        if (assignableInquiryUsersCache.length) {
            return assignableInquiryUsersCache;
        }

        const response = await fetch(API_BASE + '/api/inquiries/assignable-users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to load assignable users (${response.status})`);
        }

        assignableInquiryUsersCache = Array.isArray(data.users) ? data.users : [];
        return assignableInquiryUsersCache;
    }

    function openAdminInquiryAssignModal(inquiry, users) {
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
                    <span class="close-modal" id="inquiry-assign-close-btn">&times;</span>
                </div>
                <div class="form-scroll-body admin-assign-body">
                    <label class="modern-label" for="inquiry-assign-user-search">Search User</label>
                    <input type="text" id="inquiry-assign-user-search" class="modern-input" placeholder="Type name or email..." autocomplete="off">
                    <div class="assign-user-search-list" id="inquiry-assign-user-list"></div>
                </div>
                <div class="modal-actions admin-assign-actions">
                    <button type="button" class="btn-secondary" id="inquiry-assign-cancel-btn">Cancel</button>
                    <button type="button" class="btn-primary" id="inquiry-assign-confirm-btn" disabled>Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#inquiry-assign-close-btn');
        const cancelBtn = modal.querySelector('#inquiry-assign-cancel-btn');
        const confirmBtn = modal.querySelector('#inquiry-assign-confirm-btn');
        const searchInput = modal.querySelector('#inquiry-assign-user-search');
        const listEl = modal.querySelector('#inquiry-assign-user-list');
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
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    if (!selectedUser) return;
                    handleClose(selectedUser);
                });
            }

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

    async function assignInquiryFromAdminRow(inquiry) {
        if (!hasPermission('can_assign_inquiries')) {
            showAlert('You do not have permission to assign inquiries.');
            return;
        }

        if (!inquiry?.inquiry_id) {
            showAlert('Inquiry record not found. Please refresh and try again.');
            return;
        }

        const users = await fetchAssignableInquiryUsers();
        if (!users.length) {
            showAlert('No active employees available for assignment.');
            return;
        }

        const selectedUser = await openAdminInquiryAssignModal(inquiry, users);
        if (!selectedUser) return;

        const response = await fetch(`${API_BASE}/api/inquiries/${Number(inquiry.inquiry_id)}/assign`, {
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
        await loadInquiries();
    }

    function applyInquiryFilters() {
        const query = (inquirySearchInput?.value || '').trim().toLowerCase();
        const status = (inquiryStatusFilter?.value || 'ALL').trim();

        const filtered = inquiriesCache.filter(inquiry => {
            const matchesStatus = status === 'ALL' || inquiry.status === status;
            const textBlob = `${inquiry.client_name || ''} ${inquiry.client_email || ''} ${inquiry.subject || ''} ${inquiry.message || inquiry.message_body || ''}`.toLowerCase();
            const matchesQuery = !query || textBlob.includes(query);
            return matchesStatus && matchesQuery;
        });

        renderInquiryTable(filtered);
    }

    async function loadInquiries() {
        if (!inquiryTableBody) return;

        if (!hasPermission('can_view_inquiries')) {
            inquiryTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view inquiries.</td>
                </tr>
            `;
            return;
        }

        inquiryTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:24px; color:#6b7280;">Loading inquiries...</td>
            </tr>
        `;

        try {
            const response = await fetch(API_BASE + '/api/inquiries', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `Failed to load inquiries (${response.status})`);
            }

            const data = await response.json();
            inquiriesCache = data.inquiries || [];
            expandedInquirySubjectIds.clear();
            expandedInquiryMessageIds.clear();
            updateInquiryStats(inquiriesCache);
            applyInquiryFilters();
        } catch (error) {
            console.error('Load inquiries error:', error);
            inquiryTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#ef4444;">${escapeHtml(error.message)}</td>
                </tr>
            `;
        }
    }

    if (inquirySearchInput) {
        inquirySearchInput.addEventListener('input', applyInquiryFilters);
    }
    if (inquiryStatusFilter) {
        inquiryStatusFilter.addEventListener('change', applyInquiryFilters);
    }

    if (adminInquiryForm) {
        adminInquiryForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!hasPermission('can_add_inquiries')) {
                setInquiryFormMessage('You do not have permission to submit inquiries.', 'error');
                return;
            }

            const clientName = String(adminInquiryClientName?.value || '').trim();
            const clientEmail = String(adminInquiryClientEmail?.value || '').trim();
            const subject = String(adminInquirySubject?.value || '').trim();
            const message = String(adminInquiryMessage?.value || '').trim();

            if (!clientName || !clientEmail || !subject || !message) {
                setInquiryFormMessage('Please complete all required fields.', 'error');
                return;
            }

            if (adminInquirySubmitBtn) {
                adminInquirySubmitBtn.disabled = true;
                adminInquirySubmitBtn.textContent = 'Submitting...';
            }

            try {
                const response = await fetch(API_BASE + '/api/inquiries', {
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
                if (!response.ok) {
                    throw new Error(data.error || `Failed to submit inquiry (${response.status})`);
                }

                adminInquiryForm.reset();
                setInquiryFormMessage('Inquiry submitted successfully.', 'success');
                await loadInquiries();
            } catch (error) {
                console.error('Submit inquiry error:', error);
                setInquiryFormMessage(error.message || 'Failed to submit inquiry.', 'error');
            } finally {
                if (adminInquirySubmitBtn) {
                    adminInquirySubmitBtn.disabled = !hasPermission('can_add_inquiries');
                    adminInquirySubmitBtn.textContent = 'Submit Inquiry';
                }
            }
        });
    }

    if (inquiryTableBody) {
        inquiryTableBody.addEventListener('change', async (event) => {
            const statusSelect = event.target.closest('.inquiry-status-select');
            if (!statusSelect) return;

            if (!hasPermission('can_update_inquiries')) {
                showAlert('You do not have permission to update inquiries.');
                return;
            }

            const inquiryId = statusSelect.getAttribute('data-inquiry-id');
            const status = statusSelect.value;
            if (!inquiryId) return;

            try {
                const response = await fetch(`${API_BASE}/api/inquiries/${inquiryId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to update inquiry status');
                }

                showAlert('Inquiry status updated successfully.');
                await loadInquiries();
            } catch (error) {
                console.error('Update inquiry status error:', error);
                showAlert(`Failed to update inquiry status: ${error.message}`);
            }
        });

        inquiryTableBody.addEventListener('click', async (event) => {
            const viewMoreBtn = event.target.closest('.inquiry-view-more-btn');
            if (viewMoreBtn) {
                const inquiryId = Number(viewMoreBtn.getAttribute('data-inquiry-id'));
                const field = String(viewMoreBtn.getAttribute('data-field') || '');
                if (!inquiryId) return;

                if (field === 'subject') {
                    if (expandedInquirySubjectIds.has(inquiryId)) {
                        expandedInquirySubjectIds.delete(inquiryId);
                    } else {
                        expandedInquirySubjectIds.add(inquiryId);
                    }
                }

                if (field === 'message') {
                    if (expandedInquiryMessageIds.has(inquiryId)) {
                        expandedInquiryMessageIds.delete(inquiryId);
                    } else {
                        expandedInquiryMessageIds.add(inquiryId);
                    }
                }

                applyInquiryFilters();
                return;
            }

            const assignBtn = event.target.closest('.btn-assign-inquiry');
            const deleteBtn = event.target.closest('.btn-delete-inquiry');

            if (assignBtn) {
                try {
                    const inquiryId = Number(assignBtn.getAttribute('data-inquiry-id'));
                    if (!inquiryId) return;

                    const inquiryItem = inquiriesCache.find(item => Number(item.inquiry_id) === inquiryId);
                    await assignInquiryFromAdminRow(inquiryItem);
                } catch (error) {
                    console.error('Assign inquiry error:', error);
                    showAlert(error.message || 'Failed to assign inquiry.');
                }
                return;
            }

            if (!deleteBtn) return;

            if (!hasPermission('can_delete_inquiries')) {
                showAlert('You do not have permission to delete inquiries.');
                return;
            }

            const inquiryId = deleteBtn.getAttribute('data-inquiry-id');
            if (!inquiryId) return;

            const confirmed = await showConfirm(
                'Archive this inquiry record? It will be removed from active inquiries and preserved in Archives.',
                'Archive Inquiry',
                'Archive',
                'Cancel'
            );
            if (!confirmed) return;

            try {
                const response = await fetch(`${API_BASE}/api/inquiries/${inquiryId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to delete inquiry');
                }

                showAlert('Inquiry deleted successfully.');
                await loadInquiries();
            } catch (error) {
                console.error('Delete inquiry error:', error);
                showAlert(`Failed to delete inquiry: ${error.message}`);
            }
        });
    }

    // --- REPORT GENERATION TAB ---
    const reportStartDateInput = document.getElementById('report-start-date');
    const reportEndDateInput = document.getElementById('report-end-date');
    const reportSetWeekBtn = document.getElementById('report-set-week-btn');
    const reportSetMonthBtn = document.getElementById('report-set-month-btn');
    const reportClearDatesBtn = document.getElementById('report-clear-dates-btn');
    const reportDownloadButtons = document.querySelectorAll('.report-download-btn');

    function formatDateInputValue(date) {
        return date.toISOString().slice(0, 10);
    }

    function initializeReportDateRange() {
        if (!reportStartDateInput || !reportEndDateInput) return;

        if (reportStartDateInput.value && reportEndDateInput.value) return;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 6);

        reportStartDateInput.value = formatDateInputValue(startDate);
        reportEndDateInput.value = formatDateInputValue(endDate);
        syncReportDateConstraints();
    }

    function syncReportDateConstraints() {
        if (!reportStartDateInput || !reportEndDateInput) return;

        reportStartDateInput.max = reportEndDateInput.value || '';
        reportEndDateInput.min = reportStartDateInput.value || '';
    }

    function canDownloadReportType(reportType) {
        const reportPermissionMap = {
            attendance: hasPermission('can_export_attendance_report'),
            'attendance-sites': hasPermission('can_view_all_attendance') || hasPermission('can_edit_attendance'),
            'equipment-usage': hasPermission('can_view_equipment'),
            'equipment-inventory': hasPermission('can_view_equipment'),
            'inquiry-resolution': hasPermission('can_view_inquiries'),
            'inquiries-detail': hasPermission('can_view_inquiries'),
            files: hasPermission('can_view_files'),
            'users-directory': hasPermission('can_view_users'),
            'user-access': hasPermission('can_manage_permissions'),
            'health-siem': hasPermission('can_view_health_logs') || hasPermission('can_export_health_logs'),
            'health-backups': hasPermission('can_view_health_logs') || hasPermission('can_backup_database') || hasPermission('can_export_health_logs'),
            'health-audit': hasPermission('can_view_audit_trail') || hasPermission('can_view_health_logs'),
            'health-activity': hasPermission('can_view_audit_trail') || hasPermission('can_view_health_logs'),
            archives: hasPermission('can_view_audit_trail')
        };

        return Boolean(reportPermissionMap[reportType]);
    }

    async function downloadAdminReport(reportType, format, triggerButton) {
        const canDownloadReport = canDownloadReportType(reportType);

        if (!canDownloadReport) {
            showAlert('You do not have permission to download this report.');
            return;
        }

        const startDate = reportStartDateInput?.value || '';
        const endDate = reportEndDateInput?.value || '';

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            showAlert('Start date cannot be later than end date.');
            return;
        }

        const params = new URLSearchParams({ format });
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);

        const originalText = triggerButton.innerHTML;
        triggerButton.disabled = true;
        triggerButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Preparing...';

        try {
            const response = await fetch(`${API_BASE}/api/reports/${reportType}?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to generate report');
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const extension = format === 'pdf' ? 'pdf' : 'csv';
            const today = new Date().toISOString().slice(0, 10);
            const dateSuffix = startDate || endDate
                ? `${startDate || 'start'}_to_${endDate || 'end'}`
                : today;

            anchor.href = objectUrl;
            anchor.download = `${reportType}_${dateSuffix}.${extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(objectUrl);

            showAlert(`Report downloaded successfully (${extension.toUpperCase()}).`);
        } catch (error) {
            console.error('Report download error:', error);
            showAlert(`Report download failed: ${error.message}`);
        } finally {
            triggerButton.disabled = false;
            triggerButton.innerHTML = originalText;
        }
    }

    if (reportSetWeekBtn) {
        reportSetWeekBtn.addEventListener('click', () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);

            if (reportStartDateInput) reportStartDateInput.value = formatDateInputValue(startDate);
            if (reportEndDateInput) reportEndDateInput.value = formatDateInputValue(endDate);
            syncReportDateConstraints();
        });
    }

    if (reportSetMonthBtn) {
        reportSetMonthBtn.addEventListener('click', () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 29);

            if (reportStartDateInput) reportStartDateInput.value = formatDateInputValue(startDate);
            if (reportEndDateInput) reportEndDateInput.value = formatDateInputValue(endDate);
            syncReportDateConstraints();
        });
    }

    if (reportClearDatesBtn) {
        reportClearDatesBtn.addEventListener('click', () => {
            if (reportStartDateInput) reportStartDateInput.value = '';
            if (reportEndDateInput) reportEndDateInput.value = '';
            syncReportDateConstraints();
        });
    }

    if (reportStartDateInput) {
        reportStartDateInput.addEventListener('change', () => {
            if (reportEndDateInput?.value && reportStartDateInput.value && reportStartDateInput.value > reportEndDateInput.value) {
                reportEndDateInput.value = reportStartDateInput.value;
            }
            syncReportDateConstraints();
        });
    }

    if (reportEndDateInput) {
        reportEndDateInput.addEventListener('change', () => {
            if (reportStartDateInput?.value && reportEndDateInput.value && reportEndDateInput.value < reportStartDateInput.value) {
                reportStartDateInput.value = reportEndDateInput.value;
            }
            syncReportDateConstraints();
        });
    }

    reportDownloadButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const reportType = btn.getAttribute('data-report-type');
            const format = btn.getAttribute('data-format');
            if (!reportType || !format) return;
            downloadAdminReport(reportType, format, btn);
        });
    });

    document.getElementById('reports-shell')?.addEventListener('click', e => {
        const header = e.target.closest('.report-accordion-header');
        if (!header) return;
        header.closest('.report-accordion-group')?.classList.toggle('open');
    });

    initializeReportDateRange();

    // --- EDIT EQUIPMENT FUNCTION ---
    function editEquipment(equipmentId) {
        fetch(`${API_BASE}/api/equipment`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => response.json())
        .then(data => {
            const equipment = data.equipment.find(e => e.equipment_id === equipmentId);

            if (equipment) {
                document.getElementById('equip-id').value = equipment.equipment_id;
                document.getElementById('equip-name').value = equipment.name || '';
                document.getElementById('equip-qty').value = 1; // Always 1 for individual items
                document.getElementById('equip-qty').disabled = true; // Can't change quantity in edit mode
                document.getElementById('equip-condition').value = equipment.condition || 'Good';
                document.getElementById('equip-status').value = equipment.status || 'Available';
                document.getElementById('equip-location').value = equipment.current_location || '';
                document.getElementById('equipment-modal-title').textContent = 'Edit Equipment';
                document.getElementById('equipment-danger-actions').classList.remove('hidden');
                modal.classList.remove('hidden');
            }
        })
        .catch(error => {
            console.error('Error loading equipment details:', error);
            showNotification('Failed to load equipment details', 'error');
        });
    }

    // --- DOWNLOAD QR CODE FUNCTION ---
    function downloadQRCode(qrCodeDataUrl, qrNumber, equipmentName) {
        // Create a canvas to add the QR number below the QR code
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size (QR code + text area)
        canvas.width = 400;
        canvas.height = 480;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Load the QR code image
        const img = new Image();
        img.onload = function() {
            // Draw QR code centered
            const qrSize = 300;
            const qrX = (canvas.width - qrSize) / 2;
            const qrY = 20;
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            
            // Add border around QR code
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
            
            // Add QR number text
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(qrNumber, canvas.width / 2, qrY + qrSize + 50);
            
            // Add equipment name
            ctx.font = '20px Arial';
            ctx.fillText(equipmentName, canvas.width / 2, qrY + qrSize + 85);
            
            // Convert to blob and download
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${qrNumber}_${equipmentName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        };
        img.src = qrCodeDataUrl;
    };

    // --- SIMPLE NOTIFICATION SYSTEM ---
    function showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#2dad50' : '#ef4444'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- 6. LOAD OVERVIEW DATA (Dashboard Statistics) ---

    let overviewDataCache = { users: [], equipment: [], inquiries: [] };

    // Returns { start, end, labels, daysCount, isCurrent, isWeekly }
    function getPeriodDateRange(period) {
        const now = new Date();
        let start, end, labels, daysCount, isCurrent, isWeekly;
        if (period === 'this_week' || period === 'last_week') {
            isWeekly = true;
            const day = now.getDay();
            const diffToMon = day === 0 ? -6 : 1 - day;
            const monday = new Date(now);
            monday.setDate(now.getDate() + diffToMon);
            monday.setHours(0, 0, 0, 0);
            if (period === 'last_week') monday.setDate(monday.getDate() - 7);
            start = new Date(monday);
            end = new Date(monday);
            end.setDate(monday.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            daysCount = 7;
            isCurrent = period === 'this_week';
        } else {
            isWeekly = false;
            const d = new Date(now);
            if (period === 'last_month') d.setMonth(d.getMonth() - 1);
            start = new Date(d.getFullYear(), d.getMonth(), 1);
            end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            daysCount = end.getDate();
            labels = Array.from({ length: daysCount }, (_, i) => String(i + 1));
            isCurrent = period === 'this_month';
        }
        return { start, end, labels, daysCount, isCurrent, isWeekly };
    }

    // Draw an SVG line/area chart into container
    function renderSvgLineChart(container, datasets, labels) {
        if (!container) return;
        const W = 400, H = 120;
        const pL = 4, pR = 8, pT = 14, pB = 24;
        const cW = W - pL - pR, cH = H - pT - pB;
        const n = labels.length;
        if (!n) { container.innerHTML = ''; return; }
        const step = n > 1 ? cW / (n - 1) : cW;
        const allVals = datasets.flatMap(d => d.values);
        const maxV = Math.max(...allVals, 1);

        const gridLines = [0.25, 0.5, 0.75, 1.0].map(ratio => {
            const y = pT + cH * (1 - ratio);
            return `<line x1="${pL}" y1="${y.toFixed(1)}" x2="${W - pR}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.8" stroke-dasharray="3,3"/>`;
        }).join('');

        const svgDatasets = datasets.map(({ values, color }) => {
            const pts = values.map((v, i) => [pL + i * step, pT + cH - (v / maxV) * cH]);
            let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
            for (let i = 1; i < pts.length; i++) {
                const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
                const cx = (x1 - x0) * 0.45;
                d += ` C${(x0 + cx).toFixed(1)},${y0.toFixed(1)} ${(x1 - cx).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
            }
            const baseY = (pT + cH).toFixed(1);
            const endX  = (pL + (n - 1) * step).toFixed(1);
            const fillD = `${d} L${endX},${baseY} L${pL},${baseY} Z`;
            const gId   = `ovg_${color.replace(/[^a-z0-9]/gi, '')}`;
            const dots  = n <= 14 ? pts.map(([px, py]) =>
                `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>`
            ).join('') : '';
            return `<defs><linearGradient id="${gId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
            </linearGradient></defs>
            <path d="${fillD}" fill="url(#${gId})"/>
            <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${dots}`;
        }).join('');

        const freq = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 7);
        const xLabels = labels.map((l, i) => {
            if (i % freq !== 0 && i !== n - 1) return '';
            return `<text x="${(pL + i * step).toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#9ca3af">${l}</text>`;
        }).join('');

        container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">${gridLines}${svgDatasets}${xLabels}</svg>`;
    }

    // Populate the attendance bar chart
    function buildAttendanceBars(logs, periodRange) {
        const barsEl  = document.getElementById('weekly-attendance-bars');
        const scaleEl = document.getElementById('weekly-attendance-scale');
        if (!barsEl) return;
        const { start, end, labels, daysCount, isCurrent, isWeekly } = periodRange;
        const counts = new Array(daysCount).fill(0);
        const now = new Date();
        const todayIdx = isWeekly ? (now.getDay() === 0 ? 6 : now.getDay() - 1) : now.getDate() - 1;
        logs.forEach(log => {
            if (log.action !== 'clock_in') return;
            const ts = new Date(log.timestamp);
            if (ts < start || ts > end) return;
            const idx = isWeekly ? (ts.getDay() === 0 ? 6 : ts.getDay() - 1) : ts.getDate() - 1;
            if (idx >= 0 && idx < daysCount) counts[idx]++;
        });
        const maxCount = Math.max(...counts, 1);
        const step = Math.max(1, Math.ceil(maxCount / 4));
        const axisMax = step * 4;
        if (scaleEl) {
            scaleEl.innerHTML = [axisMax, axisMax - step, axisMax - step * 2, axisMax - step * 3, 0]
                .map(v => `<span>${v}</span>`).join('');
        }
        barsEl.style.gridTemplateColumns = isWeekly ? 'repeat(7, 1fr)' : `repeat(${daysCount}, 1fr)`;
        if (isWeekly) { barsEl.classList.remove('monthly-view'); } else { barsEl.classList.add('monthly-view'); }
        const maxBarH = 204;
        barsEl.innerHTML = counts.map((count, i) => {
            const isFuture = isCurrent && i > todayIdx;
            const h = count === 0 ? 10 : Math.max(16, Math.round((count / axisMax) * maxBarH));
            const cls = isFuture ? ' muted' : '';
            return `<div class="weekly-bar-col"><div class="weekly-bar${cls}" style="height:${h}px"></div><span>${labels[i]}</span></div>`;
        }).join('');
    }

    // Populate inquiry breakdown horizontal bars
    function buildInquiryBreakdown(inquiries) {
        const container = document.getElementById('inquiry-status-bars');
        if (!container) return;
        const total = inquiries.length;
        if (!total) {
            container.innerHTML = '<div class="overview-empty-state"><i class="bi bi-chat-square"></i><span>No inquiries yet</span></div>';
            return;
        }
        const defs = [
            { label: 'Pending',     color: '#f59e0b', count: inquiries.filter(i => i.status === 'Pending').length },
            { label: 'In Progress', color: '#3b82f6', count: inquiries.filter(i => i.status === 'In Progress').length },
            { label: 'Resolved',    color: '#2dad50', count: inquiries.filter(i => i.status === 'Resolved' || i.status === 'Closed').length },
        ];
        container.innerHTML = defs.map(({ label, color, count }) => {
            const pct = Math.round((count / total) * 100);
            return `<div class="inquiry-bar-row">
                <div class="inquiry-bar-header">
                    <span class="inquiry-bar-label"><span class="inquiry-bar-dot" style="background:${color}"></span>${label}</span>
                    <span class="inquiry-bar-count">${count} <span class="inquiry-bar-pct">(${pct}%)</span></span>
                </div>
                <div class="inquiry-bar-track"><div class="inquiry-bar-fill" style="width:${Math.max(pct, 1)}%;background:${color}"></div></div>
            </div>`;
        }).join('') + `<div class="inquiry-bar-total">Total: <strong>${total}</strong></div>`;
    }

    // Populate recent inquiries list
    function buildRecentInquiries(inquiries) {
        const container = document.getElementById('recent-inquiries-list');
        const badge     = document.getElementById('recent-inquiries-badge');
        if (!container) return;
        const pending = inquiries.filter(i => i.status === 'Pending' || i.status === 'In Progress').length;
        if (badge) badge.textContent = pending;
        const recent = [...inquiries]
            .sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0))
            .slice(0, 6);
        if (!recent.length) {
            container.innerHTML = '<div class="overview-empty-state"><i class="bi bi-inbox"></i><span>No inquiries found</span></div>';
            return;
        }
        const statusColors = { Pending: '#f59e0b', 'In Progress': '#3b82f6', Resolved: '#2dad50', Closed: '#6b7280' };
        container.innerHTML = recent.map(inq => {
            const color = statusColors[inq.status] || '#6b7280';
            const date  = inq.created_at
                ? new Date(inq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return `<div class="overview-recent-item">
                <div class="overview-recent-item-title">${escapeHtml(inq.subject || inq.title || 'Inquiry #' + inq.inquiry_id)}</div>
                <div class="overview-recent-item-meta">
                    <span class="overview-recent-status" style="color:${color}">${inq.status || 'Unknown'}</span>
                    <span>${escapeHtml(inq.user?.full_name || '')}</span>
                    <span>${date}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Wire up the overview search bar (called once at init; searches cached data)
    function setupOverviewSearch() {
        const input     = document.getElementById('overview-search-input');
        const resultsEl = document.getElementById('overview-search-results');
        if (!input || !resultsEl) return;
        let timer;

        input.addEventListener('input', () => {
            clearTimeout(timer);
            const q = input.value.trim().toLowerCase();
            if (!q) { resultsEl.classList.add('hidden'); resultsEl.innerHTML = ''; return; }
            timer = setTimeout(() => {
                const { users = [], equipment = [], inquiries = [] } = overviewDataCache;
                const mu = users.filter(u =>
                    `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(q)).slice(0, 4);
                const me = equipment.filter(e =>
                    `${e.name} ${e.qr_number} ${e.status}`.toLowerCase().includes(q)).slice(0, 4);
                const mi = inquiries.filter(i =>
                    `${i.subject || i.title} ${i.status} ${i.user?.full_name}`.toLowerCase().includes(q)).slice(0, 4);

                if (!mu.length && !me.length && !mi.length) {
                    resultsEl.innerHTML = `<div class="overview-search-empty">No results for &ldquo;${escapeHtml(q)}&rdquo;</div>`;
                } else {
                    let html = '';
                    if (mu.length) {
                        html += `<div class="overview-search-group-head"><i class="bi bi-people-fill"></i> Employees</div>`;
                        html += mu.map(u => `<div class="overview-search-item" data-target="user-tab">
                            <i class="bi bi-person"></i>
                            <div><span class="overview-search-item-name">${escapeHtml(u.full_name || 'â€”')}</span>
                            <span class="overview-search-item-sub">${escapeHtml(u.role || '')} &middot; ${escapeHtml(u.email || '')}</span></div>
                        </div>`).join('');
                    }
                    if (me.length) {
                        html += `<div class="overview-search-group-head"><i class="bi bi-wrench-adjustable"></i> Equipment</div>`;
                        html += me.map(e => {
                            const sc = e.status === 'Available' ? '#2dad50' : '#f59e0b';
                            return `<div class="overview-search-item" data-target="equipment-tab">
                                <i class="bi bi-tools"></i>
                                <div><span class="overview-search-item-name">${escapeHtml(e.name || 'â€”')}</span>
                                <span class="overview-search-item-sub">${escapeHtml(e.qr_number || '')} &middot; <span style="color:${sc}">${escapeHtml(e.status || '')}</span></span></div>
                            </div>`;
                        }).join('');
                    }
                    if (mi.length) {
                        html += `<div class="overview-search-group-head"><i class="bi bi-chat-square-dots"></i> Inquiries</div>`;
                        html += mi.map(i => `<div class="overview-search-item" data-target="inquiry-tab">
                            <i class="bi bi-chat-square-text"></i>
                            <div><span class="overview-search-item-name">${escapeHtml(i.subject || i.title || 'Inquiry')}</span>
                            <span class="overview-search-item-sub">${escapeHtml(i.status || '')} &middot; ${escapeHtml(i.user?.full_name || '')}</span></div>
                        </div>`).join('');
                    }
                    resultsEl.innerHTML = html;
                }
                resultsEl.classList.remove('hidden');
            }, 240);
        });

        resultsEl.addEventListener('click', e => {
            const item = e.target.closest('.overview-search-item');
            if (!item) return;
            const target = item.dataset.target;
            if (target) activateTabByTarget(target);
            resultsEl.classList.add('hidden');
            input.value = '';
        });

        document.addEventListener('click', e => {
            if (!input.contains(e.target) && !resultsEl.contains(e.target)) {
                resultsEl.classList.add('hidden');
            }
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { resultsEl.classList.add('hidden'); input.blur(); }
        });
    }

    async function loadOverview() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const period      = overviewPeriodSelect?.value || 'this_week';
            const periodRange = getPeriodDateRange(period);
            const periodLabel = { this_week: 'This Week', last_week: 'Last Week', this_month: 'This Month', last_month: 'Last Month' }[period] || '';
            const attPeriodEl = document.getElementById('overview-attendance-period-label');
            const actPeriodEl = document.getElementById('daily-activity-period-label');
            if (attPeriodEl) attPeriodEl.textContent = periodLabel;
            if (actPeriodEl) actPeriodEl.textContent = periodLabel;

            const [attendanceResponse, equipmentResponse, usersResponse, inquiriesResponse, filesResponse] = await Promise.all([
                fetch(API_BASE + '/api/attendance', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(API_BASE + '/api/equipment', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(API_BASE + '/api/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(API_BASE + '/api/inquiries', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(API_BASE + '/api/files', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            let allAttendance = [], allEquipment = [], allUsers = [], allInquiries = [];

            // --- Attendance ---
            const clockedInEmployeesBody      = document.getElementById('clocked-in-employees-body');
            const activeEmployeesCount        = document.getElementById('active-employees-count');
            const clockedInBadge              = document.getElementById('clocked-in-badge');
            const attendanceActionsTodayCount = document.getElementById('attendance-actions-today-count');

            if (attendanceResponse.ok) {
                const data = await attendanceResponse.json();
                allAttendance = data.attendance || [];

                const today = new Date(); today.setHours(0, 0, 0, 0);
                const todayLogs = allAttendance.filter(log => {
                    const d = new Date(log.timestamp); d.setHours(0, 0, 0, 0);
                    return d.getTime() === today.getTime();
                });
                const userLatestLog = {};
                todayLogs.forEach(log => {
                    if (!userLatestLog[log.user_id] || new Date(log.timestamp) > new Date(userLatestLog[log.user_id].timestamp)) {
                        userLatestLog[log.user_id] = log;
                    }
                });
                const clockedInUsers = Object.values(userLatestLog).filter(l => l.action === 'clock_in');
                if (activeEmployeesCount)        activeEmployeesCount.textContent        = clockedInUsers.length;
                if (attendanceActionsTodayCount) attendanceActionsTodayCount.textContent = todayLogs.length;
                if (clockedInBadge)              clockedInBadge.textContent              = clockedInUsers.length;

                if (clockedInEmployeesBody) {
                    clockedInEmployeesBody.innerHTML = clockedInUsers.length
                        ? clockedInUsers.map(log => {
                              const t = new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                              return `<tr><td>${escapeHtml(log.user?.full_name || 'Unknown')}</td><td>${t}</td></tr>`;
                          }).join('')
                        : `<tr><td colspan="2" class="overview-empty-cell">No employees currently clocked in</td></tr>`;
                }

                buildAttendanceBars(allAttendance, periodRange);

                const dailyContainer = document.getElementById('daily-activity-chart');
                if (dailyContainer) {
                    const { start: pS, end: pE, labels: pL, daysCount, isWeekly } = periodRange;
                    const dayCounts = new Array(daysCount).fill(0);
                    allAttendance.forEach(log => {
                        if (log.action !== 'clock_in') return;
                        const ts = new Date(log.timestamp);
                        if (ts < pS || ts > pE) return;
                        const idx = isWeekly ? (ts.getDay() === 0 ? 6 : ts.getDay() - 1) : ts.getDate() - 1;
                        if (idx >= 0 && idx < daysCount) dayCounts[idx]++;
                    });
                    renderSvgLineChart(dailyContainer, [{ values: dayCounts, color: '#2dad50' }], pL);
                }
            } else {
                if (activeEmployeesCount)    activeEmployeesCount.textContent = 'â€”';
                if (clockedInEmployeesBody)  clockedInEmployeesBody.innerHTML = `<tr><td colspan="2" class="overview-error-cell">Unable to load attendance data</td></tr>`;
            }

            // --- Equipment ---
            const equipmentDeployedCount = document.getElementById('equipment-deployed-count');
            const totalEquipmentCount    = document.getElementById('total-equipment-count');
            const equipmentStatusChart   = document.getElementById('equipment-status-chart');
            const equipmentStatusTotal   = document.getElementById('equipment-status-total');
            const equipmentStatusLegend  = document.getElementById('equipment-status-legend');

            if (equipmentResponse.ok) {
                const data = await equipmentResponse.json();
                allEquipment = data.equipment || [];
                const deployed = allEquipment.filter(e => (e.status || '').toLowerCase().includes('checked out'));
                if (equipmentDeployedCount) equipmentDeployedCount.textContent = deployed.length;
                if (totalEquipmentCount)    totalEquipmentCount.textContent    = allEquipment.length;

                const sc = { inUse: 0, maintenance: 0, outOfOrder: 0 };
                allEquipment.forEach(e => {
                    const s = (e.status || '').toLowerCase();
                    if (s.includes('checked out') || s.includes('in use') || s.includes('deployed')) sc.inUse++;
                    else if (s.includes('maintenance')) sc.maintenance++;
                    else if (s.includes('out of order') || s.includes('out of service') || s.includes('damaged') || s.includes('defective')) sc.outOfOrder++;
                });
                const tot      = allEquipment.length || 1;
                const inUsePct = Math.round(sc.inUse      / tot * 100);
                const maintPct = Math.round(sc.maintenance / tot * 100);
                const outPct   = Math.round(sc.outOfOrder  / tot * 100);
                const availPct = Math.max(0, 100 - inUsePct - maintPct - outPct);

                if (equipmentStatusTotal) equipmentStatusTotal.textContent = allEquipment.length;
                if (equipmentStatusChart) {
                    equipmentStatusChart.style.setProperty('--in-use',     inUsePct);
                    equipmentStatusChart.style.setProperty('--maintenance', maintPct);
                    equipmentStatusChart.style.setProperty('--out-order',   outPct);
                }
                if (equipmentStatusLegend) {
                    equipmentStatusLegend.innerHTML = [
                        { label: 'Available',      pct: availPct, cls: 'available' },
                        { label: 'In Use',         pct: inUsePct, cls: 'green' },
                        { label: 'Maintenance',    pct: maintPct, cls: 'amber' },
                        { label: 'Out of Service', pct: outPct,   cls: 'red' },
                    ].map(r => `<div class="equipment-status-legend-row">
                        <div class="legend-label"><span class="legend-dot ${r.cls}"></span><span>${r.label}</span></div>
                        <strong>${r.pct}%</strong>
                    </div>`).join('');
                }
            } else {
                if (equipmentDeployedCount) equipmentDeployedCount.textContent = 'â€”';
                if (totalEquipmentCount)    totalEquipmentCount.textContent    = 'â€”';
            }

            // --- Users ---
            const totalUsersCount = document.getElementById('total-users-count');
            if (usersResponse.ok) {
                const data = await usersResponse.json();
                allUsers = data.users || [];
                if (totalUsersCount) totalUsersCount.textContent = allUsers.length;
            } else {
                if (totalUsersCount) totalUsersCount.textContent = 'â€”';
            }

            // --- Inquiries ---
            const inquiriesPendingCount = document.getElementById('inquiries-pending-count');
            const inquiriesTotalCount   = document.getElementById('inquiries-total-count');
            if (inquiriesResponse.ok) {
                const data = await inquiriesResponse.json();
                allInquiries = data.inquiries || [];
                const pending = allInquiries.filter(i => i.status === 'Pending' || i.status === 'In Progress').length;
                if (inquiriesPendingCount) inquiriesPendingCount.textContent = pending;
                if (inquiriesTotalCount)   inquiriesTotalCount.textContent   = allInquiries.length;
                buildInquiryBreakdown(allInquiries);
                buildRecentInquiries(allInquiries);
            } else {
                if (inquiriesPendingCount) inquiriesPendingCount.textContent = 'â€”';
                if (inquiriesTotalCount)   inquiriesTotalCount.textContent   = 'â€”';
            }

            // --- Files ---
            const overviewFilesCount  = document.getElementById('overview-files-count');
            const activeProjectsCount = document.getElementById('active-projects-count');
            if (filesResponse.ok) {
                const data = await filesResponse.json();
                const files = data.files || [];
                if (overviewFilesCount)  overviewFilesCount.textContent  = files.length;
                if (activeProjectsCount) activeProjectsCount.textContent = files.length;
            } else {
                if (overviewFilesCount)  overviewFilesCount.textContent  = 'â€”';
                if (activeProjectsCount) activeProjectsCount.textContent = 'â€”';
            }

            // Cache for search
            overviewDataCache = { users: allUsers, equipment: allEquipment, inquiries: allInquiries };

        } catch (error) {
            console.error('Error loading overview data:', error);
            const errEl = document.getElementById('clocked-in-employees-body');
            if (errEl) errEl.innerHTML = `<tr><td colspan="2" class="overview-error-cell">Connection Error</td></tr>`;
        }
    }

    // Load overview and users on page load
    loadOverview();
    loadUsers();
    loadNotificationFeed();
    initializeGenericTablePaginationObservers();
    setTimeout(() => {
        refreshAllTablePaginations({ captureFromDom: true, onlyVisible: false });
    }, 50);

    window.addEventListener('resize', () => {
        if (genericPaginationResizeTimer) {
            clearTimeout(genericPaginationResizeTimer);
        }
        genericPaginationResizeTimer = setTimeout(() => {
            refreshAllTablePaginations({ captureFromDom: false, onlyVisible: true });
        }, 120);
    });

    // Auto-refresh overview data every 10 seconds
    setInterval(() => {
        const overviewTab = document.getElementById('overview-tab');
        // Only refresh if overview tab is currently visible
        if (overviewTab && !overviewTab.classList.contains('hidden')) {
            loadOverview();
        }
    }, 10000); // Refresh every 10 seconds

    // Keep topbar notification badge and list current.
    setInterval(() => {
        loadNotificationFeed();
    }, 30000);

    // Event delegation for View/Edit buttons
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.view-edit-user-btn');
        if (button) {
            const userId = button.getAttribute('data-user-id');
            console.log('[Admin Dashboard] View/Edit button clicked! User ID:', userId);
            if (userId) {
                window.viewUserPermissions(parseInt(userId));
            }
        }
    });

    // --- EDIT USER PERMISSIONS MODAL ---
    const editUserModal = document.getElementById('edit-user-modal');
    const closeEditUserModalBtns = document.querySelectorAll('#close-edit-user-modal-btn, #cancel-edit-user-modal-btn');
    const editUserFullnameInput = document.getElementById('edit-user-fullname-input');
    const editUserEmailInput = document.getElementById('edit-user-email-input');
    const editUserContactInput = document.getElementById('edit-user-contact-input');
    const editDetailsSection = document.getElementById('edit-details-section');
    const editCredentialsSection = document.getElementById('edit-credentials-section');
    const editUserPasswordInput = document.getElementById('edit-user-password');
    const editUserPasswordConfirmInput = document.getElementById('edit-user-password-confirm');
    const editUserPasswordToggleBtn = document.getElementById('edit-user-password-toggle');
    const editUserPasswordConfirmToggleBtn = document.getElementById('edit-user-password-confirm-toggle');
    const editPasswordRuleLength = document.getElementById('edit-password-rule-length');
    const editPasswordRuleUppercase = document.getElementById('edit-password-rule-uppercase');
    const editPasswordRuleLowercase = document.getElementById('edit-password-rule-lowercase');
    const editPasswordRuleNumber = document.getElementById('edit-password-rule-number');
    const editPasswordRuleSpecial = document.getElementById('edit-password-rule-special');
    const editPasswordRuleMatch = document.getElementById('edit-password-rule-match');

    configurePasswordToggle(editUserPasswordInput, editUserPasswordToggleBtn, 'password');
    configurePasswordToggle(editUserPasswordConfirmInput, editUserPasswordConfirmToggleBtn, 'confirm password');

    if (editUserPasswordInput) {
        editUserPasswordInput.addEventListener('input', updateEditPasswordRequirementStates);
        editUserPasswordInput.addEventListener('change', updateEditPasswordRequirementStates);
    }

    if (editUserPasswordConfirmInput) {
        editUserPasswordConfirmInput.addEventListener('input', updateEditPasswordRequirementStates);
        editUserPasswordConfirmInput.addEventListener('change', updateEditPasswordRequirementStates);
    }

    updateEditPasswordRequirementStates();
    
    closeEditUserModalBtns.forEach(btn => btn.addEventListener('click', () => editUserModal.classList.add('hidden')));
    
    // Close modal when clicking outside
    editUserModal.addEventListener('click', (e) => {
        if (e.target === editUserModal) {
            editUserModal.classList.add('hidden');
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !editUserModal.classList.contains('hidden')) {
            editUserModal.classList.add('hidden');
        }
    });

    function syncEditUserInfoPreview() {
        if (editUserFullnameInput) {
            const fullNameValue = String(editUserFullnameInput.value || '').trim();
            const fullNameEl = document.getElementById('edit-user-fullname');
            if (fullNameEl) fullNameEl.textContent = fullNameValue || '-';
        }
        if (editUserEmailInput) {
            const emailValue = String(editUserEmailInput.value || '').trim();
            const emailEl = document.getElementById('edit-user-email-value');
            if (emailEl) emailEl.textContent = emailValue || '-';
        }
    }

    if (editUserFullnameInput) {
        editUserFullnameInput.addEventListener('input', syncEditUserInfoPreview);
    }
    if (editUserEmailInput) {
        editUserEmailInput.addEventListener('input', syncEditUserInfoPreview);
    }
    
    // Permission categories structure
    const PERMISSION_CATEGORIES = {
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
            { value: 'can_delete_attendance', label: 'Delete Logs' }
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
            { value: 'can_manage_permissions', label: 'Manage Permissions' },
            { value: 'can_view_audit_trail', label: 'View Audit Trail' },
            { value: 'can_backup_database', label: 'Database Backups' }
        ],
        'Reports': [
            { value: 'can_view_reports', label: 'Access Reports Tab' },
            { value: 'can_export_attendance_report', label: 'Attendance Reports' },
            { value: 'can_export_equipment_report', label: 'Equipment Reports' },
            { value: 'can_export_inquiry_report', label: 'Inquiry Reports' },
            { value: 'can_export_files_report', label: 'Files Reports' }
        ]
    };
    
    // View/Edit User Permissions
    window.viewUserPermissions = async function(userId) {
        if (!canOpenUserEditor()) {
            showAlert('You do not have permission to edit user accounts.');
            return;
        }

        console.log('[Admin] viewUserPermissions called with userId:', userId);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('[Admin] ERROR: No auth token found');
                showAlert('No authentication token found. Please log in again.');
                return;
            }
            
            console.log('[Admin] Fetching user data from API...');
            // Fetch user details
            const response = await fetch(`${API_BASE}/api/users/${userId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('[Admin] ERROR: API Error:', error);
                showAlert(`ERROR: Failed to load user: ${error.error}`);
                return;
            }
            
            const userData = await response.json();
            const user = userData.user;
            const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
            const isEditingSelf = Number(user.user_id) === Number(currentUserData.user_id);
            
            console.log('[Admin Dashboard] User data loaded:', user.full_name);
            
            // Populate user info
            document.getElementById('edit-user-id').value = user.user_id;
            document.getElementById('edit-user-subtitle').textContent = isEditingSelf
                ? `${user.email} (own account: permission changes disabled)`
                : user.email;
            document.getElementById('edit-user-fullname').textContent = user.full_name;
            document.getElementById('edit-user-email-value').textContent = user.email;
            document.getElementById('edit-user-role-value').textContent = user.role;
            document.getElementById('edit-user-active').checked = user.is_active;
            if (editUserFullnameInput) editUserFullnameInput.value = user.full_name || '';
            if (editUserEmailInput) editUserEmailInput.value = user.email || '';
            if (editUserContactInput) editUserContactInput.value = user.contact_number || '';
            const editUserAvatar = document.getElementById('edit-user-avatar');
            const editUserAvatarImage = document.getElementById('edit-user-avatar-image');
            const hasProfilePhoto = Boolean(user.profile_photo);
            if (editUserAvatarImage) {
                editUserAvatarImage.src = hasProfilePhoto ? user.profile_photo : '';
            }
            if (editUserAvatar) {
                editUserAvatar.classList.toggle('has-image', hasProfilePhoto);
            }

            const canEditProfile = hasPermission('can_edit_users');
            if (editDetailsSection) editDetailsSection.classList.toggle('hidden', !canEditProfile);
            if (editCredentialsSection) editCredentialsSection.classList.toggle('hidden', !canEditProfile);
            if (editUserFullnameInput) editUserFullnameInput.disabled = !canEditProfile;
            if (editUserEmailInput) editUserEmailInput.disabled = !canEditProfile;
            if (editUserContactInput) editUserContactInput.disabled = !canEditProfile;
            if (editUserPasswordInput) editUserPasswordInput.disabled = !canEditProfile;
            if (editUserPasswordConfirmInput) editUserPasswordConfirmInput.disabled = !canEditProfile;

            if (editUserPasswordInput) editUserPasswordInput.value = '';
            if (editUserPasswordConfirmInput) editUserPasswordConfirmInput.value = '';
            if (editUserPasswordInput) editUserPasswordInput.type = 'password';
            if (editUserPasswordConfirmInput) editUserPasswordConfirmInput.type = 'password';
            if (editUserPasswordToggleBtn) {
                editUserPasswordToggleBtn.setAttribute('aria-pressed', 'false');
                editUserPasswordToggleBtn.setAttribute('aria-label', 'Show password');
                const icon = editUserPasswordToggleBtn.querySelector('i');
                if (icon) icon.className = 'bi bi-eye';
            }
            if (editUserPasswordConfirmToggleBtn) {
                editUserPasswordConfirmToggleBtn.setAttribute('aria-pressed', 'false');
                editUserPasswordConfirmToggleBtn.setAttribute('aria-label', 'Show confirm password');
                const icon = editUserPasswordConfirmToggleBtn.querySelector('i');
                if (icon) icon.className = 'bi bi-eye';
            }
            updateEditPasswordRequirementStates();
            
            // Store contact_number in a data attribute (not displayed in edit modal but needed for update)
            const editForm = document.getElementById('edit-user-form');
            editForm.dataset.contactNumber = user.contact_number || '';
            
            // Update status badge
            const statusBadge = document.getElementById('status-badge');
            if (statusBadge) {
                statusBadge.textContent = user.is_active ? 'Active' : 'Inactive';
                statusBadge.style.background = user.is_active ? '#d1fae5' : '#fee2e2';
                statusBadge.style.color = user.is_active ? '#065f46' : '#991b1b';
            }
            
            // Build permissions grid
            const permissionsGrid = document.getElementById('edit-permissions-grid');
            permissionsGrid.innerHTML = '';
            
            Object.keys(PERMISSION_CATEGORIES).forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'permission-category';
                
                const categoryTitle = document.createElement('h4');
                categoryTitle.className = 'category-title';
                categoryTitle.textContent = category;
                categoryDiv.appendChild(categoryTitle);
                
                const checkboxesDiv = document.createElement('div');
                checkboxesDiv.className = 'permission-checkboxes';
                
                PERMISSION_CATEGORIES[category].forEach(perm => {
                    const label = document.createElement('label');
                    label.className = 'checkbox-label';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'edit-permission';
                    checkbox.value = perm.value;
                    checkbox.checked = user[perm.value] || false;
                    checkbox.disabled = !hasPermission('can_manage_permissions') || isEditingSelf;
                    
                    const span = document.createElement('span');
                    span.textContent = perm.label;
                    
                    label.appendChild(checkbox);
                    label.appendChild(span);
                    checkboxesDiv.appendChild(label);
                });
                
                categoryDiv.appendChild(checkboxesDiv);
                permissionsGrid.appendChild(categoryDiv);
            });
            
            console.log('[Admin Dashboard] Permission grid built, showing modal...');
            // Show modal
            editUserModal.classList.remove('hidden');
            console.log('[Admin Dashboard] Modal should now be visible');

            const activeToggle = document.getElementById('edit-user-active');
            if (activeToggle) {
                activeToggle.disabled = !hasPermission('can_activate_users');
            }

            const deleteBtn = document.getElementById('delete-user-btn');
            if (deleteBtn) {
                deleteBtn.classList.toggle('hidden', !hasPermission('can_delete_users'));
            }

            const modalDangerZoneSection = document.querySelector('#edit-user-form .danger-zone-section');
            if (modalDangerZoneSection) {
                modalDangerZoneSection.classList.toggle('hidden', !hasPermission('can_delete_users'));
            }
            
            // Add event listener for status toggle
            const activeToggleInput = document.getElementById('edit-user-active');
            if (!activeToggleInput) return;

            // Remove previous listeners if any
            const newToggle = activeToggleInput.cloneNode(true);
            activeToggleInput.parentNode.replaceChild(newToggle, activeToggleInput);
            
            newToggle.addEventListener('change', function() {
                const badge = document.getElementById('status-badge');
                if (badge) {
                    badge.textContent = this.checked ? 'Active' : 'Inactive';
                    badge.style.background = this.checked ? '#d1fae5' : '#fee2e2';
                    badge.style.color = this.checked ? '#065f46' : '#991b1b';
                }
            });
            
        } catch (error) {
            console.error('Error loading user:', error);
            showAlert('ERROR: Failed to load user details. Please try again.');
        }
    };
    
    // Edit User Form Submission
    const editUserForm = document.getElementById('edit-user-form');
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!hasPermission('can_manage_permissions') && !hasPermission('can_activate_users') && !hasPermission('can_edit_users')) {
            showAlert('You do not have permission to update this user.');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const userId = document.getElementById('edit-user-id').value;
            const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
            const isEditingSelf = Number(userId) === Number(currentUserData.user_id);
            const isActive = document.getElementById('edit-user-active').checked;
            
            const canEditProfile = hasPermission('can_edit_users');
            // Get user data (need to preserve these fields)
            const fullName = canEditProfile
                ? String(editUserFullnameInput?.value || '').trim()
                : String(document.getElementById('edit-user-fullname').textContent || '').trim();
            const email = canEditProfile
                ? String(editUserEmailInput?.value || '').trim()
                : String(document.getElementById('edit-user-email-value').textContent || '').trim();
            const role = String(document.getElementById('edit-user-role-value').textContent || '').trim();
            const contactNumber = canEditProfile
                ? (String(editUserContactInput?.value || '').trim() || null)
                : (String(e.target.dataset.contactNumber || '').trim() || null);
            const newPassword = String(editUserPasswordInput?.value || '').trim();
            const confirmPassword = String(editUserPasswordConfirmInput?.value || '').trim();
            
            // Capture all permission checkboxes
            const permissions = {};
            const permissionCheckboxes = document.querySelectorAll('input[name=\"edit-permission\"]');
            permissionCheckboxes.forEach(checkbox => {
                permissions[checkbox.value] = checkbox.checked;
            });
            
            // List of ALL permissions in the system (must match database schema)
            const allPermissions = [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions', 'can_view_audit_trail', 'can_backup_database',
                'can_view_reports', 'can_export_attendance_report', 'can_export_equipment_report', 'can_export_inquiry_report', 'can_export_files_report'
            ];
            
            // Ensure ALL permissions are explicitly set (checked ones to true, unchecked to false)
            const completePermissions = {};
            allPermissions.forEach(perm => {
                completePermissions[perm] = permissions[perm] === true; // Convert undefined to false
            });
            
            if (canEditProfile) {
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

                if (contactNumber && !/^\+?[\d\s\-()]+$/.test(contactNumber)) {
                    showAlert('Contact number format is invalid.');
                    return;
                }

                if (newPassword || confirmPassword) {
                    const hasMinLength = newPassword.length >= 8;
                    const hasUppercase = /[A-Z]/.test(newPassword);
                    const hasLowercase = /[a-z]/.test(newPassword);
                    const hasNumber = /\d/.test(newPassword);
                    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

                    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
                        showAlert('Password must meet all requirements shown in the checklist.');
                        return;
                    }

                    if (newPassword !== confirmPassword) {
                        showAlert('Passwords do not match.');
                        return;
                    }
                }
            }

            const updateData = {
                full_name: fullName,
                email: email,
                contact_number: contactNumber,
                role: role,
                ...((hasPermission('can_manage_permissions') && !isEditingSelf) ? completePermissions : {})
            };

            if (hasPermission('can_activate_users')) {
                updateData.is_active = isActive;
            }

            if (canEditProfile && newPassword) {
                updateData.new_password = newPassword;
            }

            if (isEditingSelf && hasPermission('can_manage_permissions')) {
                showAlert('Note: You cannot change your own permission settings. Other profile changes can still be saved.');
            }
            
            console.log('Sending update data:', updateData);
            
            const response = await fetch(`${API_BASE}/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const result = await response.json();
                showAlert(`SUCCESS: User updated successfully!\n\nPermissions updated for ${result.user.email}`);
                if (isEditingSelf) {
                    const refreshedUser = { ...user, ...result.user };
                    localStorage.setItem('user', JSON.stringify(refreshedUser));
                    user = refreshedUser;
                    if (typeof renderProfileUserInfo === 'function') {
                        renderProfileUserInfo();
                    }
                    const welcomeMessage = document.getElementById('welcome-message');
                    if (welcomeMessage) {
                        welcomeMessage.textContent = `Welcome, ${user.full_name}`;
                    }
                }
                editUserModal.classList.add('hidden');
                loadUsers(); // Reload the user table
            } else {
                const error = await response.json();
                showAlert(`ERROR: Failed to update user:\n\n${error.error}`);
            }
            
        } catch (error) {
            console.error('Error updating user:', error);
            showAlert('ERROR: Failed to update user. Please try again.');
        }
    });

    // --- DELETE USER FUNCTIONALITY ---
    const deleteConfirmModal = document.getElementById('delete-confirm-modal');
    const deleteUserBtn = document.getElementById('delete-user-btn');
    const closeDeleteConfirmBtn = document.getElementById('close-delete-confirm-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteConfirmPassword = document.getElementById('delete-confirm-password');
    
    let userToDelete = null; // Store user info for deletion

    // Open delete confirmation modal
    deleteUserBtn.addEventListener('click', () => {
        if (!hasPermission('can_delete_users')) {
            showAlert('You do not have permission to delete users.');
            return;
        }

        const userId = document.getElementById('edit-user-id').value;
        const userName = document.getElementById('edit-user-fullname').textContent;
        const userEmail = document.getElementById('edit-user-email-value').textContent;
        
        // Store user info
        userToDelete = { userId, userName, userEmail };
        
        // Populate confirmation modal
        document.getElementById('delete-user-name').textContent = userName;
        document.getElementById('delete-user-email').textContent = userEmail;
        deleteConfirmPassword.value = '';
        
        // Show confirmation modal
        deleteConfirmModal.classList.remove('hidden');
    });

    // Close delete confirmation modal
    const closeDeleteModal = () => {
        deleteConfirmModal.classList.add('hidden');
        deleteConfirmPassword.value = '';
        userToDelete = null;
    };

    closeDeleteConfirmBtn.addEventListener('click', closeDeleteModal);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !deleteConfirmModal.classList.contains('hidden')) {
            closeDeleteModal();
        }
    });

    // Close on outside click
    deleteConfirmModal.addEventListener('click', (e) => {
        if (e.target === deleteConfirmModal) {
            closeDeleteModal();
        }
    });

    // Confirm delete with password verification
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!hasPermission('can_delete_users')) {
            showAlert('You do not have permission to delete users.');
            closeDeleteModal();
            return;
        }

        const password = deleteConfirmPassword.value.trim();
        
        if (!password) {
            showAlert('ERROR: Please enter your password to confirm deletion.');
            deleteConfirmPassword.focus();
            return;
        }

        if (!userToDelete) {
            showAlert('ERROR: No user selected for deletion.');
            closeDeleteModal();
            return;
        }

        // Disable button during processing
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<span>â³ Verifying...</span>';

        try {
            const token = localStorage.getItem('token');
            
            // Step 1: Verify admin password
            const verifyResponse = await fetch(API_BASE + '/api/verify-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });

            if (!verifyResponse.ok) {
                const error = await verifyResponse.json();
                showAlert(`ERROR: Password Verification Failed\n\n${error.error || 'Incorrect password'}`);
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.innerHTML = '<span><i class="bi bi-archive"></i> Move To Archive</span>';
                deleteConfirmPassword.value = '';
                deleteConfirmPassword.focus();
                return;
            }

            // Step 2: Delete the user
            confirmDeleteBtn.innerHTML = '<span>â³ Deleting...</span>';
            
            const deleteResponse = await fetch(`${API_BASE}/api/users/${userToDelete.userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (deleteResponse.ok) {
                showAlert(`SUCCESS: User Archived Successfully!\n\n${userToDelete.userName} was removed from active records and preserved in the Archives tab.`);
                
                // Close both modals
                closeDeleteModal();
                editUserModal.classList.add('hidden');
                
                // Reload user table
                loadUsers();
            } else {
                const error = await deleteResponse.json();
                showAlert(`ERROR: Failed to Delete User\n\n${error.error || 'An error occurred'}`);
            }

        } catch (error) {
            console.error('Delete user error:', error);
            showAlert('ERROR: Network Error\n\nFailed to delete user. Please check your connection and try again.');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.innerHTML = '<span><i class="bi bi-archive"></i> Move To Archive</span>';
        }
    });

    // --- 6. SYSTEM HEALTH MONITORING BUTTONS ---
    const triggerBackupBtn = document.getElementById('trigger-backup-btn');
    const exportLogsBtn = document.getElementById('export-logs-btn');
    const serverUptimeEl = document.getElementById('server-uptime');
    const dbStatusEl = document.getElementById('db-status');
    const lastBackupEl = document.getElementById('last-backup');
    const activeUsersEl = document.getElementById('active-users');
    const backupTableBody = document.getElementById('backup-table-body');
    const siemFailedLoginsEl = document.getElementById('siem-failed-logins');
    const siemUnauthorizedEl = document.getElementById('siem-unauthorized');
    const siemEquipmentAnomaliesEl = document.getElementById('siem-equipment-anomalies');
    const siemAlertsBody = document.getElementById('siem-alerts-body');
    const siemSeverityFilter = document.getElementById('siem-severity-filter');
    const siemEventFilter = document.getElementById('siem-event-filter');
    const siemTimeFilter = document.getElementById('siem-time-filter');
    const siemFilterResetBtn = document.getElementById('siem-filter-reset-btn');
    const siemLogsScroll = document.getElementById('siem-logs-scroll');
    const siemPagination = document.getElementById('siem-pagination');
    const backupLogsScroll = document.getElementById('backup-logs-scroll');
    const backupPagination = document.getElementById('backup-pagination');
    const activityTableBody = document.getElementById('activity-table-body');
    const activityEventFilter = document.getElementById('activity-event-filter');
    const activityDateFilter = document.getElementById('activity-date-filter');
    const activitySearchInput = document.getElementById('activity-search-input');
    const activityFilterResetBtn = document.getElementById('activity-filter-reset-btn');
    const activityLogsScroll = document.getElementById('activity-logs-scroll');
    const activityPagination = document.getElementById('activity-pagination');
    const healthSubtabButtons = document.querySelectorAll('.health-subtab-btn');
    const healthSubtabShells = document.querySelectorAll('.health-subtab-shell');

    const HEALTH_PAGE_SIZE = 15;
    const healthPaginationState = {
        siem: 1,
        backup: 1,
        activity: 1
    };

    let siemAlertsCache = [];
    let activityLogsCache = [];
    let backupHistoryCache = [];
    let filteredSiemAlertsCache = [];
    let filteredActivityLogsCache = [];

    function setScrollableState(scrollElement, totalItems) {
        if (!scrollElement) return;
        const shouldScroll = Number(totalItems || 0) > HEALTH_PAGE_SIZE;
        scrollElement.classList.toggle('is-scrollable', shouldScroll);
    }

    function getPageSlice(items, key) {
        const list = Array.isArray(items) ? items : [];
        const totalPages = Math.max(1, Math.ceil(list.length / HEALTH_PAGE_SIZE));
        const current = Math.min(Math.max(healthPaginationState[key] || 1, 1), totalPages);
        healthPaginationState[key] = current;
        const startIndex = (current - 1) * HEALTH_PAGE_SIZE;
        return {
            rows: list.slice(startIndex, startIndex + HEALTH_PAGE_SIZE),
            current,
            totalPages,
            totalItems: list.length,
            startNumber: list.length === 0 ? 0 : startIndex + 1,
            endNumber: Math.min(startIndex + HEALTH_PAGE_SIZE, list.length)
        };
    }

    function renderTablePagination(container, key, totalItems, onNavigate) {
        if (!container) return;

        const totalPages = Math.max(1, Math.ceil(Number(totalItems || 0) / HEALTH_PAGE_SIZE));
        const current = Math.min(Math.max(healthPaginationState[key] || 1, 1), totalPages);
        healthPaginationState[key] = current;

        if (totalItems <= 0 || totalPages <= 1) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }

        const startNumber = (current - 1) * HEALTH_PAGE_SIZE + 1;
        const endNumber = Math.min(current * HEALTH_PAGE_SIZE, totalItems);
        const prevDisabled = current <= 1 ? 'disabled' : '';
        const nextDisabled = current >= totalPages ? 'disabled' : '';

        const tokens = [];
        if (totalPages <= 7) {
            for (let page = 1; page <= totalPages; page += 1) {
                tokens.push(page);
            }
        } else {
            tokens.push(1);
            const start = Math.max(2, current - 1);
            const end = Math.min(totalPages - 1, current + 1);

            if (start > 2) tokens.push('ellipsis-start');
            for (let page = start; page <= end; page += 1) {
                tokens.push(page);
            }
            if (end < totalPages - 1) tokens.push('ellipsis-end');
            tokens.push(totalPages);
        }

        const pageButtons = tokens.map((token) => {
            if (typeof token !== 'number') {
                return '<span class="table-page-ellipsis">...</span>';
            }
            const activeClass = token === current ? 'active-page' : '';
            return `<button type="button" class="table-page-btn table-page-num ${activeClass}" data-page-number="${token}" aria-label="Go to page ${token}">${token}</button>`;
        }).join('');

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="table-pagination-meta">Showing ${startNumber}-${endNumber} of ${totalItems}</div>
            <div class="table-pagination-controls">
                <button type="button" class="table-page-btn" data-page-action="prev" ${prevDisabled}>Previous</button>
                <div class="table-page-numbers">${pageButtons}</div>
                <span class="table-page-indicator">Page ${current} of ${totalPages}</span>
                <button type="button" class="table-page-btn" data-page-action="next" ${nextDisabled}>Next</button>
            </div>
        `;

        container.querySelectorAll('[data-page-action]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-page-action');
                if (action === 'prev' && healthPaginationState[key] > 1) {
                    healthPaginationState[key] -= 1;
                    onNavigate();
                }
                if (action === 'next' && healthPaginationState[key] < totalPages) {
                    healthPaginationState[key] += 1;
                    onNavigate();
                }
            });
        });

        container.querySelectorAll('[data-page-number]').forEach((button) => {
            button.addEventListener('click', () => {
                const targetPage = Number(button.getAttribute('data-page-number') || 1);
                if (!Number.isFinite(targetPage)) return;
                if (healthPaginationState[key] === targetPage) return;
                healthPaginationState[key] = targetPage;
                onNavigate();
            });
        });
    }

    function resetHealthSearch() {
        if (!healthSearchInput) return;
        healthSearchInput.value = '';
        healthSearchInput.defaultValue = '';
    }

    function setActiveHealthSubtab(targetShellId) {
        if (!targetShellId) return;

        healthSubtabButtons.forEach((button) => {
            const isActive = button.dataset.healthShell === targetShellId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        healthSubtabShells.forEach((shell) => {
            const shouldShow = shell.id === targetShellId;
            shell.classList.toggle('health-subtab-hidden', !shouldShow);
            shell.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        });
    }

    function syncHealthSubtabsWithPermissions() {
        if (healthSubtabButtons.length === 0 || healthSubtabShells.length === 0) return;

        const visibleButtons = [];
        healthSubtabButtons.forEach((button) => {
            const shellId = button.dataset.healthShell || '';
            const shell = document.getElementById(shellId);
            const allowed = !!shell && !shell.classList.contains('hidden');
            button.classList.toggle('hidden', !allowed);
            if (allowed) {
                visibleButtons.push(button);
            }
        });

        if (visibleButtons.length === 0) return;

        const activeVisible = visibleButtons.find((button) => button.classList.contains('active'));
        const target = activeVisible || visibleButtons[0];
        setActiveHealthSubtab(target.dataset.healthShell || '');
    }

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

    function renderBackupTable(backups) {
        if (!backupTableBody) return;

        if (!backups || backups.length === 0) {
            backupTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:24px; color:#9ca3af;">No backup history yet</td>
                </tr>
            `;
            return;
        }

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

        lockGenericTableColumnWidths(backupTableBody.closest('table'));
    }

    function renderBackupPage() {
        const page = getPageSlice(backupHistoryCache, 'backup');
        renderBackupTable(page.rows);
        setScrollableState(backupLogsScroll, page.totalItems);
        renderTablePagination(backupPagination, 'backup', page.totalItems, renderBackupPage);
    }

    function renderSiemPage() {
        const page = getPageSlice(filteredSiemAlertsCache, 'siem');
        renderSiemAlerts(page.rows);
        setScrollableState(siemLogsScroll, page.totalItems);
        renderTablePagination(siemPagination, 'siem', page.totalItems, () => applySiemFilters(true));
    }

    function renderActivityPage() {
        const page = getPageSlice(filteredActivityLogsCache, 'activity');
        renderActivityLogsTable(page.rows);
        setScrollableState(activityLogsScroll, page.totalItems);
        renderTablePagination(activityPagination, 'activity', page.totalItems, () => applyActivityLogFilters(true));
    }

    function populateActivityEventFilter(logs) {
        if (!activityEventFilter) return;

        const events = Array.from(new Set((logs || []).map(l => l.event_type).filter(Boolean))).sort();
        activityEventFilter.innerHTML = `<option value="ALL">All Activities</option>${events.map(evt => `<option value="${escapeHtml(evt)}">${escapeHtml(evt)}</option>`).join('')}`;
    }

    function renderActivityLogsTable(logs) {
        if (!activityTableBody) return;

        if (!logs || logs.length === 0) {
            activityTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No activity logs found for current filters</td>
                </tr>
            `;
            return;
        }

        activityTableBody.innerHTML = logs.slice(0, 300).map(log => {
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

        lockGenericTableColumnWidths(activityTableBody.closest('table'));
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
            siemAlertsBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No security alerts in the last 24 hours</td>
                </tr>
            `;
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

        lockGenericTableColumnWidths(siemAlertsBody.closest('table'));
    }

    function populateSiemEventFilter(alerts) {
        if (!siemEventFilter) return;

        const events = Array.from(new Set((alerts || []).map(a => a.event_type).filter(Boolean))).sort();
        siemEventFilter.innerHTML = `<option value="ALL">All Events</option>${events.map(evt => `<option value="${escapeHtml(evt)}">${escapeHtml(evt)}</option>`).join('')}`;
    }

    function applySiemFilters(preservePage = false) {
        const selectedSeverity = (siemSeverityFilter?.value || 'ALL').toLowerCase();
        const selectedEventType = (siemEventFilter?.value || 'ALL').trim();
        const selectedTime = (siemTimeFilter?.value || '24h').trim();

        const timeHours = {
            '1h': 1,
            '6h': 6,
            '12h': 12,
            '24h': 24
        };
        const cutoffHours = timeHours[selectedTime] || 24;
        const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000);

        filteredSiemAlertsCache = siemAlertsCache.filter(alert => {
            const severity = getSiemSeverity(alert);
            const matchesSeverity = selectedSeverity === 'all' || severity === selectedSeverity;
            const matchesEvent = selectedEventType === 'ALL' || (alert.event_type || '') === selectedEventType;

            const ts = new Date(alert.timestamp);
            const matchesTime = Number.isNaN(ts.getTime()) ? false : ts >= cutoff;

            return matchesSeverity && matchesEvent && matchesTime;
        });
        if (!preservePage) {
            healthPaginationState.siem = 1;
        }
        renderSiemPage();
    }

    function resetSiemFilters(event) {
        if (event) event.preventDefault();
        if (siemSeverityFilter) siemSeverityFilter.value = 'ALL';
        if (siemEventFilter) siemEventFilter.value = 'ALL';
        if (siemTimeFilter) siemTimeFilter.value = '24h';
        applySiemFilters();
    }

    function applyActivityLogFilters(preservePage = false) {
        const eventType = (activityEventFilter?.value || 'ALL').trim();
        const dateValue = (activityDateFilter?.value || '').trim();
        const query = (activitySearchInput?.value || '').trim().toLowerCase();

        filteredActivityLogsCache = activityLogsCache.filter(log => {
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
        if (!preservePage) {
            healthPaginationState.activity = 1;
        }
        renderActivityPage();
    }

    function resetActivityLogFilters(event) {
        if (event) event.preventDefault();
        if (activityEventFilter) activityEventFilter.value = 'ALL';
        if (activityDateFilter) activityDateFilter.value = '';
        if (activitySearchInput) activitySearchInput.value = '';
        applyActivityLogFilters();
    }

    async function loadSystemHealthTab() {
        syncHealthSubtabsWithPermissions();

        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');
        const canViewHealth = canViewHealthLogs || canViewAuditTrail;
        if (!canViewHealth) {
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view security alerts.</td>
                    </tr>
                `;
            }
            if (siemPagination) {
                siemPagination.innerHTML = '';
                siemPagination.classList.add('hidden');
            }
            if (activityTableBody) {
                activityTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view audit activity logs.</td>
                    </tr>
                `;
            }
            if (activityPagination) {
                activityPagination.innerHTML = '';
                activityPagination.classList.add('hidden');
            }
            if (backupPagination) {
                backupPagination.innerHTML = '';
                backupPagination.classList.add('hidden');
            }
            return;
        }

        try {
            const summaryRequest = canViewHealthLogs
                ? fetch(API_BASE + '/api/system/summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                : Promise.resolve(null);

            const [summaryResponse, activityLogsResponse] = await Promise.all([
                summaryRequest,
                fetch(API_BASE + '/api/system/activity-logs?limit=300', {
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

                if (lastBackupEl) {
                    lastBackupEl.textContent = summary.last_backup?.relative || 'No backups yet';
                }

                if (activeUsersEl) {
                    activeUsersEl.textContent = Number(summary.active_users || 0);
                }

                const securityMonitoring = summary.security_monitoring || {};
                if (siemFailedLoginsEl) {
                    siemFailedLoginsEl.textContent = Number(securityMonitoring.failed_login_attempts_24h || 0);
                }
                if (siemUnauthorizedEl) {
                    siemUnauthorizedEl.textContent = Number(securityMonitoring.unauthorized_access_attempts_24h || 0);
                }
                if (siemEquipmentAnomaliesEl) {
                    siemEquipmentAnomaliesEl.textContent = Number(securityMonitoring.abnormal_equipment_activity_24h || 0);
                }
                siemAlertsCache = securityMonitoring.latest_alerts || [];
                populateSiemEventFilter(siemAlertsCache);
                applySiemFilters();

                if (backupTableBody) {
                    backupHistoryCache = summary.backup_history || [];
                    healthPaginationState.backup = 1;
                    renderBackupPage();
                }
            }

            if (activityLogsResponse.ok && activityTableBody) {
                const activityData = await activityLogsResponse.json();
                const logs = activityData.logs || [];
                activityLogsCache = logs;
                populateActivityEventFilter(activityLogsCache);
                applyActivityLogFilters();
            } else if (activityTableBody) {
                const message = activityLogsResponse && activityLogsResponse.status === 403
                    ? 'You do not have permission to view activity logs.'
                    : 'Failed to load activity logs';
                activityTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">${message}</td>
                    </tr>
                `;
                if (activityPagination) {
                    activityPagination.innerHTML = '';
                    activityPagination.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('System health load error:', error);
            if (backupTableBody) {
                backupTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Failed to load backup history</td>
                    </tr>
                `;
                if (backupPagination) {
                    backupPagination.innerHTML = '';
                    backupPagination.classList.add('hidden');
                }
            }
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load security alerts</td>
                    </tr>
                `;
                if (siemPagination) {
                    siemPagination.innerHTML = '';
                    siemPagination.classList.add('hidden');
                }
            }
            if (activityTableBody) {
                activityTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load activity logs</td>
                    </tr>
                `;
                if (activityPagination) {
                    activityPagination.innerHTML = '';
                    activityPagination.classList.add('hidden');
                }
            }
        }
    }

    if (activityEventFilter) {
        activityEventFilter.addEventListener('change', applyActivityLogFilters);
    }
    if (activityDateFilter) {
        activityDateFilter.addEventListener('change', applyActivityLogFilters);
    }
    if (activitySearchInput) {
        activitySearchInput.addEventListener('input', applyActivityLogFilters);
    }
    if (activityFilterResetBtn) {
        activityFilterResetBtn.addEventListener('click', resetActivityLogFilters);
    }
    if (siemSeverityFilter) {
        siemSeverityFilter.addEventListener('change', applySiemFilters);
    }
    if (siemEventFilter) {
        siemEventFilter.addEventListener('change', applySiemFilters);
    }
    if (siemTimeFilter) {
        siemTimeFilter.addEventListener('change', applySiemFilters);
    }
    if (siemFilterResetBtn) {
        siemFilterResetBtn.addEventListener('click', resetSiemFilters);
    }

    healthSubtabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetShellId = button.dataset.healthShell || '';
            setActiveHealthSubtab(targetShellId);
        });
    });

    document.querySelectorAll('.inquiry-subtab-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const targetShellId = button.dataset.inquiryShell || '';
            setActiveInquirySubtab(targetShellId);
        });
    });

    document.querySelectorAll('.attendance-subtab-btn').forEach((button) => {
        button.addEventListener('click', () => {
            const targetShellId = button.dataset.attendanceShell || '';
            setActiveAttendanceSubtab(targetShellId);
            setTimeout(() => refreshAllTablePaginations({ onlyVisible: true, captureFromDom: true }), 60);
        });
    });

    syncInquirySubtabsWithPermissions();
    syncAttendanceSubtabsWithPermissions();

    // Fallback binding in case the button is re-rendered later.
    if (triggerBackupBtn) {
        triggerBackupBtn.addEventListener('click', async () => {
            if (!hasPermission('can_backup_database')) {
                showAlert('You do not have permission to trigger database backups.');
                return;
            }

            try {
                triggerBackupBtn.disabled = true;
                triggerBackupBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Running...';

                const response = await fetch(API_BASE + '/api/system/backup', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(data.error || 'Backup failed');
                }

                showAlert(`Backup completed.\n\nID: ${data.backup_id}\nSize: ${Number(data.size_mb || 0).toFixed(2)} MB\nStorage: ${data.storage || 'LOCAL_FTP'}`);
                await loadSystemHealthTab();
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

                const response = await fetch(API_BASE + '/api/system/export-logs', {
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
                exportLogsBtn.innerHTML = '<i class="bi bi-download"></i> Export Logs (CSV)';
            }
        });
    }

    // --- ARCHIVES TAB ---
    const archivesTableBody = document.getElementById('archives-table-body');
    const archivesEntityFilter = document.getElementById('archives-entity-filter');
    const archivesActorFilter = document.getElementById('archives-actor-filter');
    const archivesSearchInput = document.getElementById('archives-search-input');
    const archivesFilterResetBtn = document.getElementById('archives-filter-reset-btn');
    const archivesTotalRecordsEl = document.getElementById('archives-total-records');
    const archivesUniqueEntitiesEl = document.getElementById('archives-unique-entities');
    const archivesLastArchivedEl = document.getElementById('archives-last-archived');

    let archivesCache = [];

    function formatArchiveSnapshot(item = {}) {
        const payload = item.payload || {};
        const entity = String(item.entity_type || '').toUpperCase();

        if (!payload || typeof payload !== 'object') return '-';

        if (entity === 'EQUIPMENT') {
            const name = payload.name || 'Equipment';
            const qr = payload.qr_number ? `QR ${payload.qr_number}` : `ID ${payload.equipment_id || item.record_id || '-'}`;
            const status = payload.status || 'Unknown status';
            const condition = payload.condition || 'Unknown condition';
            return `${name} (${qr}) | ${status} | ${condition}`;
        }

        if (entity === 'USER') {
            const fullName = payload.full_name || 'Unknown user';
            const email = payload.email || 'No email';
            const role = payload.role || 'UNKNOWN';
            return `${fullName} | ${email} | ${role}`;
        }

        if (entity === 'ATTENDANCE_LOG') {
            const action = payload.action || 'Attendance action';
            const userId = payload.user_id ?? '-';
            const timestamp = payload.timestamp ? formatDateTime(payload.timestamp) : '-';
            return `${action} | user #${userId} | ${timestamp}`;
        }

        if (entity === 'PROJECT_FILE') {
            const fileName = payload.file_name || 'Unnamed file';
            const fileType = payload.file_type || 'Unknown type';
            const size = payload.file_size_mb != null ? `${Number(payload.file_size_mb).toFixed(2)} MB` : '-';
            return `${fileName} | ${fileType} | ${size}`;
        }

        if (entity === 'CLIENT_INQUIRY') {
            const client = payload.client_name || 'Unknown client';
            const email = payload.client_email || 'No email';
            const status = payload.status || 'Pending';
            return `${client} | ${email} | ${status}`;
        }

        if (entity === 'CONSTRUCTION_SITE') {
            const siteName = payload.site_name || 'Construction Site';
            const radius = payload.geo_fence_radius_meters != null ? `${payload.geo_fence_radius_meters}m` : '-';
            const active = payload.is_active ? 'Active' : 'Inactive';
            return `${siteName} | Radius ${radius} | ${active}`;
        }

        const keys = Object.keys(payload);
        if (keys.length === 0) return '-';

        const compactPreview = keys.slice(0, 3).map((key) => `${key}: ${String(payload[key])}`).join(' | ');
        return compactPreview;
    }

    function populateArchivesEntityFilter(items) {
        if (!archivesEntityFilter) return;

        const entities = Array.from(new Set((items || []).map(item => item.entity_type).filter(Boolean))).sort();
        archivesEntityFilter.innerHTML = `<option value="ALL">All Entities</option>${entities.map(entity => `<option value="${escapeHtml(entity)}">${escapeHtml(entity)}</option>`).join('')}`;
    }

    function renderArchivesStats(summary = {}) {
        if (archivesTotalRecordsEl) {
            archivesTotalRecordsEl.textContent = Number(summary.total_records || 0);
        }

        if (archivesUniqueEntitiesEl) {
            archivesUniqueEntitiesEl.textContent = Number(summary.unique_entities || 0);
        }

        if (archivesLastArchivedEl) {
            archivesLastArchivedEl.textContent = summary.last_archived_at
                ? formatDateTime(summary.last_archived_at)
                : '-';
        }
    }

    function renderArchivesTable(items) {
        if (!archivesTableBody) return;

        if (!items || items.length === 0) {
            archivesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">No archived records for current filters</td>
                </tr>
            `;
            return;
        }

        archivesTableBody.innerHTML = items.map((item) => {
            const actorName = item.deleted_by_name || item.deleted_by_email || 'System';
            const actorRole = item.deleted_by_role || 'SYSTEM';
            const snapshot = formatArchiveSnapshot(item);
            const snapshotTitle = JSON.stringify(item.payload || {}, null, 2);
            const roleBadgeClass = actorRole === 'ADMIN' ? 'success' : (actorRole === 'EMPLOYEE' ? 'warning' : '');

            return `
                <tr>
                    <td>${formatDateTime(item.deleted_at)}</td>
                    <td><span class="badge">${escapeHtml(item.entity_type || '-')}</span></td>
                    <td>${escapeHtml(String(item.record_id || '-'))}</td>
                    <td>${escapeHtml(item.source_table || '-')}</td>
                    <td>${escapeHtml(actorName)}</td>
                    <td><span class="badge ${roleBadgeClass}">${escapeHtml(actorRole)}</span></td>
                    <td>${escapeHtml(item.deleted_ip || '-')}</td>
                    <td><code class="archive-json-preview" title="${escapeHtml(snapshotTitle)}">${escapeHtml(snapshot)}</code></td>
                </tr>
            `;
        }).join('');
    }

    function applyArchivesFilters() {
        const selectedEntity = String(archivesEntityFilter?.value || 'ALL').trim().toUpperCase();
        const selectedActor = String(archivesActorFilter?.value || 'ALL').trim().toUpperCase();
        const search = String(archivesSearchInput?.value || '').trim().toLowerCase();

        const filtered = archivesCache.filter((item) => {
            const entity = String(item.entity_type || '').toUpperCase();
            const role = String(item.deleted_by_role || 'SYSTEM').toUpperCase();
            const actor = String(item.deleted_by_name || item.deleted_by_email || 'system').toLowerCase();
            const sourceTable = String(item.source_table || '').toLowerCase();
            const recordId = String(item.record_id || '').toLowerCase();
            const payloadText = JSON.stringify(item.payload || {}).toLowerCase();

            const matchesEntity = selectedEntity === 'ALL' || entity === selectedEntity;
            const matchesActor = selectedActor === 'ALL'
                || (selectedActor === 'SYSTEM' ? !item.deleted_by_user_id : role === selectedActor);
            const matchesSearch = !search
                || actor.includes(search)
                || sourceTable.includes(search)
                || recordId.includes(search)
                || payloadText.includes(search);

            return matchesEntity && matchesActor && matchesSearch;
        });

        renderArchivesTable(filtered);
        renderArchivesStats({
            total_records: filtered.length,
            unique_entities: new Set(filtered.map(item => item.entity_type)).size,
            last_archived_at: filtered.length > 0 ? filtered[0].deleted_at : null
        });
    }

    async function loadArchivesTab() {
        if (!archivesTableBody) return;

        if (!hasPermission('can_view_audit_trail')) {
            archivesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view archived records.</td>
                </tr>
            `;
            renderArchivesStats({ total_records: 0, unique_entities: 0, last_archived_at: null });
            return;
        }

        archivesTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:24px; color:#6b7280;">Loading archive records...</td>
            </tr>
        `;

        try {
            const response = await fetch(API_BASE + '/api/archives?limit=500', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load archives');
            }

            archivesCache = data.archives || [];
            populateArchivesEntityFilter(archivesCache);
            renderArchivesStats(data.summary || {});
            applyArchivesFilters();
        } catch (error) {
            console.error('Load archives error:', error);
            archivesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:24px; color:#ef4444;">Failed to load archives: ${escapeHtml(error.message)}</td>
                </tr>
            `;
            renderArchivesStats({ total_records: 0, unique_entities: 0, last_archived_at: null });
        }
    }

    if (archivesEntityFilter) {
        archivesEntityFilter.addEventListener('change', applyArchivesFilters);
    }

    if (archivesActorFilter) {
        archivesActorFilter.addEventListener('change', applyArchivesFilters);
    }

    if (archivesSearchInput) {
        archivesSearchInput.addEventListener('input', applyArchivesFilters);
    }

    if (archivesFilterResetBtn) {
        archivesFilterResetBtn.addEventListener('click', (event) => {
            event.preventDefault();
            if (archivesEntityFilter) archivesEntityFilter.value = 'ALL';
            if (archivesActorFilter) archivesActorFilter.value = 'ALL';
            if (archivesSearchInput) archivesSearchInput.value = '';
            applyArchivesFilters();
        });
    }
});



