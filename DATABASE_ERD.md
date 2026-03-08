# CICJ-ICMS Entity-Relationship Diagram (ERD)

## Complete Database Schema Visualization

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER TABLE                             │
│ ------------------------------------------------------------------- │
│ PK: user_id (INT AUTO_INCREMENT)                                    │
│ UK: email (VARCHAR UNIQUE)                                          │
│ ------------------------------------------------------------------- │
│ • full_name (VARCHAR)                                               │
│ • email (VARCHAR UNIQUE)                                            │
│ • password_hash (VARCHAR) - bcrypt hashed                           │
│ • role (VARCHAR) - "ADMIN" | "EMPLOYEE"                             │
│ • contact_number (VARCHAR NULL)                                     │
│ • mfa_secret (VARCHAR NULL) - For 2FA authentication                │
│ • is_active (BOOLEAN DEFAULT true)                                  │
│ • created_at (DATETIME DEFAULT NOW)                                 │
│                                                                     │
│ ═══════════════ GRANULAR PERMISSIONS MATRIX ═══════════════════════ │
│ User Management (5 flags):                                          │
│ • can_view_users, can_add_users, can_edit_users                     │
│ • can_delete_users, can_activate_users                              │
│                                                                     │
│ Attendance (5 flags):                                               │
│ • can_view_own_attendance, can_view_all_attendance                  │
│ • can_edit_attendance, can_delete_attendance, can_export_attendance │
│                                                                     │
│ Equipment (5 flags):                                                │
│ • can_view_equipment, can_add_equipment, can_edit_equipment         │
│ • can_delete_equipment, can_assign_equipment                        │
│                                                                     │
│ Files (5 flags):                                                    │
│ • can_view_files, can_upload_files, can_edit_files                  │
│ • can_delete_files, can_download_files                              │
│                                                                     │
│ Inquiries (5 flags):                                                │
│ • can_view_inquiries, can_add_inquiries, can_update_inquiries       │
│ • can_delete_inquiries, can_assign_inquiries                        │
│                                                                     │
│ System Health (2 flags):                                            │
│ • can_view_health_logs, can_export_health_logs                      │
│                                                                     │
│ Administration (3 flags):                                           │
│ • can_manage_permissions, can_view_audit_trail, can_backup_database │
│                                                                     │
│ Total: 30 permission flags for fine-grained access control          │
└──────────┬──────────────────────────────────────┬────────────────────┘
           │                                      │
           │ 1:N                                  │ 1:N
           │                                      │
┌──────────▼────────────────────────┐  ┌──────────▼──────────────────┐
│    ATTENDANCE_LOG TABLE           │  │   PROJECT_FILE TABLE        │
│ --------------------------------- │  │ --------------------------- │
│ PK: log_id (INT AUTO_INCREMENT)   │  │ PK: file_id (INT AUTO)      │
│ FK: user_id → User(user_id)       │  │ FK: uploader_id → User      │
│ --------------------------------- │  │ --------------------------- │
│ • user_id (INT FK)                │  │ • uploader_id (INT FK)      │
│ • date (DATE)                     │  │ • file_name (VARCHAR)       │
│ • time_in (DATETIME NULL)         │  │ • file_type (VARCHAR)       │
│ • time_out (DATETIME NULL)        │  │ • file_size_mb (DECIMAL)    │
│                                   │  │ • storage_location (VARCHAR)│
│ GPS TRACKING FOR SITE VERIFICATION│  │   - "LOCAL_FTP" or "CLOUD"  │
│ • gps_lat_in (DECIMAL 9,6 NULL)   │  │ • cloudinary_url (TEXT NULL)│
│ • gps_long_in (DECIMAL 9,6 NULL)  │  │ • cloudinary_public_id (...)│
│ • gps_lat_out (DECIMAL 9,6 NULL)  │  │ • local_ftp_path (TEXT NULL)│
│ • gps_long_out (DECIMAL 9,6 NULL) │  │ • uploaded_at (DATETIME)    │
│                                   │  │                             │
│ • status (VARCHAR DEFAULT "On Time"  │                             │
│   "Late", "Absent")               │  │ HYBRID STORAGE STRATEGY:    │
│                                   │  │ Cloud for active projects   │
│ Indexes:                          │  │ Local FTP for archives      │
│ - INDEX(user_id, date)            │  └─────────────────────────────┘
│ - INDEX(date)                     │
└───────────────────────────────────┘
           ▲
           │ 1:N
           │
