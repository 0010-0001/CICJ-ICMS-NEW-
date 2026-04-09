// Grant Full Admin Permissions to admin@cicj.com
// Run this script to enable all permissions for the admin user

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function grantAdminPermissions() {
    try {
        console.log('[Grant Permissions] Granting full admin permissions to admin@cicj.com...\n');
        
        const updatedUser = await prisma.user.update({
            where: { email: 'admin@cicj.com' },
            data: {
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
                
                // System Health Permissions
                can_view_health_logs: true,
                can_export_health_logs: true,
                
                // System Administration
                can_manage_permissions: true,
                can_view_audit_trail: true,
                can_backup_database: true
            }
        });
        
        console.log('[SUCCESS] Admin permissions granted to:', updatedUser.email);
        console.log('[User Details]:');
        console.log('   - Name:', updatedUser.full_name);
        console.log('   - Email:', updatedUser.email);
        console.log('   - Role:', updatedUser.role);
        console.log('\n[Permissions] All 30 permissions have been enabled.');
        console.log('\n[You can now]:');
        console.log('   - View all users in the User Management tab');
        console.log('   - Create new users with the Add New Hire button');
        console.log('   - Access all system features without permission errors');
        console.log('\n[Note] Refresh your browser to see the updated user list!\n');
        
    } catch (error) {
        console.error('\n[ERROR]:', error.message);
        
        if (error.code === 'P2025') {
            console.log('\n[TIP] The admin@cicj.com user does not exist in the database.');
            console.log('   Please create the admin user first by logging in at http://localhost:5000/index.html\n');
        } else {
            console.log('\n[TIP] Make sure the database is running and accessible.\n');
        }
    } finally {
        await prisma.$disconnect();
    }
}

grantAdminPermissions();
