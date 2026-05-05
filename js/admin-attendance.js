// ==========================================
// ATTENDANCE MANAGEMENT MODULE
// ==========================================

// GPS Helper Function (reusable for site location)
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

document.addEventListener('DOMContentLoaded', () => {

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
        return {};
    }
}

function hasPermission(permissionKey) {
    const user = getCurrentUser();
    if (user?.role === 'ADMIN') return true;
    return Boolean(user?.[permissionKey]);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
    
// --- ATTENDANCE TAB FUNCTIONALITY ---

// Site Modal Management
const siteModal = document.getElementById('site-modal');
const addSiteBtn = document.getElementById('add-site-btn');
const closeSiteModalBtn = document.getElementById('close-site-modal-btn');
const cancelSiteBtn = document.getElementById('cancel-site-btn');
const addSiteForm = document.getElementById('add-site-form');

let editingSiteId = null;
let attendanceSitesCache = [];

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
}

function parseCoordinate(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function resolveAttendanceSiteName(lat, lng) {
    const latitude = parseCoordinate(lat);
    const longitude = parseCoordinate(lng);

    if (latitude === null || longitude === null) {
        return 'No GPS';
    }

    if (!attendanceSitesCache.length) {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }

    const activeSites = attendanceSitesCache.filter(site => site.is_active);
    const candidateSites = activeSites.length ? activeSites : attendanceSitesCache;

    let nearestSite = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    candidateSites.forEach(site => {
        const siteLat = parseCoordinate(site.center_lat);
        const siteLng = parseCoordinate(site.center_lng);
        if (siteLat === null || siteLng === null) return;

        const distance = calculateDistanceMeters(latitude, longitude, siteLat, siteLng);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestSite = site;
        }
    });

    return nearestSite?.site_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

async function ensureAttendanceSitesLoaded() {
    if (attendanceSitesCache.length > 0) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/sites', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;
        const sites = await response.json();
        attendanceSitesCache = Array.isArray(sites) ? sites : [];
    } catch (error) {
        console.error('Failed to preload sites for attendance labels:', error);
    }
}

// --- Leaflet Map for Site Location Preview ---
let siteMap = null;
let siteMapMarker = null;
let siteMapCircle = null;

function destroySiteMap() {
    if (siteMap) {
        siteMap.remove();
        siteMap = null;
        siteMapMarker = null;
        siteMapCircle = null;
    }
}

function initSiteMap(lat, lng, radius) {
    const mapEl = document.getElementById('site-location-map');
    if (!mapEl || typeof L === 'undefined') return;
    destroySiteMap();

    const hasCoords = (lat != null && isFinite(lat) && lng != null && isFinite(lng));
    const centerLat = hasCoords ? lat : 14.5995;
    const centerLng = hasCoords ? lng : 120.9842;
    const r = (radius > 0) ? radius : 100;

    siteMap = L.map('site-location-map', { zoomControl: true }).setView([centerLat, centerLng], hasCoords ? 16 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '\u00a9 <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(siteMap);

    if (hasCoords) {
        siteMapMarker = L.marker([lat, lng]).addTo(siteMap);
        siteMapCircle = L.circle([lat, lng], {
            radius: r, color: '#2dad50', fillColor: '#2dad50', fillOpacity: 0.18, weight: 2
        }).addTo(siteMap);
    }

    setTimeout(() => { if (siteMap) { siteMap.invalidateSize(); } }, 400);
    setTimeout(() => { if (siteMap) { siteMap.invalidateSize(); } }, 900);
}

function updateSiteMap() {
    const lat = parseFloat(document.getElementById('site-lat')?.value);
    const lng = parseFloat(document.getElementById('site-lng')?.value);
    const radius = parseInt(document.getElementById('site-radius')?.value) || 100;
    if (!siteMap || !isFinite(lat) || !isFinite(lng)) return;

    const ll = [lat, lng];
    if (siteMapMarker) {
        siteMapMarker.setLatLng(ll);
    } else {
        siteMapMarker = L.marker(ll).addTo(siteMap);
    }
    if (siteMapCircle) {
        siteMapCircle.setLatLng(ll);
        siteMapCircle.setRadius(radius);
    } else {
        siteMapCircle = L.circle(ll, {
            radius, color: '#2dad50', fillColor: '#2dad50', fillOpacity: 0.18, weight: 2
        }).addTo(siteMap);
    }
    siteMap.setView(ll, siteMap.getZoom());
}

['site-lat', 'site-lng', 'site-radius'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateSiteMap);
});

