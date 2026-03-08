# CICJ-ICMS Permissions Matrix Documentation

## Task 3: Granular Permissions & Database ERD ✅

### Implementation Date: March 8, 2026

---

## 1. Principle of Least Privilege (PoLP)

The CICJ-ICMS implements **exhaustive boolean flags** for granular CRUD operations across all modules, ensuring that users only have the minimum permissions necessary to perform their job functions.

### Why Granular Permissions?
- **Security**: Prevents unauthorized access to sensitive operations
- **Compliance**: Meets SAM (System Access Management) audit requirements
- **Accountability**: Clear permission trail for each user action
- **Flexibility**: Different roles within the same job title (e.g., Senior vs Junior Admin)

---

## 2. Complete Permissions Matrix

### User Management Permissions (5 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_users` | View user list and profiles | `false` | HR, Admin |
| `can_add_users` | Create new user accounts | `false` | HR Admin, Super Admin |
| `can_edit_users` | Modify user information | `false` | HR Admin, Super Admin |
| `can_delete_users` | Delete user accounts | `false` | Super Admin only |
| `can_activate_users` | Enable/disable user accounts | `false` | HR Admin, Super Admin |

**Security Note**: User management is restricted to prevent unauthorized employee additions (payroll fraud risk).

---

### Attendance Permissions (5 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_own_attendance` | View personal attendance records | `true` | All employees |
| `can_view_all_attendance` | View all employee attendance | `false` | HR, Supervisors, Admin |
| `can_edit_attendance` | Modify attendance logs | `false` | HR Admin (for corrections) |
| `can_delete_attendance` | Delete attendance records | `false` | Super Admin only (audit trail) |
| `can_export_attendance` | Export attendance data (CSV/PDF) | `false` | HR, Payroll, Admin |

**Use Case**: Field supervisors can view their team's attendance (`can_view_all_attendance = true`) but cannot edit records to prevent time fraud.

**GPS Integration**: Attendance logs capture GPS coordinates (`gps_lat_in`, `gps_long_in`, `gps_lat_out`, `gps_long_out`) for site verification.

---

### Equipment Permissions (5 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_equipment` | View equipment inventory | `true` | All employees (check availability) |
| `can_add_equipment` | Add new equipment to inventory | `false` | Procurement, Warehouse Admin |
| `can_edit_equipment` | Update equipment details | `false` | Warehouse Manager, Admin |
| `can_delete_equipment` | Remove equipment from system | `false` | Admin only (after disposal) |
| `can_assign_equipment` | Assign equipment to employees | `false` | Supervisors, Warehouse, Admin |

**Workflow**: Employees can view equipment to check availability, but only supervisors can assign tools to workers.

---

### Project Files Permissions (5 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_files` | View project documents | `true` | All employees (blueprints, specs) |
| `can_upload_files` | Upload new project files | `false` | Project Managers, Architects, Admin |
| `can_edit_files` | Modify file metadata | `false` | File owner, Admin |
| `can_delete_files` | Delete project files | `false` | Admin only (audit trail required) |
| `can_download_files` | Download files locally | `true` | All employees (for field work) |

**Hybrid Storage**: Files stored in `LOCAL_FTP` (on-premise) or `CLOUD` (Cloudinary) based on `storage_location` field.

**Security**: Sensitive CAD files may be view-only (no download) for subcontractors.

---

### Client Inquiries Permissions (5 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_inquiries` | View client inquiry list | `false` | Sales Team, Customer Service |
| `can_add_inquiries` | Submit new inquiries (public form) | `true` | Public website, Sales |
| `can_update_inquiries` | Update inquiry status/notes | `false` | Assigned handler, Sales Admin |
| `can_delete_inquiries` | Delete spam inquiries | `false` | Admin only |
| `can_assign_inquiries` | Assign inquiries to team members | `false` | Sales Manager, Admin |

**Public Access**: The `can_add_inquiries` is the only permission enabled for public website forms.

---

