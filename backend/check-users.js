const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                full_name: true,
                email: true,
                can_view_all_attendance: true,
                can_view_equipment: true,
                can_view_users: true
            }
        });
        
        console.log('\n[Users Database]:');
        console.log('='.repeat(80));
        
        if (users.length === 0) {
            console.log('[ERROR] No users found in database');
        } else {
            users.forEach((user, index) => {
                console.log(`\nUser ${index + 1}:`);
                console.log(`  ID: ${user.user_id}`);
                console.log(`  Name: ${user.full_name}`);
                console.log(`  Email: ${user.email}`);
                console.log(`  Permissions:`);
                console.log(`    - can_view_all_attendance: ${user.can_view_all_attendance}`);
                console.log(`    - can_view_equipment: ${user.can_view_equipment}`);
                console.log(`    - can_view_users: ${user.can_view_users}`);
            });
        }
        
        console.log('\n' + '='.repeat(80));
        await prisma.$disconnect();
    } catch (error) {
        console.error('[ERROR]:', error.message);
        await prisma.$disconnect();
    }
}

checkUsers();