┌──────────┴────────────────────────────────────────────────┐
│                  CLIENT_INQUIRY TABLE                     │
│ --------------------------------------------------------- │
│ PK: inquiry_id (INT AUTO_INCREMENT)                       │
│ FK: handled_by → User(user_id) NULLABLE                   │
│ --------------------------------------------------------- │
│ • inquiry_id (INT PK)                                     │
│ • client_name (VARCHAR)                                   │
│ • client_email (VARCHAR)                                  │
│ • contact_number (VARCHAR NULL)                           │
│ • message_body (TEXT)                                     │
│ • status (VARCHAR DEFAULT "Pending")                      │
│   - "Pending", "In Progress", "Resolved", "Closed"        │
│ • handled_by (INT FK NULL) - Assigned admin/sales         │
│ • submitted_at (DATETIME DEFAULT NOW)                     │
│                                                           │
│ Indexes:                                                  │
│ - INDEX(status)                                           │
│ - INDEX(handled_by)                                       │
└───────────────────────────────────────────────────────────┘


┌────────────────────────────────────────────────────────────┐
│            EQUIPMENT_INVENTORY TABLE                       │
│ ---------------------------------------------------------- │
│ PK: equipment_id (INT AUTO_INCREMENT)                      │
│ ---------------------------------------------------------- │
│ • equipment_id (INT PK)                                    │
│ • item_name (VARCHAR) - e.g., "Concrete Mixer"             │
│ • category (VARCHAR NULL) - "Power Tools", "Safety Gear"   │
│ • status (VARCHAR DEFAULT "Available")                     │
│   - "Available", "In Use", "Maintenance", "Retired"        │
│ • assigned_to (INT NULL) - References User(user_id)        │
│ • current_location (VARCHAR NULL) - "Site A", "Warehouse"  │
│ • last_updated (DATETIME AUTO_UPDATE)                      │
│                                                            │
│ Indexes:                                                   │
│ - INDEX(status)                                            │
│ - INDEX(assigned_to)                                       │
└────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│            SYSTEM_HEALTH_LOG TABLE                          │
│ ----------------------------------------------------------- │
│ PK: sys_log_id (INT AUTO_INCREMENT)                         │
│ ----------------------------------------------------------- │
│ • sys_log_id (INT PK)                                       │
│ • event_type (VARCHAR)                                      │
│   - "LOGIN", "LOGOUT", "PERMISSION_CHANGE", "ERROR"         │
│   - "BACKUP_CREATED", "SCHEMA_UPDATE", "API_CALL"           │
│ • description (TEXT) - Detailed event information           │
│ • ip_address (VARCHAR) - Required for SAM audit compliance  │
│ • timestamp (DATETIME DEFAULT NOW)                          │
│                                                             │
│ SAM COMPLIANCE: All system events logged with IP for audit  │
│                                                             │
│ Indexes:                                                    │
│ - INDEX(event_type)                                         │
│ - INDEX(timestamp)                                          │
│ - INDEX(ip_address) - For security investigations          │
└─────────────────────────────────────────────────────────────┘
```

---

## Relationships Summary

### One-to-Many Relationships

1. **User → Attendance_Log** (1:N)
   - One user has many attendance logs
   - FK: `Attendance_Log.user_id` → `User.user_id`
   - Cascade: DELETE SET NULL (preserve attendance history)

2. **User → Project_File** (1:N)
   - One user uploads many files
   - FK: `Project_File.uploader_id` → `User.user_id`
   - Cascade: DELETE SET NULL (preserve file history)

3. **User → Client_Inquiry** (1:N)
   - One user handles many inquiries
   - FK: `Client_Inquiry.handled_by` → `User.user_id`
   - Cascade: DELETE SET NULL (preserve inquiry history)

### Standalone Tables

4. **Equipment_Inventory**
   - No formal FK constraint (soft reference to User)
   - `assigned_to` references `User.user_id` logically
   - Allows equipment to exist without assignment

5. **System_Health_Log**
   - Independent audit table
   - No foreign keys (system events, not user-specific)

---

## Key Design Decisions

### 1. GPS Coordinates (Decimal 9,6)
```sql
gps_lat_in   DECIMAL(9,6)  -- e.g., 14.599512 (Manila, Philippines)
gps_long_in  DECIMAL(9,6)  -- e.g., 120.984222
```
- **Precision**: 6 decimal places = ~0.11 meters accuracy
- **Range**: 9 total digits = supports -90 to 90 (latitude), -180 to 180 (longitude)
- **Use Case**: Verify employees are at construction site during clock-in

### 2. Hybrid File Storage
```javascript
storage_location: "LOCAL_FTP" | "CLOUD"

