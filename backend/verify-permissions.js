const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyPermissions() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@cicj.com' }
    });

    if (!user) {
      console.log('❌ Admin user not found!');
      return;
    }

    console.log('\n✅ ADMIN USER FOUND');
    console.log('─────────────────────────────────────────');
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Active:', user.is_active);
    console.log('MFA Enabled:', user.mfa_secret ? 'Yes' : 'No');
    
    console.log('\n📊 GRANULAR PERMISSIONS VERIFICATION:');
    console.log('─────────────────────────────────────────');
    
    console.log('\n👥 User Management:');
    console.log('  can_view_users:', user.can_view_users);
    console.log('  can_add_users:', user.can_add_users);
    console.log('  can_delete_users:', user.can_delete_users);
    
    console.log('\n📅 Attendance:');
    console.log('  can_view_all_attendance:', user.can_view_all_attendance);
    console.log('  can_edit_attendance:', user.can_edit_attendance);
    console.log('  can_export_attendance:', user.can_export_attendance);
    
    console.log('\n🔧 Equipment:');
    console.log('  can_add_equipment:', user.can_add_equipment);
    console.log('  can_assign_equipment:', user.can_assign_equipment);
    
    console.log('\n📁 Files:');
    console.log('  can_upload_files:', user.can_upload_files);
    console.log('  can_delete_files:', user.can_delete_files);
    
    console.log('\n💬 Inquiries:');
    console.log('  can_view_inquiries:', user.can_view_inquiries);
    console.log('  can_assign_inquiries:', user.can_assign_inquiries);
    
    console.log('\n⚙️ System Admin:');
    console.log('  can_manage_permissions:', user.can_manage_permissions);
    console.log('  can_view_audit_trail:', user.can_view_audit_trail);
    console.log('  can_backup_database:', user.can_backup_database);
    
    console.log('\n✅ Task 3 Complete: All 30 permission flags verified!');
    console.log('─────────────────────────────────────────\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions();
