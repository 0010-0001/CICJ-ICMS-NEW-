const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
    try {
        const admin = await prisma.user.findUnique({
            where: { email: 'admin@cicj.com' }
        });
        
        if (!admin) {
            console.log('[ERROR] Admin user not found!');
            return;
        }
        
        console.log('[SUCCESS] Admin user found:', admin.full_name);
        console.log('\nPermissions:');
        console.log('  can_view_all_attendance:', admin.can_view_all_attendance);
        console.log('  can_view_equipment:', admin.can_view_equipment);
        console.log('  can_view_users:', admin.can_view_users);
        console.log('\n[Email]:', admin.email);
        console.log('[Password Hash] exists:', admin.password_hash ? 'Yes' : 'No');
        console.log('[Is Active]:', admin.is_active);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdmin();
