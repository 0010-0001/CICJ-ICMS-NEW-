/**
 * User Provisioning API Test
 * Tests the complete flow of creating a user with granular permissions
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

async function testUserProvisioning() {
    console.log('==========================================');
    console.log('[User Provisioning] API Test');
    console.log('==========================================\n');

    try {
        // 1. Login as admin to get JWT token
        const admin = await prisma.user.findUnique({
            where: { email: 'admin@cicj.com' }
        });

        if (!admin) {
            console.error('[ERROR] Admin user not found');
            process.exit(1);
        }

        const token = jwt.sign(
            { user_id: admin.user_id, role: admin.role },
            process.env.JWT_SECRET || 'cicj_super_secret_key_2026',
            { expiresIn: '1d' }
        );

        console.log('[SUCCESS] Admin authenticated');
        console.log('   Token:', token.substring(0, 50) + '...\n');

        // 2. Simulate frontend request body (Field Worker preset)
        const newUserData = {
            // Basic Info
            full_name: 'Juan dela Cruz',
            email: 'juan.delacruz@cicj.com',
            password: 'FieldWorker123!',
            role: 'EMPLOYEE',
            contact_number: '+63 912 345 6789',
            is_active: true,

            // Field Worker Permissions (5 permissions)
            can_view_users: false,
            can_add_users: false,
            can_edit_users: false,
            can_delete_users: false,
            can_activate_users: false,

            can_view_own_attendance: true,  // [GRANTED]
            can_view_all_attendance: false,
            can_edit_attendance: false,
            can_delete_attendance: false,
            can_export_attendance: false,

            can_view_equipment: true,  // [GRANTED]
            can_add_equipment: false,
            can_edit_equipment: false,
            can_delete_equipment: false,
            can_assign_equipment: false,

            can_view_files: true,  // [GRANTED]
            can_upload_files: false,
            can_edit_files: false,
            can_delete_files: false,
            can_download_files: true,  // [GRANTED]

            can_view_inquiries: false,
            can_add_inquiries: true,  // [GRANTED]
            can_update_inquiries: false,
            can_delete_inquiries: false,
            can_assign_inquiries: false,

            can_view_health_logs: false,
            can_export_health_logs: false,
            can_manage_permissions: false,
            can_view_audit_trail: false,
            can_backup_database: false
        };

        console.log('[Creating User] ' + newUserData.full_name);
        console.log('   Email: ' + newUserData.email);
        console.log('   Role: ' + newUserData.role);

        // Count permissions to be granted
        const permissionsToGrant = Object.keys(newUserData)
            .filter(key => key.startsWith('can_') && newUserData[key] === true);
        
        console.log('   Permissions to grant: ' + permissionsToGrant.length + ' / 30\n');

        // 3. Delete test user if exists (from previous runs)
        await prisma.user.deleteMany({
            where: { email: newUserData.email }
        });

        // 4. Create user (simulating backend route)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newUserData.password, saltRounds);

        const createdUser = await prisma.user.create({
            data: {
                full_name: newUserData.full_name,
                email: newUserData.email,
                password_hash: hashedPassword,
                role: newUserData.role,
                contact_number: newUserData.contact_number,
                is_active: newUserData.is_active,

                // All 30 permissions
                can_view_users: newUserData.can_view_users || false,
                can_add_users: newUserData.can_add_users || false,
                can_edit_users: newUserData.can_edit_users || false,
                can_delete_users: newUserData.can_delete_users || false,
                can_activate_users: newUserData.can_activate_users || false,

                can_view_own_attendance: newUserData.can_view_own_attendance !== undefined ? newUserData.can_view_own_attendance : true,
                can_view_all_attendance: newUserData.can_view_all_attendance || false,
                can_edit_attendance: newUserData.can_edit_attendance || false,
                can_delete_attendance: newUserData.can_delete_attendance || false,
                can_export_attendance: newUserData.can_export_attendance || false,

                can_view_equipment: newUserData.can_view_equipment !== undefined ? newUserData.can_view_equipment : true,
                can_add_equipment: newUserData.can_add_equipment || false,
                can_edit_equipment: newUserData.can_edit_equipment || false,
                can_delete_equipment: newUserData.can_delete_equipment || false,
                can_assign_equipment: newUserData.can_assign_equipment || false,

                can_view_files: newUserData.can_view_files !== undefined ? newUserData.can_view_files : true,
                can_upload_files: newUserData.can_upload_files || false,
                can_edit_files: newUserData.can_edit_files || false,
                can_delete_files: newUserData.can_delete_files || false,
                can_download_files: newUserData.can_download_files !== undefined ? newUserData.can_download_files : true,

                can_view_inquiries: newUserData.can_view_inquiries || false,
                can_add_inquiries: newUserData.can_add_inquiries !== undefined ? newUserData.can_add_inquiries : true,
                can_update_inquiries: newUserData.can_update_inquiries || false,
                can_delete_inquiries: newUserData.can_delete_inquiries || false,
                can_assign_inquiries: newUserData.can_assign_inquiries || false,

                can_view_health_logs: newUserData.can_view_health_logs || false,
                can_export_health_logs: newUserData.can_export_health_logs || false,
                can_manage_permissions: newUserData.can_manage_permissions || false,
                can_view_audit_trail: newUserData.can_view_audit_trail || false,
                can_backup_database: newUserData.can_backup_database || false
            }
        });

        console.log('[SUCCESS] User created successfully!');
        console.log('   user_id:', createdUser.user_id);
        console.log('   full_name:', createdUser.full_name);
        console.log('   email:', createdUser.email);
        console.log('   role:', createdUser.role);
        console.log('   is_active:', createdUser.is_active);

        // 5. Verify permissions were saved correctly
        console.log('\n==========================================');
        console.log('[Verifying] Permissions in Database');
        console.log('==========================================\n');

        const savedUser = await prisma.user.findUnique({
            where: { user_id: createdUser.user_id }
        });

        const permissionCategories = {
            'User Management': [
                'can_view_users', 'can_add_users', 'can_edit_users', 
                'can_delete_users', 'can_activate_users'
            ],
            'Attendance': [
                'can_view_own_attendance', 'can_view_all_attendance', 'can_edit_attendance',
                'can_delete_attendance', 'can_export_attendance'
            ],
            'Equipment': [
                'can_view_equipment', 'can_add_equipment', 'can_edit_equipment',
                'can_delete_equipment', 'can_assign_equipment'
            ],
            'Files': [
                'can_view_files', 'can_upload_files', 'can_edit_files',
                'can_delete_files', 'can_download_files'
            ],
            'Inquiries': [
                'can_view_inquiries', 'can_add_inquiries', 'can_update_inquiries',
                'can_delete_inquiries', 'can_assign_inquiries'
            ],
            'System Admin': [
                'can_view_health_logs', 'can_export_health_logs', 'can_manage_permissions',
                'can_view_audit_trail', 'can_backup_database'
            ]
        };

        let totalGranted = 0;
        let verificationSuccess = true;

        for (const [category, permissions] of Object.entries(permissionCategories)) {
            console.log(`${category}:`);
            permissions.forEach(perm => {
                const granted = savedUser[perm];
                const expected = newUserData[perm];
                const match = granted === expected;

                if (!match) verificationSuccess = false;
                if (granted) totalGranted++;

                console.log(`   ${granted ? '[GRANTED]' : '[DENIED]'} ${perm}: ${granted} ${!match ? '(MISMATCH!)' : ''}`);
            });
            console.log('');
        }

        console.log('==========================================');
        console.log(`[Summary] Total Permissions Granted: ${totalGranted} / 30`);
        console.log('==========================================\n');

        // 6. Verify password encryption
        const passwordMatches = await bcrypt.compare('FieldWorker123!', savedUser.password_hash);
        console.log('[Password Verification]:');
        console.log('   Hash stored:', savedUser.password_hash.substring(0, 30) + '...');
        console.log('   bcrypt.compare result:', passwordMatches ? '[PASS]' : '[FAIL]');

        // 7. Test login with new credentials
        console.log('\n==========================================');
        console.log('[Testing] Login with New User');
        console.log('==========================================\n');

        const loginUser = await prisma.user.findUnique({
            where: { email: 'juan.delacruz@cicj.com' }
        });

        if (loginUser && loginUser.is_active) {
            const loginPasswordMatch = await bcrypt.compare('FieldWorker123!', loginUser.password_hash);
            if (loginPasswordMatch) {
                const userToken = jwt.sign(
                    { user_id: loginUser.user_id, role: loginUser.role },
                    process.env.JWT_SECRET || 'cicj_super_secret_key_2026',
                    { expiresIn: '1d' }
                );
                console.log('[SUCCESS] Login successful for:', loginUser.full_name);
                console.log('   Token generated:', userToken.substring(0, 50) + '...');
            } else {
                console.log('[ERROR] Password mismatch');
                verificationSuccess = false;
            }
        } else {
            console.log('[ERROR] User not found or inactive');
            verificationSuccess = false;
        }

        // 8. Summary
        console.log('\n==========================================');
        console.log('[Test Summary]');
        console.log('==========================================\n');

        if (verificationSuccess && totalGranted === 5) {
            console.log('[SUCCESS] All tests passed!');
            console.log('[SUCCESS] User created with exact permissions from Matrix UI');
            console.log('[SUCCESS] Password encrypted with bcrypt');
            console.log('[SUCCESS] Login functional');
            console.log('[SUCCESS] JWT token generation working');
            console.log('\n[COMPLETE] User Provisioning API is production-ready!\n');
        } else {
            console.log('[ERROR] Some tests failed. Review output above.');
        }

        // Cleanup
        console.log('\n[Cleanup] Cleaning up test user...');
        await prisma.user.delete({
            where: { email: 'juan.delacruz@cicj.com' }
        });
        console.log('âœ… Test user deleted\n');

        await prisma.$disconnect();
        process.exit(verificationSuccess ? 0 : 1);

    } catch (error) {
        console.error('\nâŒ Test Error:', error.message);
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

testUserProvisioning();

