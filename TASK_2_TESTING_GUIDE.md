# Task 2 Testing Guide - Admin Features UI

## ✅ Task 2 Complete: System Health Monitoring + Permissions Matrix

### 📦 What Was Implemented:

#### 1. **System Health Monitoring Tab** (Enhanced)
The System Health tab now displays comprehensive monitoring data:

**Server Status Cards:**
- ✅ Server Uptime (99.9% - last 30 days)
- ✅ Database Status (MySQL Connected indicator)
- ✅ Last Backup timestamp
- ✅ Active Users count

**Database Backup History Table:**
- ✅ Backup ID, Timestamp, Type (Automated/Manual)
- ✅ Backup Size, Status badges
- ✅ Storage location (LOCAL_FTP/CLOUD)
- ✅ "Trigger Backup" button for manual backups

**Network IP Logs & Audit Trail:**
- ✅ Complete event logging (LOGIN, PERMISSION_CHANGE, FILE_UPLOAD, etc.)
- ✅ IP Address tracking for SAM compliance
- ✅ User attribution for all events
- ✅ "Export Logs (CSV)" button for compliance reports

#### 2. **Add New Hire Modal** (New Feature)
Comprehensive user provisioning with granular permissions:

**Basic User Information:**
- Full Name, Email, Contact Number
- Role selection (ADMIN/EMPLOYEE)
- Password with confirmation (min 8 chars)
- Account Active toggle

**Visual Permissions Matrix (30 Checkboxes):**
Organized into 6 categories:

1. **👥 User Management** (5 permissions)
   - View Users, Add Users, Edit Users, Delete Users, Activate/Deactivate

2. **📅 Attendance** (5 permissions)
   - View Own, View All, Edit/Correct, Delete, Export Reports

3. **🔧 Equipment** (5 permissions)
   - View Inventory, Add, Edit, Delete, Assign to Workers

4. **📁 Project Files** (5 permissions)
   - View Files, Upload, Edit Metadata, Delete, Download

5. **💬 Client Inquiries** (5 permissions)
   - View, Submit, Update Status, Delete, Assign to Team

6. **⚙️ System Admin** (5 permissions)
   - View Health Logs, Export Logs (SAM), Manage Permissions, View Audit Trail, Database Backups

**Quick Permission Presets:**
- 🛠️ **Field Worker** - Minimal access (view own attendance, equipment, files)
- 👷 **Supervisor** - Team management (assign equipment, view team attendance)
- 📋 **HR Admin** - People operations (user management, attendance editing, payroll export)
- 💼 **Sales Manager** - Customer relations (inquiries, file uploads)
- 🔑 **Super Admin** - Full access (all 30 permissions)
- ❌ **Clear All** - Reset all permissions

---

## 🧪 How to Test

### Step 1: Open Admin Dashboard
1. Open [admin.html](admin.html) in your browser
2. Login with: `admin@cicj.com` / `Password123!`

### Step 2: Test System Health Monitoring
1. Click **"System Health"** tab in sidebar
2. Verify you see:
   - ✅ 4 status cards (Uptime, DB Status, Last Backup, Active Users)
   - ✅ Database Backup History table with 3 sample backups
   - ✅ Network IP Logs table with 4 sample events
3. Click **"Trigger Backup"** button
   - Should show alert: "Database backup initiated..."
4. Click **"Export Logs (CSV)"** button
   - Should show alert: "Exporting network IP logs for SAM compliance..."

### Step 3: Test Add New Hire Modal
1. Click **"User Management"** tab in sidebar
2. Click **"+ Add New Hire"** button
3. Modal should open with full permissions matrix

### Step 4: Test Permission Presets
1. In the Add New Hire modal, try each preset button:
   - Click **"Field Worker"** → Only 5 basic permissions checked
   - Click **"Supervisor"** → 9 permissions checked
   - Click **"HR Admin"** → 11 permissions checked
   - Click **"Sales Manager"** → 7 permissions checked
   - Click **"Super Admin"** → All 30 permissions checked
   - Click **"Clear All"** → All unchecked

### Step 5: Test Form Submission
1. Fill out the form:
   - Full Name: "Juan dela Cruz"
   - Email: "juan@cicj.com"
   - Contact: "+63 912 345 6789"
   - Role: "EMPLOYEE"
   - Password: "TestPass123!"
   - Confirm Password: "TestPass123!"