// Cloud storage (Cloudinary)
if (storage_location === "CLOUD") {
  url = cloudinary_url;
  publicId = cloudinary_public_id;
}

// Local FTP storage
if (storage_location === "LOCAL_FTP") {
  path = local_ftp_path;
}
```
- **Active Projects**: Cloud storage for quick access
- **Archived Projects**: Local FTP for cost savings
- **Large Files**: Local FTP (CAD files, videos)

### 3. MFA Support (mfa_secret)
```javascript
// Time-based One-Time Password (TOTP)
const speakeasy = require('speakeasy');

// Generate secret during MFA setup
const secret = speakeasy.generateSecret();
user.mfa_secret = secret.base32;

// Verify during login
const verified = speakeasy.totp.verify({
  secret: user.mfa_secret,
  encoding: 'base32',
  token: userEnteredCode
});
```

### 4. Soft Deletes (is_active)
Instead of hard-deleting users:
```sql
UPDATE User SET is_active = false WHERE user_id = 123;
```
Benefits:
- Preserves attendance history
- Maintains audit trail
- Can reactivate accounts

---

## Database Indexes (Performance Optimization)

### High-Traffic Queries

```sql
-- Attendance by date range (daily reports)
CREATE INDEX idx_attendance_date ON Attendance_Log(date);
CREATE INDEX idx_attendance_user_date ON Attendance_Log(user_id, date);

-- Equipment availability
CREATE INDEX idx_equipment_status ON Equipment_Inventory(status);

-- Inquiry queue
CREATE INDEX idx_inquiry_status ON Client_Inquiry(status);
CREATE INDEX idx_inquiry_handler ON Client_Inquiry(handled_by);

-- System logs (security investigations)
CREATE INDEX idx_health_log_type ON System_Health_Log(event_type);
CREATE INDEX idx_health_log_timestamp ON System_Health_Log(timestamp);
CREATE INDEX idx_health_log_ip ON System_Health_Log(ip_address);

-- User authentication (login)
CREATE UNIQUE INDEX idx_user_email ON User(email);
```

---

## Sample Data Flow

### Example 1: Employee Clock-In with GPS
```
1. Employee opens employee.html on mobile phone at construction site
2. Clicks "Clock In" button
3. Frontend captures GPS: navigator.geolocation.getCurrentPosition()
4. POST /api/attendance/clockin
   {
     user_id: 45,
     gps_lat_in: 14.599512,
     gps_long_in: 120.984222,
     time_in: "2026-03-08T08:00:00Z"
   }
