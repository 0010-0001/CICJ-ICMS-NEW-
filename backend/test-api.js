const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAPIs() {
    try {
        console.log('\n[Test] Testing API Data Retrieval\n');
        console.log('='.repeat(80));
        
        // Test 1: Get user
        console.log('\n[1] Testing User Query...');
        const user = await prisma.user.findUnique({
            where: { email: 'kpaysan.a12345472@umak.edu.ph' }
        });
        console.log(`   [SUCCESS] User found: ${user.full_name}`);
        console.log(`   Token would authenticate as user_id: ${user.user_id}`);
        
        // Test 2: Get attendance data
        console.log('\n[2] Testing Attendance Query...');
        const attendance = await prisma.attendance_Log.findMany({
            include: {
                user: {
                    select: {
                        full_name: true
                    }
                }
            },
            orderBy: {
                timestamp: 'desc'
            }
        });
        console.log(`   Found ${attendance.length} attendance records`);
        if (attendance.length > 0) {
            console.log('   Sample:', attendance[0]);
        } else {
            console.log('   [WARNING] No attendance records in database');
        }
        
        // Test 3: Get equipment data
        console.log('\n[3] Testing Equipment Query...');
        const equipment = await prisma.equipment_Inventory.findMany({
            orderBy: {
                created_at: 'desc'
            }
        });
        console.log(`   Found ${equipment.length} equipment records`);
        if (equipment.length > 0) {
            console.log('   Sample:', equipment[0]);
        } else {
            console.log('   [WARNING] No equipment records in database');
        }
        
        // Test 4: Get users count
        console.log('\n[4] Testing Users Query...');
        const users = await prisma.user.findMany({
            select: {
                user_id: true,
                full_name: true,
                email: true
            }
        });
        console.log(`   Found ${users.length} users`);
        
        console.log('\n' + '='.repeat(80));
        console.log('\n[SUCCESS] All database queries completed successfully');
        console.log('\n[Hint] If frontend shows "Unable to load", the issue is:');
        console.log('   1. Authentication token expired/invalid');
        console.log('   2. CORS issue');
        console.log('   3. Frontend not connecting to http://localhost:5000\n');
        
        await prisma.$disconnect();
    } catch (error) {
        console.error('\n[ERROR]:', error.message);
        console.error('Stack:', error.stack);
        await prisma.$disconnect();
    }
}

testAPIs();