// Open site modal for adding
if (addSiteBtn) {
    addSiteBtn.addEventListener('click', () => {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }

        editingSiteId = null;
        document.getElementById('site-modal-title').textContent = 'Add Construction Site';
        document.getElementById('submit-site-btn').innerHTML = '<i class="bi bi-check-circle-fill"></i> Save Site';
        document.getElementById('site-danger-actions').classList.add('hidden');
        addSiteForm.reset();
        siteModal.classList.remove('hidden');
        setTimeout(() => initSiteMap(null, null, 100), 120);
    });
}

// Close site modal
if (closeSiteModalBtn) {
    closeSiteModalBtn.addEventListener('click', () => {
        siteModal.classList.add('hidden');
        destroySiteMap();
        editingSiteId = null;
    });
}

if (cancelSiteBtn) {
    cancelSiteBtn.addEventListener('click', () => {
        siteModal.classList.add('hidden');
        destroySiteMap();
        editingSiteId = null;
    });
}

// Close on outside click
if (siteModal) {
    siteModal.addEventListener('click', (e) => {
        if (e.target === siteModal) {
            siteModal.classList.add('hidden');
            destroySiteMap();
            editingSiteId = null;
        }
    });
}

// Get My Location Button Handler
const getLocationBtn = document.getElementById('get-my-location-btn');
if (getLocationBtn) {
    getLocationBtn.addEventListener('click', async () => {
        try {
            getLocationBtn.disabled = true;
            getLocationBtn.innerHTML = '<i class="bi bi-arrow-repeat" style="animation: spin 1s linear infinite;"></i> Getting Location...';
            
            const position = await getCurrentPosition();
            
            // Auto-fill the coordinates
            document.getElementById('site-lat').value = position.latitude.toFixed(6);
            document.getElementById('site-lng').value = position.longitude.toFixed(6);
            
            let message = `SUCCESS: Location captured successfully!\n\n`;
            message += `Latitude: ${position.latitude.toFixed(6)}\n`;
            message += `Longitude: ${position.longitude.toFixed(6)}\n`;
            message += `Accuracy: ±${Math.round(position.accuracy)} meters\n\n`;
            message += `You can adjust coordinates manually if needed.`;
            
            showAlert(message);
            
            updateSiteMap();
            getLocationBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Use My Current Location';
            getLocationBtn.disabled = false;
        } catch (error) {
            showAlert(`ERROR: ${error.message}\n\nPlease enter coordinates manually.`);
            getLocationBtn.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Use My Current Location';
            getLocationBtn.disabled = false;
        }
    });
}

// Load Attendance Statistics
async function loadAttendanceStats() {
    if (!hasPermission('can_view_all_attendance')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        // Get all attendance logs
        const response = await fetch('http://localhost:5000/api/attendance', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const logs = data.attendance || [];
            
            const clockedInList = document.getElementById('attendance-clocked-in-list');
            const latestByUserToday = new Map();
            const todayKey = new Date().toDateString();

            logs.forEach(log => {
                if (!log?.user_id) return;
                if (new Date(log.timestamp).toDateString() !== todayKey) return;
                const prior = latestByUserToday.get(log.user_id);
                if (!prior || new Date(log.timestamp) > new Date(prior.timestamp)) {
                    latestByUserToday.set(log.user_id, log);
                }
            });

            const clockedInUsers = Array.from(latestByUserToday.values())
                .filter(entry => entry.action === 'clock_in')
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const currentlyIn = clockedInUsers.length;
            
            // Count today's attendance
            const today = new Date().toDateString();
            const todayLogs = logs.filter(log => 
                new Date(log.timestamp).toDateString() === today
            );
            
            // Count this month
            const thisMonth = new Date().getMonth();
            const thisYear = new Date().getFullYear();
            const monthLogs = logs.filter(log => {
                const date = new Date(log.timestamp);
                return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
            });
            
            document.getElementById('attendance-clocked-in-count').textContent = Math.max(0, currentlyIn);
            document.getElementById('attendance-today-count').textContent = todayLogs.length;
            document.getElementById('attendance-month-count').textContent = monthLogs.length;

            if (clockedInList) {
                if (!clockedInUsers.length) {
                    clockedInList.innerHTML = '<li class="attendance-clocked-in-empty">No one is currently clocked in today.</li>';
                } else {
                    clockedInList.innerHTML = clockedInUsers.map(entry => {
                        const name = entry.user?.full_name || 'Unknown';
                        const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        return `
                            <li>
                                <span>${escapeHtml(name)}</span>
                                <span class="attendance-clocked-in-time">${escapeHtml(time)}</span>
                            </li>
                        `;
                    }).join('');
                }
            }
        }
    } catch (error) {
        console.error('Failed to load attendance stats:', error);
    }
}