5. Backend verifies permission: can_view_own_attendance
6. Creates Attendance_Log record
7. Creates System_Health_Log:
   - event_type: "ATTENDANCE_CLOCK_IN"
   - description: "User 45 clocked in at Site A"
   - ip_address: req.ip
```

### Example 2: Admin Uploads Project File to Cloud
```
1. Admin opens admin.html → Portfolio tab
2. Selects file: blueprint.pdf (12.5 MB)
3. POST /api/files/upload with permission check: can_upload_files
4. Backend uploads to Cloudinary
5. Creates Project_File record:
   {
     uploader_id: 1,
     file_name: "blueprint.pdf",
     file_size_mb: 12.5,
     storage_location: "CLOUD",
     cloudinary_url: "https://res.cloudinary.com/...",
     cloudinary_public_id: "cicj/blueprint_abc123"
   }
6. System_Health_Log:
   - event_type: "FILE_UPLOAD"
   - description: "Admin uploaded blueprint.pdf (12.5 MB) to CLOUD"
```

### Example 3: Sales Manager Assigns Inquiry
```
1. Client submits inquiry via client.html contact form
2. Creates Client_Inquiry (handled_by = NULL, status = "Pending")
3. Sales Manager logs in, views Inquiries tab
4. Permission check: can_assign_inquiries = true
5. Assigns to sales rep:
   UPDATE Client_Inquiry 
   SET handled_by = 22, status = "In Progress"
   WHERE inquiry_id = 101
6. System_Health_Log:
   - event_type: "INQUIRY_ASSIGNED"
   - description: "Manager assigned inquiry #101 to User 22"
```

---

## Data Integrity Rules

### Constraints
- `User.email`: UNIQUE constraint (no duplicate accounts)
- `password_hash`: NOT NULL (all users must have password)
- `mfa_secret`: NULL allowed (MFA is optional)
- `Attendance_Log.user_id`: FK with ON DELETE CASCADE (if user deleted, attendance preserved with NULL)
- `Project_File.file_size_mb`: CHECK (file_size_mb > 0)

### Validation (Application Level)
```javascript
// User creation
if (password.length < 8) throw new Error('Password too short');
if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) throw new Error('Invalid email');

// Attendance
if (time_out < time_in) throw new Error('Time out cannot be before time in');

// GPS coordinates
if (Math.abs(gps_lat_in) > 90) throw new Error('Invalid latitude');
if (Math.abs(gps_long_in) > 180) throw new Error('Invalid longitude');
```

---

## Migration Path

### From Role-Based to Permission-Based
```javascript
// Old system (simple role check)
if (user.role === 'ADMIN') {
  allowAccess();
}

// New system (granular permissions)
if (user.can_delete_files) {
  allowAccess();
}
```

### Backwards Compatibility
```javascript
// Set default permissions based on role
if (user.role === 'ADMIN') {
  // Grant all 30 permissions
  Object.keys(PERMISSIONS).forEach(perm => user[perm] = true);
}
```

---

## Schema Version

**Version**: 2.0.0  
**Last Updated**: March 8, 2026  
**Prisma Schema**: `backend/prisma/schema.prisma`  

**Changes from v1.0**:
- ✅ Added 30 granular permission flags to User table
- ✅ Added GPS coordinates to Attendance_Log (gps_lat_in, gps_long_in, gps_lat_out, gps_long_out)
- ✅ Added mfa_secret to User table for 2FA support
- ✅ Added hybrid storage fields to Project_File (cloudinary_url, local_ftp_path)
- ✅ Renamed fields for ERD consistency (id → user_id, password → password_hash)

**Database Size Estimates**:
- Users: ~100 records (employees + admins)
- Attendance_Log: ~2,000 records/month (100 users × 20 working days)
- Equipment_Inventory: ~500 items
- Project_File: ~1,000 files (archive + active projects)
- Client_Inquiry: ~200/month
- System_Health_Log: ~10,000 events/month (audit trail)