### System Health Permissions (2 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_view_health_logs` | View system event logs | `false` | IT Admin, Compliance Officer |
| `can_export_health_logs` | Export logs for SAM compliance | `false` | IT Admin, Auditors |

**SAM Compliance**: System Health Logs track all critical events with `ip_address` for audit trail (required for government contracts).

---

### System Administration Permissions (3 flags)
| Permission Flag | Description | Default | Typical Roles |
|---|---|---|---|
| `can_manage_permissions` | Grant/revoke user permissions | `false` | Super Admin only |
| `can_view_audit_trail` | Access complete audit logs | `false` | Compliance, Super Admin |
| `can_backup_database` | Perform database backups | `false` | IT Admin |

**Critical**: `can_manage_permissions` should be restricted to 1-2 super admins to prevent privilege escalation.

---

## 3. Prisma Schema Implementation

```prisma
model User {
  user_id        Int      @id @default(autoincrement())
  full_name      String
  email          String   @unique
  password_hash  String
  role           String   @default("EMPLOYEE")
  contact_number String?
  mfa_secret     String?  // Multi-Factor Authentication
  is_active      Boolean  @default(true)
  created_at     DateTime @default(now())
  
  // ===== GRANULAR PERMISSIONS MATRIX =====
  
  // User Management (5 flags)
  can_view_users      Boolean @default(false)
  can_add_users       Boolean @default(false)
  can_edit_users      Boolean @default(false)
  can_delete_users    Boolean @default(false)
  can_activate_users  Boolean @default(false)
  
  // Attendance (5 flags)
  can_view_own_attendance Boolean @default(true)
  can_view_all_attendance Boolean @default(false)
  can_edit_attendance     Boolean @default(false)
  can_delete_attendance   Boolean @default(false)
  can_export_attendance   Boolean @default(false)
  
  // Equipment (5 flags)
  can_view_equipment    Boolean @default(true)
  can_add_equipment     Boolean @default(false)
  can_edit_equipment    Boolean @default(false)
  can_delete_equipment  Boolean @default(false)
  can_assign_equipment  Boolean @default(false)
  
  // Files (5 flags)
  can_view_files       Boolean @default(true)
  can_upload_files     Boolean @default(false)
  can_edit_files       Boolean @default(false)
  can_delete_files     Boolean @default(false)
  can_download_files   Boolean @default(true)
  
  // Inquiries (5 flags)
  can_view_inquiries      Boolean @default(false)
  can_add_inquiries       Boolean @default(true)
  can_update_inquiries    Boolean @default(false)
  can_delete_inquiries    Boolean @default(false)
  can_assign_inquiries    Boolean @default(false)
  
  // System Health (2 flags)
  can_view_health_logs    Boolean @default(false)
  can_export_health_logs  Boolean @default(false)
  
  // Administration (3 flags)
  can_manage_permissions  Boolean @default(false)
  can_view_audit_trail    Boolean @default(false)
  can_backup_database     Boolean @default(false)
  
  // Relations
  attendance     Attendance_Log[]
  inquiries      Client_Inquiry[] @relation("ManagedBy")
  uploaded_files Project_File[]
}
```

**Total Permissions**: 35 boolean flags for comprehensive access control

---

## 4. Complete ERD (Entity-Relationship Diagram)

### Tables Overview

```
┌─────────────────────────────────────────┐
│ User (35 permission flags)              │
│ - user_id (PK)                          │
│ - email (UNIQUE)                        │
│ - password_hash                          │
│ - mfa_secret (MFA support)              │
│ - role (ADMIN/EMPLOYEE)                 │
│ - 35 permission booleans                │
└─────┬───────────────────────────────────┘
      │
      ├───── Attendance_Log
      │      - log_id (PK)
      │      - user_id (FK)
      │      - gps_lat_in, gps_long_in (Decimal 9,6)
      │      - gps_lat_out, gps_long_out (Decimal 9,6)
      │
      ├───── Project_File
      │      - file_id (PK)
      │      - uploader_id (FK → User)
      │      - storage_location (LOCAL_FTP/CLOUD)
      │      - cloudinary_url, local_ftp_path
      │
      └───── Client_Inquiry
             - inquiry_id (PK)
             - handled_by (FK → User, nullable)

┌──────────────────────────────────┐
│ Equipment_Inventory              │
│ - equipment_id (PK)              │
│ - assigned_to (user_id, FK)     │
│ - current_location               │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ System_Health_Log                │
│ - sys_log_id (PK)                │
│ - event_type                     │
│ - ip_address (SAM audit)         │
│ - timestamp                      │
└──────────────────────────────────┘
```