const clockedInCard = document.getElementById('attendance-clocked-in-card');
const clockedInPanel = document.getElementById('attendance-clocked-in-panel');

function toggleClockedInPanel(forceState) {
    if (!clockedInCard || !clockedInPanel) return;
    const willOpen = forceState !== undefined
        ? Boolean(forceState)
        : clockedInPanel.classList.contains('hidden');
    clockedInPanel.classList.toggle('hidden', !willOpen);
    clockedInCard.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) {
        clockedInPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

if (clockedInCard) {
    clockedInCard.addEventListener('click', () => toggleClockedInPanel());
    clockedInCard.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleClockedInPanel();
    });
}

// Load All Attendance Logs
async function loadAttendanceLogs(filters = {}) {
    if (!hasPermission('can_view_all_attendance')) {
        const tbody = document.getElementById('attendance-logs-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9ca3af;">You do not have permission to view attendance logs</td></tr>';
        }
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const tbody = document.getElementById('attendance-logs-body');
        
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px;">Loading...</td></tr>';
        
        const response = await fetch('http://localhost:5000/api/attendance', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load attendance');
        
        const data = await response.json();
        let logs = data.attendance || [];
        
        // Apply filters
        if (filters.date) {
            logs = logs.filter(log => {
                const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                return logDate === filters.date;
            });
        }
        
        if (filters.userId) {
            logs = logs.filter(log => log.user_id === parseInt(filters.userId));
        }

        await ensureAttendanceSitesLoaded();

        if (filters.query) {
            const query = String(filters.query).toLowerCase();
            logs = logs.filter(log => {
                const fullName = (log.user?.full_name || '').toLowerCase();
                const email = (log.user?.email || '').toLowerCase();
                const action = (log.action || '').toLowerCase();
                const siteName = resolveAttendanceSiteName(log.location_lat, log.location_lng).toLowerCase();
                const gps = `${log.location_lat || ''} ${log.location_lng || ''}`.toLowerCase();
                return fullName.includes(query) || email.includes(query) || action.includes(query) || siteName.includes(query) || gps.includes(query);
            });
        }
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9ca3af;">No attendance records found</td></tr>';
            return;
        }
        
        // Display logs
        tbody.innerHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const action = log.action === 'clock_in' ? '<span class="badge success">Clock In</span>' : '<span class="badge">Clock Out</span>';
            const resolvedLocation = resolveAttendanceSiteName(log.location_lat, log.location_lng);
            const location = resolvedLocation === 'No GPS'
                ? '<span style="color: #9ca3af;">No GPS</span>'
                : resolvedLocation;
            const status = (log.location_lat && log.location_lng) 
                ? '<span class="badge success">Valid</span>' 
                : '<span class="badge warning">No GPS</span>';
            const hasPhoto = log.photo ? true : false;
            
            return `<tr>
                <td>${log.user?.full_name || 'Unknown'}</td>
                <td>${action}</td>
                <td>${timestamp}</td>
                <td>${location}</td>
                <td>${status}</td>
                <td>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn-small btn-view-attendance" data-log-id="${log.log_id}" data-photo="${hasPhoto}" data-lat="${log.location_lat || ''}" data-lng="${log.location_lng || ''}" data-timestamp="${log.timestamp}" data-user="${log.user?.full_name || 'Unknown'}" data-action="${log.action}">
                            <i class="bi bi-eye-fill"></i> View
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load attendance logs:', error);
        const tbody = document.getElementById('attendance-logs-body');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load attendance logs</td></tr>';
    }
}

// Load User List for Filter
async function loadAttendanceUserFilter() {
    if (!hasPermission('can_view_all_attendance')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const select = document.getElementById('attendance-user-filter');
        
        const response = await fetch('http://localhost:5000/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users || [];
            
            select.innerHTML = '<option value="">All Employees</option>' + 
                users.filter(u => u.role === 'EMPLOYEE').map(u => 
                    `<option value="${u.user_id}">${u.full_name}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

// Attendance Filters
const dateFilter = document.getElementById('attendance-date-filter');
const userFilter = document.getElementById('attendance-user-filter');
const attendanceSearchInput = document.getElementById('attendance-search-input');
const clearFilterBtn = document.getElementById('clear-attendance-filter');

if (attendanceSearchInput) {
    attendanceSearchInput.value = '';
}
window.addEventListener('pageshow', () => {
    if (attendanceSearchInput) attendanceSearchInput.value = '';
});

function enforceAttendancePermissionUi() {
    const canViewAttendance = hasPermission('can_view_all_attendance');
    const canExportAttendance = hasPermission('can_export_attendance');
    const canEditAttendance = hasPermission('can_edit_attendance');

    if (addSiteBtn) {
        addSiteBtn.classList.toggle('hidden', !canEditAttendance);
    }

    if (dateFilter) dateFilter.disabled = !canViewAttendance;
    if (userFilter) userFilter.disabled = !canViewAttendance;
    if (attendanceSearchInput) attendanceSearchInput.disabled = !canViewAttendance;
    if (clearFilterBtn) clearFilterBtn.disabled = !canViewAttendance;
}

if (dateFilter) {
    dateFilter.addEventListener('change', () => {
        loadAttendanceLogs({
            date: dateFilter.value,
            userId: userFilter.value,
            query: attendanceSearchInput?.value || ''
        });
    });
}

if (userFilter) {
    userFilter.addEventListener('change', () => {
        loadAttendanceLogs({
            date: dateFilter.value,
            userId: userFilter.value,
            query: attendanceSearchInput?.value || ''
        });
    });
}

if (attendanceSearchInput) {
    attendanceSearchInput.addEventListener('input', () => {
        loadAttendanceLogs({
            date: dateFilter.value,
            userId: userFilter.value,
            query: attendanceSearchInput.value
        });
    });
}

if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
        if (dateFilter) dateFilter.value = '';
        if (userFilter) userFilter.value = '';
        if (attendanceSearchInput) attendanceSearchInput.value = '';
        loadAttendanceLogs();
    });
}