2. Select a preset (e.g., "Field Worker")
3. Click **"Create User Account"**
4. Check browser console (F12) to see the complete JSON object with permissions:

```json
{
  "full_name": "Juan dela Cruz",
  "email": "juan@cicj.com",
  "contact_number": "+63 912 345 6789",
  "role": "EMPLOYEE",
  "password": "TestPass123!",
  "is_active": true,
  "can_view_users": false,
  "can_add_users": false,
  "can_view_own_attendance": true,
  "can_view_equipment": true,
  "can_view_files": true,
  "can_download_files": true,
  "can_add_inquiries": true,
  // ... (all 30 permissions)
}
```

### Step 6: Test Manual Permission Selection
1. Open modal again
2. **Don't use a preset** - manually check/uncheck individual permissions
3. For example:
   - Check: can_view_all_attendance
   - Check: can_assign_equipment
   - Check: can_upload_files
   - Leave all others unchecked
4. Submit and verify in console that only those 3 are `true`

---

## 🎨 UI Components Added

### Files Modified:

**[admin.html](admin.html)**:
- Enhanced System Health tab with detailed monitoring UI
- Added comprehensive Add New Hire modal with permission matrix
- Updated User Management tab with "Permissions" column

**[css/admin.css](css/admin.css)**:
- `.permissions-grid` - Responsive grid for permission categories
- `.permission-category` - Card styling for each category
- `.checkbox-label` - Interactive checkbox labels with hover effects
- System Health specific styles (`.text-success`, `.text-orange`)
- Badge variants (`.badge.success`, `.badge.warning`)

**[js/admin.js](js/admin.js)**:
- Modal open/close handlers for Add New Hire modal
- Permission preset functionality (5 predefined templates)
- Form validation (password matching, min length)
- Permission data capture (30 boolean flags)
- System Health button handlers (backup, export logs)

---

## 📊 Data Structure

### Add New Hire Form Output:

```javascript
{
  // Basic Info
  full_name: "Juan dela Cruz",
  email: "juan@cicj.com",
  contact_number: "+63 912 345 6789",
  role: "EMPLOYEE",
  password: "TestPass123!",
  is_active: true,
  
  // User Management (5)
  can_view_users: false,
  can_add_users: false,
  can_edit_users: false,
  can_delete_users: false,
  can_activate_users: false,
  
  // Attendance (5)
  can_view_own_attendance: true,
  can_view_all_attendance: false,
  can_edit_attendance: false,
  can_delete_attendance: false,
  can_export_attendance: false,
  
  // Equipment (5)
  can_view_equipment: true,
  can_add_equipment: false,
  can_edit_equipment: false,
  can_delete_equipment: false,
  can_assign_equipment: false,
  
  // Files (5)
  can_view_files: true,
  can_upload_files: false,
  can_edit_files: false,
  can_delete_files: false,
  can_download_files: true,
  
  // Inquiries (5)
  can_view_inquiries: false,
  can_add_inquiries: true,
  can_update_inquiries: false,
  can_delete_inquiries: false,
  can_assign_inquiries: false,
  
  // System Admin (5)
  can_view_health_logs: false,
  can_export_health_logs: false,
  can_manage_permissions: false,
  can_view_audit_trail: false,
  can_backup_database: false
}
```

---

## 🔐 Permission Preset Details

### Field Worker Preset (5 permissions):
```javascript
['can_view_own_attendance', 'can_view_equipment', 'can_view_files', 
 'can_download_files', 'can_add_inquiries']
```
**Use Case**: Construction site workers who only need to clock in/out and view assignments.

### Supervisor Preset (9 permissions):
```javascript
['can_view_own_attendance', 'can_view_all_attendance', 'can_export_attendance',
 'can_view_equipment', 'can_assign_equipment', 'can_view_files', 
 'can_upload_files', 'can_download_files', 'can_add_inquiries']
```
**Use Case**: Field supervisors managing teams, assigning equipment, uploading progress photos.

### HR Admin Preset (11 permissions):
```javascript
['can_view_users', 'can_add_users', 'can_edit_users', 'can_activate_users',
 'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance',
 'can_export_attendance', 'can_view_equipment', 'can_view_files', 
 'can_download_files']
```
**Use Case**: HR department handling user management, attendance corrections, payroll exports.

