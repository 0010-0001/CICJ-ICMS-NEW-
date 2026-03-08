const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@cicj.com';
  const adminPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create the Admin using the new field names from the ERD
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      // Update existing admin with all permissions
      password_hash: hashedPassword,
      role: 'ADMIN',
      is_active: true,
      
      // ===== GRANT ALL PERMISSIONS TO ADMIN =====
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
      
      // Project Files
      can_view_files: true,
      can_upload_files: true,
      can_edit_files: true,
      can_delete_files: true,
      can_download_files: true,
      
      // Client Inquiries
      can_view_inquiries: true,
      can_add_inquiries: true,
      can_update_inquiries: true,
      can_delete_inquiries: true,
      can_assign_inquiries: true,
      
      // System Health
      can_view_health_logs: true,
      can_export_health_logs: true,
      
      // System Administration
      can_manage_permissions: true,
      can_view_audit_trail: true,
      can_backup_database: true
    },
    create: {
      full_name: 'Kian Admin',
      email: adminEmail,
      password_hash: hashedPassword, // Matches new schema
      role: 'ADMIN',
      is_active: true,
      
      // ===== GRANT ALL PERMISSIONS TO ADMIN =====
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
      
      // Project Files
      can_view_files: true,
      can_upload_files: true,
      can_edit_files: true,
      can_delete_files: true,
      can_download_files: true,
      
      // Client Inquiries
      can_view_inquiries: true,
      can_add_inquiries: true,
      can_update_inquiries: true,
      can_delete_inquiries: true,
      can_assign_inquiries: true,
      
      // System Health
      can_view_health_logs: true,
      can_export_health_logs: true,
      
      // System Administration
      can_manage_permissions: true,
      can_view_audit_trail: true,
      can_backup_database: true
    }
  });

  console.log('✅ Database Reset & Admin Created:', admin.email);
  console.log('✅ Granular Permissions Enabled: All permissions granted to admin');
}

main().catch(console.error).finally(() => prisma.$disconnect());