// Load Construction Sites
async function loadConstructionSites() {
    if (!hasPermission('can_view_all_attendance')) {
        const tbody = document.getElementById('construction-sites-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9ca3af;">You do not have permission to view construction sites</td></tr>';
        }
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const tbody = document.getElementById('construction-sites-body');
        
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px;">Loading...</td></tr>';
        
        const response = await fetch('http://localhost:5000/api/sites', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) throw new Error('Failed to load sites');
        
        const sites = await response.json();
        attendanceSitesCache = Array.isArray(sites) ? sites : [];
        
        // Update stats
        document.getElementById('active-sites-count').textContent = sites.filter(s => s.is_active).length;
        
        if (sites.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9ca3af;">No construction sites configured yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = sites.map(site => {
            const coords = `${parseFloat(site.center_lat).toFixed(6)}, ${parseFloat(site.center_lng).toFixed(6)}`;
            const status = site.is_active
                ? '<span class="badge success">Active</span>'
                : '<span class="badge">Inactive</span>';

            return `<tr>
                <td>${site.site_name}</td>
                <td>${site.site_address || '<span style="color:#9ca3af">N/A</span>'}</td>
                <td><span class="mono-text">${coords}</span></td>
                <td>${site.geo_fence_radius_meters} m</td>
                <td>${status}</td>
                <td>
                    <div style="display:flex;gap:6px;">
                        <button class="btn-small btn-edit-site" data-site-id="${site.site_id}" title="Edit Site"><i class="bi bi-pencil"></i></button>
                        <button class="btn-small btn-toggle-site" data-site-id="${site.site_id}" data-active="${site.is_active}" title="${site.is_active ? 'Deactivate' : 'Activate'}" style="background:${site.is_active ? '#ef4444' : '#2dad50'};color:#fff;">
                            <i class="bi bi-${site.is_active ? 'pause-circle' : 'play-circle'}"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load sites:', error);
        const tbody = document.getElementById('construction-sites-body');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: #ef4444;">Failed to load construction sites</td></tr>';
    }
}

// Submit Site Form
if (addSiteForm) {
    addSiteForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }
        
        const token = localStorage.getItem('token');
        const siteData = {
            site_name: document.getElementById('site-name').value,
            site_address: document.getElementById('site-address').value || null,
            center_lat: parseFloat(document.getElementById('site-lat').value),
            center_lng: parseFloat(document.getElementById('site-lng').value),
            geo_fence_radius_meters: parseInt(document.getElementById('site-radius').value)
        };
        
        try {
            const url = editingSiteId 
                ? `http://localhost:5000/api/sites/${editingSiteId}`
                : 'http://localhost:5000/api/sites';
            
            const response = await fetch(url, {
                method: editingSiteId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(siteData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAlert(`SUCCESS: Site ${editingSiteId ? 'updated' : 'created'} successfully!`);
                siteModal.classList.add('hidden');
                loadConstructionSites();
                editingSiteId = null;
            } else {
                showAlert(`ERROR: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Site save error:', error);
            showAlert('ERROR: Failed to save construction site');
        }
    });
}

// Initialize Attendance Tab on Load
enforceAttendancePermissionUi();

const attendanceTab = document.querySelector('[data-target="attendance-tab"]');
if (attendanceTab) {
    attendanceTab.addEventListener('click', () => {
        loadAttendanceStats();
        loadAttendanceLogs();
        loadAttendanceUserFilter();
        loadConstructionSites();
    });
}

// Event delegation for construction site action buttons
document.addEventListener('click', async (e) => {
    // Find the actual button (in case user clicks on icon inside button)
    const editBtn = e.target.closest('.btn-edit-site');
    const toggleBtn = e.target.closest('.btn-toggle-site');
    const viewBtn = e.target.closest('.btn-view-attendance');
    
    // Handle Edit button
    if (editBtn) {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }
        const siteId = parseInt(editBtn.dataset.siteId);
        await editSite(siteId);
    }
    
    // Handle Toggle Status button
    if (toggleBtn) {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }
        const siteId = parseInt(toggleBtn.dataset.siteId);
        const isActive = toggleBtn.dataset.active === 'true';
        await toggleSiteStatus(siteId, !isActive);
    }
    
    // Handle View Attendance Details button
    if (viewBtn) {
        if (!hasPermission('can_view_all_attendance')) {
            showAlert('You do not have permission to view attendance details.');
            return;
        }
        const logId = viewBtn.dataset.logId;
        await viewAttendanceDetails(logId);
    }
});

async function editAttendanceLog(logId, currentAction, currentTimestamp) {
    if (!hasPermission('can_edit_attendance')) {
        showAlert('You do not have permission to edit attendance logs.');
        return false;
    }

    if (!logId) return false;

    const editInput = await showAttendanceEditModal(currentAction, currentTimestamp);
    if (!editInput) return false;

    const normalizedAction = editInput.action;
    const parsedTimestamp = editInput.timestampValue ? new Date(editInput.timestampValue) : null;

    if (editInput.timestampValue && Number.isNaN(parsedTimestamp?.getTime())) {
        showAlert('ERROR: Invalid timestamp. Please use the date/time picker.');
        return false;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: normalizedAction,
                ...(parsedTimestamp ? { timestamp: parsedTimestamp.toISOString() } : {})
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to update attendance log (${response.status})`);
        }

        showAlert('SUCCESS: Attendance log corrected successfully!');
        await loadAttendanceStats();
        await loadAttendanceLogs({
            date: dateFilter?.value || '',
            userId: userFilter?.value || '',
            query: attendanceSearchInput?.value || ''
        });
        return true;
    } catch (error) {
        console.error('Failed to update attendance log:', error);
        showAlert(`ERROR: ${error.message || 'Failed to update attendance log'}`);
        return false;
    }
}

function toDateTimeLocalValue(timestamp) {
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

function showAttendanceEditModal(currentAction, currentTimestamp) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay attendance-edit-overlay';

        const safeAction = currentAction === 'clock_out' ? 'clock_out' : 'clock_in';
        const timestampValue = toDateTimeLocalValue(currentTimestamp);

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
                    <span class="close-modal" id="attendance-edit-close">&times;</span>
                </div>
                <form id="attendance-edit-form" class="attendance-edit-form" novalidate>
                    <div class="attendance-edit-field">
                        <label for="attendance-edit-action">Action</label>
                        <select id="attendance-edit-action" class="modern-select" required>
                            <option value="clock_in" ${safeAction === 'clock_in' ? 'selected' : ''}>Clock In</option>
                            <option value="clock_out" ${safeAction === 'clock_out' ? 'selected' : ''}>Clock Out</option>
                        </select>
                    </div>
                    <div class="attendance-edit-field">
                        <label for="attendance-edit-timestamp">Timestamp</label>
                        <input id="attendance-edit-timestamp" class="modern-input" type="datetime-local" value="${timestampValue}">
                    </div>
                    <div class="attendance-edit-actions">
                        <button type="button" class="attendance-photo-close-btn attendance-edit-cancel">Cancel</button>
                        <button type="submit" class="btn-primary attendance-edit-submit">Confirm</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#attendance-edit-close');
        const cancelBtn = modal.querySelector('.attendance-edit-cancel');
        const form = modal.querySelector('#attendance-edit-form');
        const actionSelect = modal.querySelector('#attendance-edit-action');
        const timestampInput = modal.querySelector('#attendance-edit-timestamp');

        const closeModal = (result = null) => {
            modal.remove();
            resolve(result);
        };

        if (closeBtn) closeBtn.addEventListener('click', () => closeModal(null));
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal(null));

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(null);
        });

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
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

async function deleteAttendanceLog(logId) {
    if (!hasPermission('can_delete_attendance')) {
        showAlert('You do not have permission to delete attendance logs.');
        return false;
    }

    if (!logId) return false;

    const confirmed = await showConfirm(
        'Are you sure you want to permanently delete this attendance log?',
        'Delete Attendance Log'
    );
    if (!confirmed) return false;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || `Failed to delete attendance log (${response.status})`);
        }

        showAlert('SUCCESS: Attendance log deleted successfully!');
        await loadAttendanceStats();
        await loadAttendanceLogs({
            date: dateFilter?.value || '',
            userId: userFilter?.value || '',
            query: attendanceSearchInput?.value || ''
        });
        return true;
    } catch (error) {
        console.error('Failed to delete attendance log:', error);
        showAlert(`ERROR: ${error.message || 'Failed to delete attendance log'}`);
        return false;
    }
}

