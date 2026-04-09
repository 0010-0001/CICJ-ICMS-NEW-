document.addEventListener('DOMContentLoaded', async () => {
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
    
    // --- 2. FETCH FRESH PERMISSIONS FROM SERVER ---
    async function refreshUserPermissions() {
        // Pull latest permissions so UI reflects server truth, not stale local cache.
        console.log('[Admin Dashboard] Fetching fresh permissions from server...');
        try {
            const response = await fetch('http://localhost:5000/api/me', {
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
    
    // --- 4. PERIODIC PERMISSION REFRESH (Check every 30 seconds for changes) ---
    setInterval(async () => {
        // Keep tabs and actions in sync if an admin updates permissions in real time.
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
                
                // Compare permission counts to detect changes
                const oldPermCount = Object.keys(user).filter(k => k.startsWith('can_') && user[k]).length;
                const newPermCount = Object.keys(freshUser).filter(k => k.startsWith('can_') && freshUser[k]).length;
                
                if (oldPermCount !== newPermCount) {
                    console.log(`[Admin Dashboard] Permissions changed: ${oldPermCount} → ${newPermCount}`);
                    
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
        if (user?.role === 'ADMIN') return true;
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
        const canExportAttendance = hasPermission('can_export_attendance');
        const canEditAttendance = hasPermission('can_edit_attendance');
        const canBackupDatabase = hasPermission('can_backup_database');
        const canExportHealthLogs = hasPermission('can_export_health_logs');
        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');

        const openUserModalBtn = document.getElementById('open-add-user-modal-btn');
        const userSearchInput = document.getElementById('user-search-input');
        const deleteUserBtn = document.getElementById('delete-user-btn');
        const dangerZoneSection = document.querySelector('#edit-user-form .danger-zone-section');
        const openEquipmentModalBtn = document.getElementById('open-modal-btn');
        const equipmentSearchInput = document.getElementById('equipment-search-input');
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
        const exportAttendanceBtn = document.getElementById('export-attendance-btn');
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

        if (exportAttendanceBtn) {
            exportAttendanceBtn.classList.toggle('hidden', !canExportAttendance);
        }

        if (addSiteBtn) {
            addSiteBtn.classList.toggle('hidden', !canEditAttendance);
        }

        if (triggerBackupBtn) {
            triggerBackupBtn.classList.toggle('hidden', !canBackupDatabase);
        }

        if (exportLogsBtn) {
            exportLogsBtn.classList.toggle('hidden', !canExportHealthLogs);
        }

        reportButtons.forEach(btn => {
            const reportType = btn.getAttribute('data-report-type');
            let allowed = false;
            if (reportType === 'attendance') {
                allowed = canExportAttendance;
            } else if (reportType === 'equipment-usage') {
                allowed = canViewEquipment;
            } else if (reportType === 'inquiry-resolution') {
                allowed = canViewInquiries;
            }
            btn.classList.toggle('hidden', !allowed);
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

        setSectionVisibility('health-overview-shell', canViewHealthLogs);
        setSectionVisibility('health-siem-shell', canViewHealthLogs);
        setSectionVisibility('health-backup-shell', canViewHealthLogs || canBackupDatabase);
        setSectionVisibility('health-audit-shell', canViewAuditTrail);

        const canDownloadAttendanceReport = canExportAttendance;
        const canDownloadEquipmentReport = canViewEquipment;
        const canDownloadInquiryReport = canViewInquiries;
        const anyReportVisible = canDownloadAttendanceReport || canDownloadEquipmentReport || canDownloadInquiryReport;
        setSectionVisibility('reports-shell', anyReportVisible);

        setTabPermissionNotice('user-tab', !canViewUsers, 'You do not have permission to view user records.');
        setTabPermissionNotice('equipment-tab', !canViewEquipment, 'You do not have permission to view equipment records.');
        setTabPermissionNotice('inquiry-tab', !canViewInquiries && !canAddInquiries, 'You do not have permission to view or submit inquiry data.');
        setTabPermissionNotice('portfolio-tab', !canViewFiles && !canUploadFiles, 'You do not have permission to view or upload project files.');
        setTabPermissionNotice('attendance-tab', !canViewAttendance && !canExportAttendance && !canEditAttendance, 'You do not have permission to access attendance sections.');
        setTabPermissionNotice('health-tab', !canViewHealthLogs && !canViewAuditTrail && !canBackupDatabase && !canExportHealthLogs, 'You do not have permission to access system health sections.');
        setTabPermissionNotice('reports-tab', !anyReportVisible, 'No report types are available for your account.');
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
            const response = await fetch('http://localhost:5000/api/attendance/me', {
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
            const response = await fetch('http://localhost:5000/api/notifications?limit=20', {
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
            loadInquiries();
        } else if (targetId === 'reports-tab') {
            initializeReportDateRange();
        } else if (targetId === 'health-tab') {
            const healthSearch = document.getElementById('health-search-input');
            if (healthSearch) {
                healthSearch.value = '';
                healthSearch.defaultValue = '';
            }
            loadSystemHealthTab();
        }
    }

    function getTabTargetForNotification(eventType) {
        const type = String(eventType || '').toUpperCase();
        if (!type) return null;

        if (type.includes('INQUIRY')) return 'inquiry-tab';
        if (type.includes('FILE')) return 'portfolio-tab';
        if (type.includes('INVENTORY') || type.includes('EQUIPMENT')) return 'equipment-tab';
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
    const weeklyRangeSelect = document.getElementById('weekly-range-select');
    if (overviewSearchInput) {
        // Clear browser autofill values so the field is empty by default.
        overviewSearchInput.value = '';
        overviewSearchInput.defaultValue = '';
        setTimeout(() => {
            overviewSearchInput.value = '';
        }, 0);
    }
    if (weeklyRangeSelect) {
        weeklyRangeSelect.addEventListener('change', () => {
            loadOverview();
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
                ? `http://localhost:5000/api/equipment/${equipmentId}`
                : 'http://localhost:5000/api/equipment';
            
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

        if (!await showConfirm('Are you sure you want to delete this equipment? This action cannot be undone.', 'Confirm Deletion')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/equipment/${equipmentId}`, {
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
                'can_view_health_logs', 'can_export_health_logs', 'can_view_audit_trail', 'can_backup_database'
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

            const response = await fetch('http://localhost:5000/register', {
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
            showAlert('ERROR: Network error. Please ensure:\n\n1. Backend server is running (http://localhost:5000)\n2. You are logged in as admin\n3. Database is connected');
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

            const response = await fetch('http://localhost:5000/api/users', {
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
        const response = await fetch('http://localhost:5000/api/equipment/assignable-users', {
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

        const response = await fetch('http://localhost:5000/api/equipment/assign', {
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

        document.querySelectorAll('.qr-code-img').forEach(img => {
            img.addEventListener('click', function() {
                const qrCode = this.dataset.qrCode;
                const qrNumber = this.dataset.qrNumber;
                const equipName = this.dataset.equipName;
                downloadQRCode(qrCode, qrNumber, equipName);
            });
        });

        if (hasPermission('can_edit_equipment')) {
            document.querySelectorAll('.edit-equipment-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const equipmentId = parseInt(this.dataset.equipmentId);
                    editEquipment(equipmentId);
                });
            });
        }

        if (hasPermission('can_assign_equipment')) {
            document.querySelectorAll('.assign-equipment-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const equipmentId = parseInt(this.dataset.equipmentId, 10);
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
                });
            });
        }

        document.querySelectorAll('.download-qr-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const qrCode = this.dataset.qrCode;
                const qrNumber = this.dataset.qrNumber;
                const equipName = this.dataset.equipName;
                downloadQRCode(qrCode, qrNumber, equipName);
            });
        });
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
            const response = await fetch('http://localhost:5000/api/equipment', {
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
        if (!filesSearchInput) return;
        filesSearchInput.value = '';
        filesSearchInput.defaultValue = '';
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
            const response = await fetch('http://localhost:5000/api/files/storage-summary', {
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

    if (cancelFileUploadBtn && fileUploadPanel && projectFileUploadForm) {
        cancelFileUploadBtn.addEventListener('click', () => {
            projectFileUploadForm.reset();
            fileUploadPanel.classList.add('hidden');
        });
    }

    if (projectFileUploadForm) {
        projectFileUploadForm.addEventListener('submit', async (e) => {
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

            try {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('category', projectFileCategory?.value || 'project_progress');

                const response = await fetch('http://localhost:5000/api/files', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                showAlert('File uploaded successfully.');
                projectFileUploadForm.reset();
                fileUploadPanel.classList.add('hidden');

                // Reset filters so the newly uploaded file is visible immediately.
                if (filesStorageFilter) filesStorageFilter.value = 'ALL';
                if (filesSearchInput) filesSearchInput.value = '';

                await loadProjectFiles();
            } catch (error) {
                console.error('Upload file error:', error);
                if (String(error.message).includes('Failed to fetch')) {
                    showAlert('Upload failed: Cannot reach backend API at http://localhost:5000.\n\nStart the backend with npm run dev, then try again.');
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
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
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

            if (downloadBtn) {
                if (!hasPermission('can_download_files')) {
                    showAlert('You do not have permission to download files.');
                    return;
                }

                const fileId = downloadBtn.getAttribute('data-file-id');
                if (!fileId) return;

                try {
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}/download`, {
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
                    'Delete this file permanently? This action cannot be undone.',
                    'Delete File',
                    'Delete',
                    'Cancel'
                );

                if (!confirmed) return;

                try {
                    const response = await fetch(`http://localhost:5000/api/files/${fileId}`, {
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

        inquiryTableBody.innerHTML = inquiries.map(inquiry => {
            const submitted = inquiry.submitted_at
                ? new Date(inquiry.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '-';
            const badgeClass = getInquiryStatusBadgeClass(inquiry.status);
            const inquiryId = Number(inquiry.inquiry_id || 0);
            const inquiryMessage = String(inquiry.message || inquiry.message_body || '');
            const subjectCell = getCollapsibleInquiryCellHtml({
                inquiryId,
                textValue: inquiry.subject || '-',
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
                    <td class="inquiry-subject-cell" title="${escapeHtml(inquiry.subject || '-')}">
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
            const response = await fetch('http://localhost:5000/api/inquiries', {
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
                const response = await fetch(`http://localhost:5000/api/inquiries/${inquiryId}`, {
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
                'Delete this inquiry permanently? This action cannot be undone.',
                'Delete Inquiry',
                'Delete',
                'Cancel'
            );
            if (!confirmed) return;

            try {
                const response = await fetch(`http://localhost:5000/api/inquiries/${inquiryId}`, {
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

    async function downloadAdminReport(reportType, format, triggerButton) {
        const canDownloadReport = (
            (reportType === 'attendance' && hasPermission('can_export_attendance'))
            || (reportType === 'equipment-usage' && hasPermission('can_view_equipment'))
            || (reportType === 'inquiry-resolution' && hasPermission('can_view_inquiries'))
        );

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
            const response = await fetch(`http://localhost:5000/api/reports/${reportType}?${params.toString()}`, {
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

    initializeReportDateRange();

    // --- EDIT EQUIPMENT FUNCTION ---
    function editEquipment(equipmentId) {
        fetch(`http://localhost:5000/api/equipment`, {
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
    async function loadOverview() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // Fetch overview dependencies in parallel to keep dashboard analytics live.
            const [attendanceResponse, equipmentResponse, usersResponse, inquiriesResponse, filesResponse] = await Promise.all([
                fetch('http://localhost:5000/api/attendance', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/api/equipment', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/api/users', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/api/inquiries', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch('http://localhost:5000/api/files', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            const clockedInEmployeesBody = document.getElementById('clocked-in-employees-body');
            const deployedEquipmentBody = document.getElementById('deployed-equipment-body');
            const activeEmployeesCount = document.getElementById('active-employees-count');
            const equipmentDeployedCount = document.getElementById('equipment-deployed-count');
            const totalUsersCount = document.getElementById('total-users-count');
            const totalEquipmentCount = document.getElementById('total-equipment-count');
            const inquiriesPendingCount = document.getElementById('inquiries-pending-count');
            const inquiriesTotalCount = document.getElementById('inquiries-total-count');
            const overviewFilesCount = document.getElementById('overview-files-count');
            const activeProjectsCount = document.getElementById('active-projects-count');
            const attendanceActionsTodayCount = document.getElementById('attendance-actions-today-count');
            const weeklyAttendanceBars = document.getElementById('weekly-attendance-bars');
            const weeklyAttendanceScale = document.getElementById('weekly-attendance-scale');
            const equipmentStatusChart = document.getElementById('equipment-status-chart');
            const equipmentStatusTotal = document.getElementById('equipment-status-total');
            const equipmentStatusLegend = document.getElementById('equipment-status-legend');

            // Process Attendance Data
            if (attendanceResponse.ok) {
                const attendanceData = await attendanceResponse.json();
                const logs = attendanceData.attendance || [];

                // Get today's date
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Filter logs for today only
                const todayLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    logDate.setHours(0, 0, 0, 0);
                    return logDate.getTime() === today.getTime();
                });

                // Group logs by user to find each user's latest status TODAY
                const userLatestLog = {};
                
                todayLogs.forEach(log => {
                    const userId = log.user_id;
                    if (!userLatestLog[userId] || new Date(log.timestamp) > new Date(userLatestLog[userId].timestamp)) {
                        userLatestLog[userId] = log;
                    }
                });

                // Filter users who are currently clocked in (latest action is clock_in)
                const clockedInUsers = Object.values(userLatestLog).filter(log => log.action === 'clock_in');

                // Update count
                if (activeEmployeesCount) {
                    activeEmployeesCount.textContent = clockedInUsers.length;
                }
                if (attendanceActionsTodayCount) {
                    attendanceActionsTodayCount.textContent = todayLogs.length;
                }

                if (weeklyAttendanceBars) {
                    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const weeklyCounts = [0, 0, 0, 0, 0, 0, 0];
                    const now = new Date();
                    const selectedWeek = weeklyRangeSelect?.value || 'this_week';

                    const monday = new Date(now);
                    const day = monday.getDay();
                    const diffToMonday = day === 0 ? -6 : 1 - day;
                    monday.setDate(monday.getDate() + diffToMonday);
                    monday.setHours(0, 0, 0, 0);

                    if (selectedWeek === 'last_week') {
                        monday.setDate(monday.getDate() - 7);
                    }

                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    sunday.setHours(23, 59, 59, 999);

                    const todayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;

                    logs.forEach(log => {
                        if (log.action !== 'clock_in') return;
                        const ts = new Date(log.timestamp);
                        if (ts >= monday && ts <= sunday) {
                            const jsDay = ts.getDay();
                            const index = jsDay === 0 ? 6 : jsDay - 1;
                            weeklyCounts[index] += 1;
                        }
                    });

                    const maxCount = Math.max(...weeklyCounts, 1);
                    const step = Math.max(1, Math.ceil(maxCount / 4));
                    const axisMax = step * 4;

                    if (weeklyAttendanceScale) {
                        const scaleValues = [axisMax, axisMax - step, axisMax - step * 2, axisMax - step * 3, 0];
                        weeklyAttendanceScale.innerHTML = scaleValues.map(value => `<span>${value}</span>`).join('');
                    }

                    const maxBarHeightPx = 204;
                    weeklyAttendanceBars.innerHTML = weeklyCounts.map((count, index) => {
                        const isFutureDay = selectedWeek === 'this_week' && index > todayIndex;
                        const height = count === 0
                            ? 10
                            : Math.max(16, Math.round((count / axisMax) * maxBarHeightPx));
                        const mutedClass = isFutureDay ? ' muted' : '';
                        return `<div class="weekly-bar-col"><div class="weekly-bar${mutedClass}" style="height:${height}px"></div><span>${dayLabels[index]}</span></div>`;
                    }).join('');
                }

                // Display clocked-in employees
                if (clockedInEmployeesBody) {
                    if (clockedInUsers.length === 0) {
                        clockedInEmployeesBody.innerHTML = `
                            <tr>
                                <td colspan="2" style="text-align: center; padding: 24px; color: #9ca3af;">
                                    <div style="font-size: 16px;">No employees currently clocked in</div>
                                </td>
                            </tr>
                        `;
                    } else {
                        clockedInEmployeesBody.innerHTML = clockedInUsers.map(log => {
                            const clockInTime = new Date(log.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            return `
                                <tr>
                                    <td>${log.user?.full_name || 'Unknown Employee'}</td>
                                    <td>${clockInTime}</td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            } else {
                if (clockedInEmployeesBody) {
                    clockedInEmployeesBody.innerHTML = `
                        <tr>
                            <td colspan="2" style="text-align: center; padding: 24px; color: #ef4444;">
                                <div style="font-size: 14px;">Unable to load attendance data</div>
                            </td>
                        </tr>
                    `;
                }
                if (activeEmployeesCount) {
                    activeEmployeesCount.textContent = '—';
                }
                if (attendanceActionsTodayCount) {
                    attendanceActionsTodayCount.textContent = '—';
                }
            }

            // Process Equipment Data
            let allEquipment = [];
            if (equipmentResponse.ok) {
                const equipmentData = await equipmentResponse.json();
                allEquipment = equipmentData.equipment || [];

                // Filter equipment that is "Checked Out"
                const inUseEquipment = allEquipment.filter(item => item.status === 'Checked Out');

                // Update count
                if (equipmentDeployedCount) {
                    equipmentDeployedCount.textContent = inUseEquipment.length;
                }

                if (equipmentStatusChart || equipmentStatusTotal || equipmentStatusLegend) {
                    const statusCounts = {
                        inUse: 0,
                        maintenance: 0,
                        outOfOrder: 0
                    };

                    allEquipment.forEach(item => {
                        const rawStatus = (item.status || '').toString().toLowerCase();
                        if (rawStatus.includes('checked out') || rawStatus.includes('in use') || rawStatus.includes('deployed')) {
                            statusCounts.inUse += 1;
                        } else if (rawStatus.includes('maintenance')) {
                            statusCounts.maintenance += 1;
                        } else if (rawStatus.includes('out of order') || rawStatus.includes('damaged') || rawStatus.includes('defective')) {
                            statusCounts.outOfOrder += 1;
                        }
                    });

                    const totalCount = allEquipment.length;
                    const safeTotal = totalCount || 1;
                    const inUsePct = Math.round((statusCounts.inUse / safeTotal) * 100);
                    const maintenancePct = Math.round((statusCounts.maintenance / safeTotal) * 100);
                    const outOfOrderPct = Math.round((statusCounts.outOfOrder / safeTotal) * 100);

                    if (equipmentStatusTotal) {
                        equipmentStatusTotal.textContent = totalCount;
                    }

                    if (equipmentStatusChart) {
                        equipmentStatusChart.style.setProperty('--in-use', inUsePct);
                        equipmentStatusChart.style.setProperty('--maintenance', maintenancePct);
                        equipmentStatusChart.style.setProperty('--out-order', outOfOrderPct);
                    }

                    if (equipmentStatusLegend) {
                        equipmentStatusLegend.innerHTML = `
                            <div class="equipment-status-legend-row">
                                <div class="legend-label"><span class="legend-dot green"></span><span>In Use</span></div>
                                <strong>${inUsePct}%</strong>
                            </div>
                            <div class="equipment-status-legend-row">
                                <div class="legend-label"><span class="legend-dot amber"></span><span>Maintenance</span></div>
                                <strong>${maintenancePct}%</strong>
                            </div>
                            <div class="equipment-status-legend-row">
                                <div class="legend-label"><span class="legend-dot red"></span><span>Out of Order</span></div>
                                <strong>${outOfOrderPct}%</strong>
                            </div>
                        `;
                    }
                }

                // Display deployed equipment
                if (deployedEquipmentBody) {
                    if (inUseEquipment.length === 0) {
                        deployedEquipmentBody.innerHTML = `
                            <tr>
                                <td colspan="2" style="text-align: center; padding: 24px; color: #9ca3af;">
                                    <div style="font-size: 16px;">No equipment currently in use</div>
                                </td>
                            </tr>
                        `;
                    } else {
                        deployedEquipmentBody.innerHTML = inUseEquipment.map(item => {
                            // Handle both 'name' and 'item_name' field names
                            const itemName = item.name || item.item_name || 'Unknown Item';
                            // Get user from active checkout
                            const assignedToName = item.checkouts?.[0]?.user?.full_name || 'Unknown User';
                            return `
                                <tr>
                                    <td>${itemName}</td>
                                    <td><span class="badge success">Checked Out - ${assignedToName}</span></td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            } else {
                if (deployedEquipmentBody) {
                    deployedEquipmentBody.innerHTML = `
                        <tr>
                            <td colspan="2" style="text-align: center; padding: 24px; color: #ef4444;">
                                <div style="font-size: 14px;">Unable to load equipment data</div>
                            </td>
                        </tr>
                    `;
                }
                if (equipmentDeployedCount) {
                    equipmentDeployedCount.textContent = '—';
                }
            }

            // Update Total Users Count
            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                const users = usersData.users || [];
                if (totalUsersCount) {
                    totalUsersCount.textContent = users.length;
                }
            } else {
                if (totalUsersCount) {
                    totalUsersCount.textContent = '—';
                }
            }

            // Update Total Equipment Count (reuse already fetched data)
            if (totalEquipmentCount) {
                totalEquipmentCount.textContent = allEquipment.length;
            }

            // Update inquiries overview analytics
            if (inquiriesResponse.ok) {
                const inquiriesData = await inquiriesResponse.json();
                const inquiries = inquiriesData.inquiries || [];
                const pendingCount = inquiries.filter(i => i.status === 'Pending' || i.status === 'In Progress').length;

                if (inquiriesPendingCount) inquiriesPendingCount.textContent = pendingCount;
                if (inquiriesTotalCount) inquiriesTotalCount.textContent = inquiries.length;
            } else {
                if (inquiriesPendingCount) inquiriesPendingCount.textContent = '—';
                if (inquiriesTotalCount) inquiriesTotalCount.textContent = '—';
            }

            // Update project files analytics
            if (filesResponse.ok) {
                const filesData = await filesResponse.json();
                const files = filesData.files || [];
                if (overviewFilesCount) overviewFilesCount.textContent = files.length;
                if (activeProjectsCount) activeProjectsCount.textContent = files.length;
            } else {
                if (overviewFilesCount) overviewFilesCount.textContent = '—';
                if (activeProjectsCount) activeProjectsCount.textContent = '—';
            }

        } catch (error) {
            console.error('Error loading overview data:', error);
            const clockedInEmployeesBody = document.getElementById('clocked-in-employees-body');
            const deployedEquipmentBody = document.getElementById('deployed-equipment-body');
            
            if (clockedInEmployeesBody) {
                clockedInEmployeesBody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; padding: 24px; color: #ef4444;">
                            <div style="font-size: 14px;">Connection Error</div>
                        </td>
                    </tr>
                `;
            }
            if (deployedEquipmentBody) {
                deployedEquipmentBody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; padding: 24px; color: #ef4444;">
                            <div style="font-size: 14px;">Connection Error</div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // Load overview and users on page load
    loadOverview();
    loadUsers();
    loadNotificationFeed();

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
            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
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
            const editUserAvatar = document.getElementById('edit-user-avatar');
            const editUserAvatarImage = document.getElementById('edit-user-avatar-image');
            const hasProfilePhoto = Boolean(user.profile_photo);
            if (editUserAvatarImage) {
                editUserAvatarImage.src = hasProfilePhoto ? user.profile_photo : '';
            }
            if (editUserAvatar) {
                editUserAvatar.classList.toggle('has-image', hasProfilePhoto);
            }
            
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

        if (!hasPermission('can_manage_permissions') && !hasPermission('can_activate_users')) {
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
            
            // Get user data (need to preserve these fields)
            const fullName = document.getElementById('edit-user-fullname').textContent;
            const email = document.getElementById('edit-user-email-value').textContent;
            const role = document.getElementById('edit-user-role-value').textContent;
            const contactNumber = e.target.dataset.contactNumber || null;
            
            // Capture all permission checkboxes
            const permissions = {};
            const permissionCheckboxes = document.querySelectorAll('input[name=\"edit-permission\"]');
            permissionCheckboxes.forEach(checkbox => {
                permissions[checkbox.value] = checkbox.checked;
            });
            
            // List of ALL permissions in the system (must match database schema)
            const allPermissions = [
                'can_view_users', 'can_add_users', 'can_edit_users', 'can_delete_users', 'can_activate_users',
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance', 'can_delete_attendance', 'can_export_attendance',
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment', 'can_delete_equipment', 'can_assign_equipment',
                'can_view_files', 'can_upload_files', 'can_edit_files', 'can_delete_files', 'can_download_files',
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries', 'can_delete_inquiries', 'can_assign_inquiries',
                'can_view_health_logs', 'can_export_health_logs', 'can_view_audit_trail', 'can_backup_database'
            ];
            
            // Ensure ALL permissions are explicitly set (checked ones to true, unchecked to false)
            const completePermissions = {};
            allPermissions.forEach(perm => {
                completePermissions[perm] = permissions[perm] === true; // Convert undefined to false
            });
            
            const updateData = {
                full_name: fullName,
                email: email,
                contact_number: contactNumber,
                role: role,
                is_active: isActive,
                ...((hasPermission('can_manage_permissions') && !isEditingSelf) ? completePermissions : {})
            };

            if (isEditingSelf && hasPermission('can_manage_permissions')) {
                showAlert('Note: You cannot change your own permission settings. Other profile changes can still be saved.');
            }
            
            console.log('Sending update data:', updateData);
            
            const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
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
        confirmDeleteBtn.innerHTML = '<span>⏳ Verifying...</span>';

        try {
            const token = localStorage.getItem('token');
            
            // Step 1: Verify admin password
            const verifyResponse = await fetch('http://localhost:5000/api/verify-password', {
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
                confirmDeleteBtn.innerHTML = '<span><i class="bi bi-trash"></i> Delete Permanently</span>';
                deleteConfirmPassword.value = '';
                deleteConfirmPassword.focus();
                return;
            }

            // Step 2: Delete the user
            confirmDeleteBtn.innerHTML = '<span>⏳ Deleting...</span>';
            
            const deleteResponse = await fetch(`http://localhost:5000/api/users/${userToDelete.userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (deleteResponse.ok) {
                showAlert(`SUCCESS: User Deleted Successfully!\n\n${userToDelete.userName} has been permanently removed from the system.`);
                
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
            confirmDeleteBtn.innerHTML = '<span><i class="bi bi-trash"></i> Delete Permanently</span>';
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

    // Prevent browser autofill/history from restoring an email into the health search input.
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
            healthTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">No logs found for current filters</td>
                </tr>
            `;
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

        const timeHours = {
            '1h': 1,
            '6h': 6,
            '12h': 12,
            '24h': 24
        };
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

    async function loadSystemHealthTab() {
        const canViewHealthLogs = hasPermission('can_view_health_logs');
        const canViewAuditTrail = hasPermission('can_view_audit_trail');
        const canViewHealth = canViewHealthLogs || canViewAuditTrail;
        if (!canViewHealth) {
            if (healthTableBody) {
                healthTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view system health logs.</td>
                    </tr>
                `;
            }
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#9ca3af;">You do not have permission to view security alerts.</td>
                    </tr>
                `;
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
                    const backups = summary.backup_history || [];
                    if (backups.length === 0) {
                        backupTableBody.innerHTML = `
                            <tr>
                                <td colspan="6" style="text-align:center; padding:24px; color:#9ca3af;">No backup history yet</td>
                            </tr>
                        `;
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
                const logs = logsData.logs || [];
                healthLogsCache = logs;
                populateHealthEventFilter(healthLogsCache);
                applyHealthLogFilters();
            } else if (healthTableBody) {
                const message = logsResponse && logsResponse.status === 403
                    ? 'You do not have permission to view audit logs.'
                    : 'Failed to load health logs';
                healthTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">${message}</td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('System health load error:', error);
            if (backupTableBody) {
                backupTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Failed to load backup history</td>
                    </tr>
                `;
            }
            if (healthTableBody) {
                healthTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load health logs</td>
                    </tr>
                `;
            }
            if (siemAlertsBody) {
                siemAlertsBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center; padding:24px; color:#ef4444;">Failed to load security alerts</td>
                    </tr>
                `;
            }
        }
    }

    if (healthEventFilter) {
        healthEventFilter.addEventListener('change', applyHealthLogFilters);
    }
    if (healthDateFilter) {
        healthDateFilter.addEventListener('change', applyHealthLogFilters);
    }
    if (healthSearchInput) {
        healthSearchInput.addEventListener('input', applyHealthLogFilters);
    }
    if (healthFilterResetBtn) {
        healthFilterResetBtn.addEventListener('click', resetHealthLogFilters);
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

    // Fallback binding in case the button is re-rendered later.
    document.addEventListener('click', (event) => {
        const resetBtn = event.target.closest('#health-filter-reset-btn');
        if (!resetBtn) return;
        resetHealthLogFilters(event);
    });

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
                exportLogsBtn.innerHTML = '<i class="bi bi-download"></i> Export Logs (CSV)';
            }
        });
    }
});