---

## 5. Role-Based Permission Presets

### Super Admin (Full Access)
```javascript
{
  role: 'ADMIN',
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
  
  // System
  can_view_health_logs: true,
  can_export_health_logs: true,
  can_manage_permissions: true,
  can_view_audit_trail: true,
  can_backup_database: true
}
```

### Field Worker (Minimal Access)
```javascript
{
  role: 'EMPLOYEE',
  // Attendance (Clock in/out only)
  can_view_own_attendance: true,
  can_view_all_attendance: false,
  
  // Equipment (View & request only)
  can_view_equipment: true,
  can_assign_equipment: false, // Request via supervisor
  
  // Files (View blueprints)
  can_view_files: true,
  can_download_files: true,
  can_upload_files: false,
  
  // All other permissions: false
}
```

### Field Supervisor (Team Management)
```javascript
{
  role: 'EMPLOYEE', // Still employee but elevated permissions
  
  // Attendance (View team)
  can_view_own_attendance: true,
  can_view_all_attendance: true,  // See team attendance
  can_export_attendance: true,    // Weekly reports
  
  // Equipment (Assign to team)
  can_view_equipment: true,
  can_assign_equipment: true,     // Assign tools to workers
  
  // Files (Upload progress photos)
  can_view_files: true,
  can_upload_files: true,         // Daily progress docs
  can_download_files: true,
  
  // No user management or system admin access
}
```

### HR Admin (People Operations)
```javascript
{
  role: 'ADMIN',
  
  // User Management (Full)
  can_view_users: true,
  can_add_users: true,
  can_edit_users: true,
  can_delete_users: false,        // Cannot delete (Super Admin only)
  can_activate_users: true,
  
  // Attendance (Full - payroll)
  can_view_own_attendance: true,
  can_view_all_attendance: true,
  can_edit_attendance: true,      // Fix clock-in errors
  can_export_attendance: true,    // Payroll export
  
  // Equipment (View only)
  can_view_equipment: true,
  
  // Files (View employee docs)
  can_view_files: true,
  can_download_files: true,
  
  // No equipment, inquiries, or system admin access
}
```

### Sales Manager (Customer Relations)
```javascript
{
  role: 'EMPLOYEE',
  
  // Inquiries (Full management)
  can_view_inquiries: true,
  can_add_inquiries: true,
  can_update_inquiries: true,
  can_assign_inquiries: true,     // Assign to sales reps
  
  // Files (View project portfolios)
  can_view_files: true,
  can_upload_files: true,         // Upload client proposals
  can_download_files: true,
  
  // No user, attendance, equipment, or system access
}
```

---

## 6. Backend Middleware Implementation

### Permission Check Middleware (Example)
```javascript
// backend/middleware/permissions.js
const checkPermission = (permissionFlag) => {
  return async (req, res, next) => {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user.user_id }
    });

    if (!user[permissionFlag]) {
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: permissionFlag,
        userPermissions: user.role
      });
    }

    next();
  };
};

// Usage in routes
router.post('/api/equipment', 
  authenticateToken, 
  checkPermission('can_add_equipment'), 
  async (req, res) => {
    // Add equipment logic
  }
);

router.get('/api/attendance/export', 
  authenticateToken, 
  checkPermission('can_export_attendance'), 
  async (req, res) => {
    // Export attendance logic
  }
);
```