// Edit Site Function
async function editSite(siteId) {
    if (!hasPermission('can_edit_attendance')) {
        showAlert('You do not have permission to manage construction sites.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/sites', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const sites = await response.json();
            const site = sites.find(s => s.site_id === siteId);
            
            if (site) {
                editingSiteId = siteId;
                document.getElementById('site-modal-title').textContent = 'Edit Construction Site';
                document.getElementById('submit-site-btn').innerHTML = '<i class="bi bi-check-circle-fill"></i> Update Site';
                document.getElementById('site-name').value = site.site_name;
                document.getElementById('site-address').value = site.site_address || '';
                document.getElementById('site-lat').value = site.center_lat;
                document.getElementById('site-lng').value = site.center_lng;
                document.getElementById('site-radius').value = site.geo_fence_radius_meters;
                
                // Show danger actions (delete & mark as done)
                const dangerActions = document.getElementById('site-danger-actions');
                dangerActions.classList.remove('hidden');
                dangerActions.style.display = 'flex';
                
                // Update mark as done button text
                const markDoneText = document.getElementById('mark-done-text');
                const markDoneBtn = document.getElementById('mark-done-site-btn');
                if (site.is_active) {
                    markDoneText.textContent = 'Mark as Done';
                    markDoneBtn.style.background = '#f59e0b';
                } else {
                    markDoneText.textContent = 'Mark as Active';
                    markDoneBtn.style.background = '#10b981';
                }
                
                siteModal.classList.remove('hidden');
                setTimeout(() => initSiteMap(site.center_lat, site.center_lng, site.geo_fence_radius_meters), 120);
            }
        }
    } catch (error) {
        console.error('Failed to load site:', error);
        showAlert('Failed to load site details');
    }
}