### Sales Manager Preset (7 permissions):
```javascript
['can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries',
 'can_assign_inquiries', 'can_view_files', 'can_upload_files', 
 'can_download_files']
```
**Use Case**: Sales team managing client inquiries and uploading proposals.

### Super Admin Preset (30 permissions):
All permissions enabled - complete system access.

---

## 🚀 Backend Integration (Week 6)

Currently, all functionality is **frontend-ready** with console logging. When connecting to backend:

### Add New Hire Endpoint:
```javascript
POST /register
Headers: { 'Authorization': 'Bearer <admin_token>' }
Body: {
  full_name: "...",
  email: "...",
  password: "...",
  role: "...",
  // All 30 permission flags
  can_view_users: true,
  can_add_equipment: false,
  // ... etc
}
```

### System Health Endpoints:
```javascript
// Trigger manual backup
POST /api/system/backup
Headers: { 'Authorization': 'Bearer <admin_token>' }

// Export logs
GET /api/system/export-logs?token=<admin_token>
Response: CSV download
```

---

## ✅ Task 2 Checklist

- ✅ System Health Monitoring tab with server uptime display
- ✅ Network IP logs table (SAM compliance)
- ✅ Database backup status table
- ✅ Backup history with storage location
- ✅ "Trigger Backup" button
- ✅ "Export Logs" button for CSV download
- ✅ Add New Hire modal with complete form
- ✅ Visual Permissions Matrix (30 checkboxes)
- ✅ 6 permission categories (Users, Attendance, Equipment, Files, Inquiries, System)
- ✅ 5 quick permission presets (Field Worker, Supervisor, HR Admin, Sales Manager, Super Admin)
- ✅ "Clear All" permissions button
- ✅ Form validation (password matching, min length)
- ✅ Permission data capture as JSON
- ✅ Console logging for debugging
- ✅ Responsive design (mobile-friendly)
- ✅ Hover effects on checkboxes
- ✅ Modal open/close functionality
- ✅ Git commit completed

---

## 📸 Screenshots (Visual Reference)

When testing, you should see:

**System Health Tab:**
```
┌─────────────────────────────────────────────────────┐
│ System Health Monitoring                             │
├─────────────────────────────────────────────────────┤
│ [Server Uptime] [DB Status] [Last Backup] [Active]  │
│    99.9%         ● MySQL     2 hours ago      8      │
├─────────────────────────────────────────────────────┤
│ Database Backup History        [Trigger Backup]     │
│ ┌──────────────────────────────────────────────┐    │
│ │ ID | Time | Type | Size | Status | Storage  │    │
│ └──────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│ Network IP Logs              [Export Logs (CSV)]    │
│ ┌──────────────────────────────────────────────┐    │
│ │ Time | Event | Description | IP | User      │    │
│ └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Add New Hire Modal:**
```
┌──────────────────────────────────────────────────┐
│ Add New Hire - Account Provisioning        [×]  │
├──────────────────────────────────────────────────┤
│ Full Name: [____________]  Email: [___________]  │
│ Contact: [____________]    Role: [EMPLOYEE ▼]    │
│ Password: [____________]   Confirm: [_________]  │
├──────────────────────────────────────────────────┤
│ 🔐 Granular Permissions Matrix                   │
│ ┌─────────────┬─────────────┬─────────────┐     │
│ │👥 User Mgmt │📅 Attendance│🔧 Equipment │     │
│ │☐ View Users │☑ View Own   │☑ View Inv   │     │
│ │☐ Add Users  │☐ View All   │☐ Add Equip  │     │
│ └─────────────┴─────────────┴─────────────┘     │
│ Quick Presets:                                   │
│ [Field Worker] [Supervisor] [HR Admin] [Clear]  │
├──────────────────────────────────────────────────┤
│ ☑ Account Active        [Cancel] [Create User]  │
└──────────────────────────────────────────────────┘
```

---

## 🎯 Next Steps (Week 6)

1. **Backend API**: Implement `/register` endpoint with permission validation
2. **Database**: Ensure all 30 permission columns exist in User table (already done in schema)
3. **Audit Logging**: Log permission changes to System_Health_Log table
4. **CSV Export**: Implement log export functionality for SAM compliance
5. **Backup System**: Create automated backup scheduler and manual trigger
6. **Real-time Updates**: Add WebSocket for live system health monitoring

---

**Task 2 is complete and ready for user acceptance testing!** 🎉