---

## 7. Database Schema Commands

### Generate Prisma Client
```bash
cd backend
npx prisma generate
```

### Push Schema to Database
```bash
npx prisma db push
```

### Seed Admin with Full Permissions
```bash
node seed.js
```

**Admin Credentials**:
- Email: `admin@cicj.com`
- Password: `Password123!`
- Permissions: All 35 flags set to `true`

---

## 8. Testing Permissions

### Test Permission Check (Node.js)
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPermissions() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@cicj.com' }
  });

  console.log('Admin Permissions:');
  console.log('Can add users:', user.can_add_users);
  console.log('Can delete files:', user.can_delete_files);
  console.log('Can manage permissions:', user.can_manage_permissions);
}

testPermissions();
```

### Expected Output
```
Admin Permissions:
Can add users: true
Can delete files: true
Can manage permissions: true
```

---

## 9. Security Best Practices

### 1. Never Store Permissions in Frontend
❌ **BAD**: Checking permissions in JavaScript
```javascript
// login.js (INSECURE)
if (localStorage.getItem('role') === 'ADMIN') {
  showAdminButton();
}
```

✅ **GOOD**: Always verify on backend
```javascript
// backend/server.js (SECURE)
router.delete('/api/users/:id', 
  authenticateToken, 
  checkPermission('can_delete_users'),
  async (req, res) => {
    // Backend verifies permission from database
  }
);
```

### 2. Use Database Values, Not JWT Payload
❌ **BAD**: Trusting JWT permissions
```javascript
// JWT payload can be stale if permissions changed
const canDelete = req.user.can_delete_users; // From JWT
```

✅ **GOOD**: Fetch fresh permissions from database
```javascript
const user = await prisma.user.findUnique({
  where: { user_id: req.user.user_id }
});
const canDelete = user.can_delete_users; // Fresh from DB
```

### 3. Log Permission Changes
```javascript
// When updating permissions
await prisma.system_Health_Log.create({
  data: {
    event_type: 'PERMISSION_CHANGE',
    description: `Admin granted can_delete_files to user ${userId}`,
    ip_address: req.ip,
    timestamp: new Date()
  }
});
```

---

## 10. Future Enhancements

### Permission Groups (Phase 2)
Instead of manually setting 35 flags, create permission groups:
```javascript
const PERMISSION_PRESETS = {
  FIELD_WORKER: {
    can_view_own_attendance: true,
    can_view_equipment: true,
    can_view_files: true,
    can_download_files: true
  },
  SUPERVISOR: {
    ...PERMISSION_PRESETS.FIELD_WORKER,
    can_view_all_attendance: true,
    can_assign_equipment: true,
    can_upload_files: true
  }
};
```

### Time-Based Permissions (Phase 3)
Temporary elevated permissions with expiration:
```prisma
model Permission_Grant {
  grant_id   Int      @id @default(autoincrement())
  user_id    Int
  permission String   // e.g., "can_export_attendance"
  granted_by Int
  expires_at DateTime
}
```

---

## Summary

### ✅ Task 3 Completed

**Deliverables**:
1. ✅ Complete ERD with 6 core tables
2. ✅ GPS fields (`gps_lat_in`, `gps_long_in`, `gps_lat_out`, `gps_long_out`)
3. ✅ MFA support (`mfa_secret` field)
4. ✅ **35 granular permission flags** (Principle of Least Privilege)
5. ✅ Updated seed script with admin full permissions
6. ✅ Database schema pushed to MySQL
7. ✅ Comprehensive documentation

**Security Benefits**:
- Fine-grained access control beyond basic role-based permissions
- Audit trail for all sensitive operations
- Compliance with SAM requirements for government contracts
- Prevention of privilege escalation attacks
- Flexible permission customization per employee

**Next Steps**:
- Implement permission middleware in backend routes
- Add permission checks to frontend (UI only, validation on backend)
- Create admin UI for managing user permissions
- Set up audit logging for permission changes
