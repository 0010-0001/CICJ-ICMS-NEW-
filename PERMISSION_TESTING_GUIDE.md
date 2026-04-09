# Permission System Testing Guide

## Overview
This guide provides comprehensive testing procedures for the automated permission system that dynamically adjusts employee dashboards based on permissions granted by the admin.

## System Architecture

### Database Permissions (29 Total)
From `backend/prisma/schema.prisma`:

#### Employee-Level Permissions (Default: true)
- `can_view_own_attendance` - View personal attendance records
- `can_view_equipment` - View and checkout equipment
- `can_view_files` - View project files
- `can_download_files` - Download project files

#### Admin-Level Permissions (Default: false)

**User Management (5)**
- `can_view_users` - View user list
- `can_add_users` - Create new users
- `can_edit_users` - Modify user information
- `can_delete_users` - Remove users
- `can_activate_users` - Activate/deactivate user accounts

**Attendance Management (4)**
- `can_view_all_attendance` - View all employee attendance
- `can_edit_attendance` - Modify attendance records
- `can_delete_attendance` - Delete attendance records
- `can_export_attendance` - Export attendance data

**Equipment Management (4)**
- `can_add_equipment` - Add new equipment
- `can_edit_equipment` - Modify equipment details
- `can_delete_equipment` - Remove equipment
- `can_assign_equipment` - Assign equipment to employees

**Project Files Management (3)**
- `can_upload_files` - Upload new files
- `can_edit_files` - Modify file metadata
- `can_delete_files` - Remove files

**Client Inquiries Management (4)**
- `can_view_inquiries` - View client inquiries
- `can_update_inquiries` - Update inquiry status
- `can_delete_inquiries` - Delete inquiries
- `can_assign_inquiries` - Assign inquiries to staff

**System Administration (4)**
- `can_view_health_logs` - View system health logs
- `can_export_health_logs` - Export health logs
- `can_manage_permissions` - Manage user permissions
- `can_view_audit_trail` - View audit trail
- `can_backup_database` - Create database backups

---

## Testing Procedures

### Phase 1: Employee Dashboard - Default Permissions

**Test 1.1: Fresh Employee Account (4 Default Permissions)**
1. Create new employee account via registration
2. Login to employee dashboard
3. **Expected Result:**
   - ✅ My Attendance tab visible
   - ✅ Equipment Checkout tab visible
   - ✅ Project Files tab visible
   - ✅ My Profile tab visible
4. **Console Check:** Look for permission analysis log:
   ```
   👤 Employee Dashboard Loaded: {
     role: "EMPLOYEE",
     hasAdminAccess: false,
     grantedCount: 4,
     grantedPermissions: [...],
     availableEmployeeFeatures: ["My Attendance", "Equipment Checkout", "Project Files", "My Profile"]
   }
   ```

**Test 1.2: Revoke All Permissions**
1. In admin panel, uncheck all 4 default permissions
2. Save changes
3. **Expected Result (within 5 seconds):**
   - ❌ My Attendance tab disappears
   - ❌ Equipment Checkout tab disappears
   - ❌ Project Files tab disappears
   - ✅ My Profile tab remains (always visible)
   - 🔔 Notification: "⚠ Permissions removed. 3 feature(s) no longer available."

**Test 1.3: Individual Permission Testing**
Test each permission individually:

| Permission | Expected Visible Tabs |
|------------|----------------------|
| `can_view_own_attendance` only | My Attendance, My Profile |
| `can_view_equipment` only | Equipment Checkout, My Profile |
| `can_view_files` only | Project Files, My Profile |
| `can_download_files` only | Project Files, My Profile |
| None | My Profile only |

---

### Phase 2: Admin Dashboard Access

**Test 2.1: Grant Single Admin Permission**
1. Employee currently has only default permissions
2. In admin panel, grant `can_view_users` permission
3. **Expected Result (within 5 seconds):**
   - 🔔 Notification: "✓ New permissions granted! 1 new feature(s) available."
   - Dashboard switches from employee to admin layout
   - Admin sidebar appears with:
     - ✅ Overview
     - ✅ User Management
     - ❌ Other admin tabs (no permissions)

**Test 2.2: Cumulative Admin Permissions**
Grant permissions one at a time and verify tabs appear:

| Permission Granted | New Tab Appearing |
|-------------------|-------------------|
| `can_view_users` | User Management |
| `can_view_all_attendance` | Attendance Management |
| `can_add_equipment` | Equipment Inventory |
| `can_upload_files` | Project Files (admin version) |
| `can_view_inquiries` | Client Inquiries |
| `can_view_health_logs` | System Health |

**Test 2.3: Admin Role Override**
1. Set user role to "ADMIN" in database
2. Remove all admin permissions
3. **Expected Result:**
   - User still has admin dashboard access (role overrides permissions)
   - All admin tabs visible

---

### Phase 3: Real-Time Permission Updates

