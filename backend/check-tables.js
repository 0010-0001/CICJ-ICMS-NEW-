const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
    try {
        console.log('Checking database tables...\n');
        
        // Check users
        const userCount = await prisma.user.count();
        console.log('[SUCCESS] Users table:', userCount, 'records');
        
        // Check attendance logs
        const attendanceCount = await prisma.attendance_Log.count();
        console.log('[Stats] Attendance_Log table:', attendanceCount, 'records');
        
        // Check equipment
        const equipmentCount = await prisma.equipment_Inventory.count();
        console.log('[Equipment] Equipment_Inventory table:', equipmentCount, 'records');
        
        console.log('\n[Note] Empty tables are normal if no data has been added yet.');
        
    } catch (error) {
        console.error('[ERROR]:', error.message);
        if (error.message.includes('does not exist')) {
            console.log('\n[Hint] Run: npx prisma migrate dev');
        }
    } finally {
        await prisma.$disconnect();
    }
}

checkTables();