// Toggle Site Status Function
async function toggleSiteStatus(siteId, activate) {
    if (!hasPermission('can_edit_attendance')) {
        showAlert('You do not have permission to manage construction sites.');
        return;
    }

    const action = activate ? 'activate' : 'deactivate';
    if (!await showConfirm(`Are you sure you want to ${action} this construction site?`, 'Confirm Site Status Change')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/sites/${siteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: activate })
        });
        
        if (response.ok) {
            showAlert(`SUCCESS: Site ${action}d successfully!`);
            loadConstructionSites();
        } else {
            const data = await response.json();
            showAlert(`ERROR: ${data.error || data.message}`);
        }
    } catch (error) {
        console.error('Failed to update site status:', error);
        showAlert('Failed to update site status');
    }
}

// Delete Site Function
const deleteSiteBtn = document.getElementById('delete-site-btn');
if (deleteSiteBtn) {
    deleteSiteBtn.addEventListener('click', async () => {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }

        if (!editingSiteId) return;
        
        const confirmMsg = `WARNING: This will permanently delete this construction site!\n\nAll GPS data and geo-fence settings will be lost.\n\nType 'DELETE' to confirm:`;
        const userInput = await showPrompt(confirmMsg, '', 'Confirm Site Deletion');
        
        if (userInput !== 'DELETE') {
            if (userInput !== null) {
                showAlert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
            }
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/sites/${editingSiteId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                showAlert('SUCCESS: Site deleted successfully!');
                siteModal.classList.add('hidden');
                editingSiteId = null;
                loadConstructionSites();
            } else {
                const data = await response.json();
                showAlert(`ERROR: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Failed to delete site:', error);
            showAlert('ERROR: Failed to delete site');
        }
    });
}

// Mark as Done/Active Site Function
const markDoneSiteBtn = document.getElementById('mark-done-site-btn');
if (markDoneSiteBtn) {
    markDoneSiteBtn.addEventListener('click', async () => {
        if (!hasPermission('can_edit_attendance')) {
            showAlert('You do not have permission to manage construction sites.');
            return;
        }

        if (!editingSiteId) return;
        
        try {
            const token = localStorage.getItem('token');
            
            // Fetch current site status
            const sitesResponse = await fetch('http://localhost:5000/api/sites', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!sitesResponse.ok) {
                showAlert('Failed to fetch site status');
                return;
            }
            
            const sites = await sitesResponse.json();
            const site = sites.find(s => s.site_id === editingSiteId);
            
            if (!site) {
                showAlert('Site not found');
                return;
            }
            
            const newStatus = !site.is_active;
            const action = newStatus ? 'reactivate' : 'mark as done';
            
            if (!await showConfirm(`Are you sure you want to ${action} this site?\n\n${newStatus ? 'The site will be available for geo-fence checks again.' : 'Employees will no longer be able to clock in at this location.'}`, 'Confirm Site Status Change')) {
                return;
            }
            
            const response = await fetch(`http://localhost:5000/api/sites/${editingSiteId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ is_active: newStatus })
            });
            
            if (response.ok) {
                showAlert(`SUCCESS: Site ${newStatus ? 'reactivated' : 'marked as done'} successfully!`);
                siteModal.classList.add('hidden');
                editingSiteId = null;
                loadConstructionSites();
            } else {
                const data = await response.json();
                showAlert(`ERROR: ${data.error || data.message}`);
            }
        } catch (error) {
            console.error('Failed to update site status:', error);
            showAlert('ERROR: Failed to update site status');
        }
    });
}