**Test 3.1: Permission Grant - Real-Time**
1. Open employee dashboard (employee view)
2. Open admin panel in separate window/browser
3. Grant `can_view_all_attendance` permission
4. **Expected Result (within 5 seconds):**
   - Employee dashboard auto-switches to admin view
   - Attendance Management tab appears
   - Notification displays: "✓ New permissions granted! 1 new feature(s) available."
   - Console logs:
     ```
     🔐 Permission Changes Detected: {
       user: "employee@example.com",
       added: ["can_view_all_attendance"],
       removed: "none",
       totalBefore: 4,
       totalAfter: 5
     }
     ```

**Test 3.2: Permission Revoke - Real-Time**
1. Employee dashboard has admin access (1+ admin permissions)
2. In admin panel, remove all admin permissions
3. **Expected Result (within 5 seconds):**
   - Dashboard switches back to employee view
   - Admin tabs disappear, employee tabs appear
   - Notification: "⚠ Permissions removed. X feature(s) no longer available."

**Test 3.3: Rapid Permission Changes**
1. Grant and revoke multiple permissions within 10 seconds
2. **Expected Result:**
   - Dashboard updates reflect all changes (may take up to 5 seconds per change)
   - Multiple notifications may appear
   - No JavaScript errors in console

---

### Phase 4: Feature Access Control

**Test 4.1: User Management Features**
Test each permission's effect:

| Permission | Can View Users | Can Add | Can Edit | Can Delete | Can Activate |
|-----------|---------------|---------|----------|-----------|--------------|
| None | ❌ | ❌ | ❌ | ❌ | ❌ |
| `can_view_users` | ✅ | ❌ | ❌ | ❌ | ❌ |
| + `can_add_users` | ✅ | ✅ | ❌ | ❌ | ❌ |
| + `can_edit_users` | ✅ | ✅ | ✅ | ❌ | ❌ |
| + `can_delete_users` | ✅ | ✅ | ✅ | ✅ | ❌ |
| + `can_activate_users` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Test 4.2: Equipment Inventory Features**
Verify permission hierarchy:
- `can_view_equipment` - Employee can checkout/return
- `can_add_equipment` - Admin can add new equipment
- `can_edit_equipment` - Admin can modify equipment details
- `can_delete_equipment` - Admin can delete equipment
- `can_assign_equipment` - Admin can assign to employees

**Test 4.3: Project Files Features**
Test file operation permissions:
1. Grant only `can_view_files`
   - ✅ Can view file list
   - ❌ Cannot upload, edit, delete
2. Grant `can_download_files`
   - ✅ Download button appears
3. Grant `can_upload_files`
   - ✅ Upload button appears in admin view
4. Grant `can_delete_files`
   - ✅ Delete button appears for each file

**Test 4.4: Client Inquiries Features (NEW)**
Verify inquiry management:
1. Grant `can_view_inquiries`
   - ✅ Client Inquiries tab appears
   - ✅ Can view inquiry list
2. Grant `can_update_inquiries`
   - ✅ Status update dropdown enabled
3. Grant `can_assign_inquiries`
   - ✅ Assignment controls visible

---

### Phase 5: Edge Cases & Error Handling

**Test 5.1: Concurrent Users**
1. Login same employee account in 2 browsers
2. Change permissions in admin panel
3. **Expected Result:**
   - Both dashboards update within 5 seconds
   - Both show identical tabs/features

**Test 5.2: Network Interruption**
1. Employee dashboard open
2. Stop backend server
3. **Expected Result:**
   - Permission refresh fails silently (no errors)
   - Dashboard remains functional with cached permissions
4. Restart server, change permissions
5. **Expected Result:**
   - Updates resume within 5 seconds

**Test 5.3: Token Expiration**
1. Let JWT token expire (if implemented)
2. **Expected Result:**
   - User redirected to login page
   - No console errors

**Test 5.4: Database Permission Mismatch**
1. Add new permission to database schema
2. Don't update `permissions-map.js`
3. Grant new permission to user
4. **Expected Result:**
   - No errors (permission ignored if not in map)
   - User retains access to mapped features

---

### Phase 6: Performance Testing

**Test 6.1: Poll Frequency Verification**
1. Open browser developer tools → Network tab
2. Filter for `/api/me` requests
3. **Expected Result:**
   - Request every 5 seconds (not 30 seconds)
   - No duplicate simultaneous requests

**Test 6.2: Large Permission Set**
1. Grant all 29 permissions to employee
2. **Expected Result:**
   - Dashboard loads without lag
   - All admin tabs visible
   - Permission analysis logged correctly

**Test 6.3: Permission Change Detection**
1. Grant 5 permissions at once
2. Check console logs
3. **Expected Result:**
   - Single notification (not 5 separate)
   - Logs show all 5 added permissions
   - Dashboard re-renders once (not 5 times)

---

## Debugging Commands

### Browser Console Commands

**Get current user permissions:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
analyzeUserPermissions(user);
```

**Check available features:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('Admin Features:', getAvailableFeatures(user, true));
console.log('Employee Features:', getAvailableFeatures(user, false));
```