// View Attendance Details Function
async function viewAttendanceDetails(logId) {
    if (!hasPermission('can_view_all_attendance')) {
        showAlert('You do not have permission to view attendance details.');
        return;
    }

    const btn = document.querySelector(`.btn-view-attendance[data-log-id="${logId}"]`);
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Loading...';

    try {
        const hasPhoto = btn.dataset.photo === 'true';
        const lat = btn.dataset.lat;
        const lng = btn.dataset.lng;
        const rawTimestamp = btn.dataset.timestamp;
        const timestamp = new Date(rawTimestamp).toLocaleString();
        const user = btn.dataset.user;
        const rawAction = btn.dataset.action;
        const action = rawAction === 'clock_in' ? 'Clock In' : 'Clock Out';

        await fetchAttendancePhoto(logId, user, action, rawAction, timestamp, rawTimestamp, lat, lng, hasPhoto);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function fetchAttendancePhoto(logId, user, action, rawAction, timestamp, rawTimestamp, lat, lng, hasPhoto) {
    if (!hasPermission('can_view_all_attendance')) {
        showAlert('You do not have permission to view attendance details.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/attendance/${logId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            showAlert('Failed to fetch attendance details');
            return;
        }

        const log = await response.json();
        const effectiveHasPhoto = Boolean(log.photo) || hasPhoto;
        const effectiveRawAction = log.action || rawAction;
        const effectiveAction = effectiveRawAction === 'clock_in' ? 'Clock In' : 'Clock Out';
        const effectiveRawTimestamp = log.timestamp || rawTimestamp;
        const effectiveTimestamp = effectiveRawTimestamp ? new Date(effectiveRawTimestamp).toLocaleString() : timestamp;
        const effectiveLat = log.location_lat || lat;
        const effectiveLng = log.location_lng || lng;
        const effectiveSiteName = resolveAttendanceSiteName(effectiveLat, effectiveLng);
        const canEditLogs = hasPermission('can_edit_attendance');
        const canDeleteLogs = hasPermission('can_delete_attendance');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay attendance-photo-overlay';
        modal.innerHTML = `
            <div class="modal-content modern-modal attendance-photo-modal">
                <div class="modal-header attendance-photo-header">
                    <div class="modal-header-content">
                        <div class="modal-icon"><i class="bi bi-camera-fill"></i></div>
                        <div>
                            <h2 class="modal-title">Attendance Photo</h2>
                            <p class="modal-subtitle">${user} - ${effectiveAction}</p>
                        </div>
                    </div>
                    <span class="close-modal" id="close-photo-modal">&times;</span>
                </div>
                <div class="attendance-photo-body">
                    ${effectiveHasPhoto && log.photo ? `<img src="${log.photo}" class="attendance-photo-image" alt="Attendance capture for ${user}">` : '<p class="attendance-photo-empty">No photo available for this attendance record</p>'}

                    <div class="attendance-photo-details">
                        <h3 class="attendance-photo-details-title">
                            <i class="bi bi-info-circle-fill"></i>Details
                        </h3>
                        <div class="attendance-photo-details-grid">
                            <div class="attendance-photo-detail-item">
                                <strong>Time:</strong> ${effectiveTimestamp}
                            </div>
                            <div class="attendance-photo-detail-item">
                                <strong>Action:</strong> ${effectiveAction}
                            </div>
                            <div class="attendance-photo-detail-item attendance-photo-detail-item-full">
                                <strong>Location:</strong> ${effectiveSiteName}
                            </div>
                        </div>
                    </div>

                    <div class="attendance-photo-actions">
                        ${canDeleteLogs ? '<button type="button" class="btn-danger" id="modal-delete-attendance-btn"><i class="bi bi-trash"></i> Delete Log</button>' : ''}
                        ${canEditLogs ? '<button type="button" class="btn-primary" id="modal-edit-attendance-btn"><i class="bi bi-pencil-square"></i> Edit/Correct</button>' : ''}
                        <button type="button" class="close-photo-modal-btn attendance-photo-close-btn">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#close-photo-modal');
        const closeActionBtn = modal.querySelector('.close-photo-modal-btn');
        const editActionBtn = modal.querySelector('#modal-edit-attendance-btn');
        const deleteActionBtn = modal.querySelector('#modal-delete-attendance-btn');
        const closeModal = () => modal.remove();

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeActionBtn) closeActionBtn.addEventListener('click', closeModal);

        if (editActionBtn) {
            editActionBtn.addEventListener('click', async () => {
                const updated = await editAttendanceLog(logId, effectiveRawAction, effectiveRawTimestamp);
                if (updated) closeModal();
            });
        }

        if (deleteActionBtn) {
            deleteActionBtn.addEventListener('click', async () => {
                const deleted = await deleteAttendanceLog(logId);
                if (deleted) closeModal();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    } catch (error) {
        console.error('Failed to fetch photo:', error);
        showAlert('Failed to load attendance photo');
    }
}

// Load data when page loads
loadAttendanceStats();
loadAttendanceLogs();
loadConstructionSites();

}); // End DOMContentLoaded

// ==========================================
// END ATTENDANCE MODULE
// ==========================================