**Check admin access:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('Has Admin Access:', hasAdminAccess(user));
```

**Test permission refresh manually:**
```javascript
fetch('http://localhost:5000/api/me', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
})
.then(r => r.json())
.then(data => {
    console.log('Fresh User Data:', data.user);
    analyzeUserPermissions(data.user);
});
```

---

## Expected Console Logs

### On Page Load
```
👤 Employee Dashboard Loaded: {
  role: "EMPLOYEE",
  hasAdminAccess: false,
  totalPermissions: 29,
  grantedCount: 4,
  deniedCount: 25,
  grantedPermissions: ["can_view_own_attendance", "can_view_equipment", "can_view_files", "can_download_files"],
  deniedPermissions: [...],
  availableAdminFeatures: [],
  availableEmployeeFeatures: ["My Attendance", "Equipment Checkout", "Project Files", "My Profile"]
}
```

### On Permission Change
```
🔐 Permission Changes Detected: {
  user: "john.doe@company.com",
  added: ["can_view_all_attendance"],
  removed: "none",
  totalBefore: 4,
  totalAfter: 5
}
```

---

## Common Issues & Solutions

### Issue 1: Dashboard doesn't update after permission change
**Possible Causes:**
- Backend server not running on port 5000
- Network error blocking API requests
- Browser console shows 401/403 errors

**Solution:**
1. Check backend server: `npm start` in backend folder
2. Verify API endpoint: `http://localhost:5000/api/me`
3. Check token validity in localStorage

### Issue 2: All tabs missing except My Profile
**Possible Causes:**
- All permissions revoked
- Permission map not loaded (permissions-map.js error)

**Solution:**
1. Check browser console for JavaScript errors
2. Verify `permissions-map.js` loaded before `employee.js`
3. Grant at least one default permission in admin panel

### Issue 3: Admin dashboard not appearing despite admin permissions
**Possible Causes:**
- `hasAdminAccess()` function not checking granted permission
- Permission name mismatch (typo in database vs. code)

**Solution:**
1. Run `analyzeUserPermissions(user)` in console
2. Verify permission name in database matches `permissions-map.js`
3. Check if `hasAdminAccess()` includes the permission

### Issue 4: Notifications not appearing
**Possible Causes:**
- CSS animation not working
- Notification element blocked by z-index
- Permission change detection not working

**Solution:**
1. Check console for permission change logs
2. Inspect DOM for notification element
3. Verify `logPermissionChanges()` returns added/removed arrays

---

## Testing Checklist

### Basic Functionality
- [ ] Employee dashboard loads with 4 default permissions
- [ ] My Profile tab always visible
- [ ] Tabs appear/disappear based on permissions
- [ ] Admin dashboard appears when admin permission granted
- [ ] Real-time updates work within 5 seconds

### Individual Permissions
- [ ] `can_view_own_attendance` shows My Attendance tab
- [ ] `can_view_equipment` shows Equipment Checkout tab
- [ ] `can_view_files` shows Project Files tab
- [ ] `can_download_files` enables download features
- [ ] All admin permissions grant admin access

### Real-Time Updates
- [ ] Permission grant triggers notification
- [ ] Permission revoke triggers notification
- [ ] Dashboard re-renders on permission change
- [ ] Console logs permission changes

### Performance
- [ ] Poll interval is 5 seconds
- [ ] No duplicate API requests
- [ ] Dashboard loads quickly with many permissions
- [ ] Single re-render on multiple permission changes

### Edge Cases
- [ ] Works with concurrent sessions
- [ ] Handles network interruptions
- [ ] No errors with all permissions granted
- [ ] No errors with all permissions revoked

---

## Success Criteria

The permission system is considered fully working when:

1. ✅ All 29 database permissions mapped to features
2. ✅ Employee dashboard shows correct tabs based on permissions
3. ✅ Admin dashboard appears when ANY admin permission granted
4. ✅ Real-time updates occur within 5 seconds
5. ✅ Notifications display accurate information
6. ✅ Console logs provide clear debugging information
7. ✅ No JavaScript errors in console
8. ✅ System handles all edge cases gracefully

---

## Next Steps After Testing

Once all tests pass:

1. **Performance Optimization** (Optional)
   - Implement WebSocket for instant updates
   - Add exponential backoff for polling
   - Cache permission states more efficiently

2. **UI Enhancements** (Optional)
   - Add permission tooltips explaining what each permission does
   - Show "locked" icon on tabs user can't access
   - Add "Request Permission" button for employees

3. **Audit Trail** (Recommended)
   - Log all permission changes to database
   - Show admin who granted/revoked permissions
   - Track when permissions were changed

4. **Documentation**
   - Update user manual with permission system
   - Create admin guide for permission management
   - Document permission hierarchy

---

**Last Updated:** Permission System v2.0 - Automated Dashboard Adjustment
**File Version:** Complete Database Alignment (29 Permissions)
