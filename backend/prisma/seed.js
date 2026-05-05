const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_USER_DOMAIN = '@demo.cicj.local';

function daysAgo(days, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildAdminPermissions() {
  return {
    can_view_users: true,
    can_add_users: true,
    can_edit_users: true,
    can_delete_users: true,
    can_activate_users: true,
    can_view_own_attendance: true,
    can_view_all_attendance: true,
    can_edit_attendance: true,
    can_delete_attendance: true,
    can_export_attendance: true,
    can_view_equipment: true,
    can_add_equipment: true,
    can_edit_equipment: true,
    can_delete_equipment: true,
    can_assign_equipment: true,
    can_view_files: true,
    can_upload_files: true,
    can_edit_files: true,
    can_delete_files: true,
    can_download_files: true,
    can_view_inquiries: true,
    can_add_inquiries: true,
    can_update_inquiries: true,
    can_delete_inquiries: true,
    can_assign_inquiries: true,
    can_view_health_logs: true,
    can_export_health_logs: true,
    can_acknowledge_security_alerts: true,
    can_manage_permissions: true,
    can_view_audit_trail: true,
    can_backup_database: true,
    can_view_reports: true,
    can_export_attendance_report: true,
    can_export_equipment_report: true,
    can_export_inquiry_report: true,
    can_export_files_report: true
  };
}

async function upsertSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  const fullName = process.env.SEED_ADMIN_NAME || 'System Admin';
  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = buildAdminPermissions();

  return prisma.user.upsert({
    where: { email },
    update: {
      full_name: fullName,
      role: 'ADMIN',
      is_active: true,
      password_hash: passwordHash,
      ...permissions
    },
    create: {
      full_name: fullName,
      email,
      role: 'ADMIN',
      is_active: true,
      password_hash: passwordHash,
      ...permissions
    }
  });
}

async function upsertDemoUsers(passwordHash) {
  const users = [
    {
      full_name: 'Ariana Dela Cruz',
      email: `ariana${DEMO_USER_DOMAIN}`,
      role: 'ADMIN',
      contact_number: '09171230001'
    },
    {
      full_name: 'Miguel Santos',
      email: `miguel${DEMO_USER_DOMAIN}`,
      role: 'EMPLOYEE',
      contact_number: '09171230002'
    },
    {
      full_name: 'Jessa Ramirez',
      email: `jessa${DEMO_USER_DOMAIN}`,
      role: 'EMPLOYEE',
      contact_number: '09171230003'
    },
    {
      full_name: 'Carlo Mendoza',
      email: `carlo${DEMO_USER_DOMAIN}`,
      role: 'EMPLOYEE',
      contact_number: '09171230004'
    },
    {
      full_name: 'Lara Villanueva',
      email: `lara${DEMO_USER_DOMAIN}`,
      role: 'EMPLOYEE',
      contact_number: '09171230005'
    },
    {
      full_name: 'Noel Bautista',
      email: `noel${DEMO_USER_DOMAIN}`,
      role: 'EMPLOYEE',
      contact_number: '09171230006'
    }
  ];

  const created = [];
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        full_name: u.full_name,
        role: u.role,
        contact_number: u.contact_number,
        is_active: true,
        password_hash: passwordHash,
        can_view_own_attendance: true,
        can_view_equipment: true,
        can_view_files: true,
        can_download_files: true,
        can_add_inquiries: true,
        can_view_inquiries: u.role === 'ADMIN',
        can_update_inquiries: u.role === 'ADMIN',
        can_assign_inquiries: u.role === 'ADMIN',
        can_view_all_attendance: u.role === 'ADMIN',
        can_export_attendance: u.role === 'ADMIN',
        can_add_equipment: u.role === 'ADMIN',
        can_edit_equipment: u.role === 'ADMIN',
        can_assign_equipment: u.role === 'ADMIN',
        can_view_health_logs: u.role === 'ADMIN',
        can_acknowledge_security_alerts: u.role === 'ADMIN',
        can_manage_permissions: u.role === 'ADMIN',
        can_view_audit_trail: u.role === 'ADMIN',
        can_backup_database: u.role === 'ADMIN'
      },
      create: {
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        contact_number: u.contact_number,
        is_active: true,
        password_hash: passwordHash,
        can_view_own_attendance: true,
        can_view_equipment: true,
        can_view_files: true,
        can_download_files: true,
        can_add_inquiries: true,
        can_view_inquiries: u.role === 'ADMIN',
        can_update_inquiries: u.role === 'ADMIN',
        can_assign_inquiries: u.role === 'ADMIN',
        can_view_all_attendance: u.role === 'ADMIN',
        can_export_attendance: u.role === 'ADMIN',
        can_add_equipment: u.role === 'ADMIN',
        can_edit_equipment: u.role === 'ADMIN',
        can_assign_equipment: u.role === 'ADMIN',
        can_view_health_logs: u.role === 'ADMIN',
        can_acknowledge_security_alerts: u.role === 'ADMIN',
        can_manage_permissions: u.role === 'ADMIN',
        can_view_audit_trail: u.role === 'ADMIN',
        can_backup_database: u.role === 'ADMIN'
      }
    });
    created.push(row);
  }

  return created;
}

async function seedEquipmentAndCheckouts(users) {
  const inventory = [
    { name: 'Excavator CAT 320', quantity: 4, condition: 'Good', status: 'Checked Out', current_location: 'Site A', qr_number: 'DEMO-EQ-0001' },
    { name: 'Diesel Generator 45kVA', quantity: 3, condition: 'Good', status: 'Available', current_location: 'Warehouse', qr_number: 'DEMO-EQ-0002' },
    { name: 'Concrete Mixer', quantity: 2, condition: 'Fair', status: 'Maintenance', current_location: 'Maintenance Bay', qr_number: 'DEMO-EQ-0003' },
    { name: 'Tower Crane Hook Assembly', quantity: 1, condition: 'Poor', status: 'Out of Order', current_location: 'Site B', qr_number: 'DEMO-EQ-0004' },
    { name: 'Hydraulic Loader', quantity: 3, condition: 'Good', status: 'Checked Out', current_location: 'Site C', qr_number: 'DEMO-EQ-0005' },
    { name: 'Portable Welder', quantity: 5, condition: 'Good', status: 'Available', current_location: 'Warehouse', qr_number: 'DEMO-EQ-0006' },
    { name: 'Safety Harness Set', quantity: 20, condition: 'Good', status: 'Checked Out', current_location: 'Site A', qr_number: 'DEMO-EQ-0007' },
    { name: 'Concrete Vibrator', quantity: 6, condition: 'Good', status: 'Maintenance', current_location: 'Maintenance Bay', qr_number: 'DEMO-EQ-0008' }
  ];

  const equipmentRows = [];
  for (const item of inventory) {
    const row = await prisma.equipment_Inventory.upsert({
      where: { qr_number: item.qr_number },
      update: {
        name: item.name,
        quantity: item.quantity,
        condition: item.condition,
        status: item.status,
        current_location: item.current_location
      },
      create: {
        name: item.name,
        quantity: item.quantity,
        condition: item.condition,
        status: item.status,
        current_location: item.current_location,
        qr_number: item.qr_number
      }
    });
    equipmentRows.push(row);
  }

  await prisma.equipment_Checkout.deleteMany({
    where: {
      notes: {
        contains: '[DEMO]'
      }
    }
  });

  const workerUsers = users.filter(u => u.role === 'EMPLOYEE');
  const checkedOutRows = equipmentRows.filter(e => e.status === 'Checked Out');
  for (let i = 0; i < checkedOutRows.length; i += 1) {
    await prisma.equipment_Checkout.create({
      data: {
        equipment_id: checkedOutRows[i].equipment_id,
        user_id: workerUsers[i % workerUsers.length].user_id,
        checkout_date: daysAgo(i, 9 + i, 10),
        status: 'Checked Out',
        notes: '[DEMO] Auto-seeded checkout record'
      }
    });
  }

  return equipmentRows;
}

async function seedAttendance(users) {
  const userIds = users.map(u => u.user_id);

  await prisma.attendance_Log.deleteMany({
    where: {
      user_id: { in: userIds },
      timestamp: { gte: daysAgo(14, 0, 0) }
    }
  });

  const employees = users.filter(u => u.role === 'EMPLOYEE');

  const presentByWeekday = {
    1: 5, // Monday
    2: 4, // Tuesday
    3: 5, // Wednesday
    4: 4, // Thursday
    5: 5, // Friday
    6: 2, // Saturday
    0: 1  // Sunday
  };

  for (let d = 0; d < 14; d += 1) {
    const baseDate = daysAgo(d, 8, 0);
    const weekday = baseDate.getDay();
    const presentCount = Math.min(presentByWeekday[weekday] || 3, employees.length);

    for (let i = 0; i < presentCount; i += 1) {
      const clockIn = daysAgo(d, 7 + (i % 3), 8 + (i * 3));
      const clockOut = new Date(clockIn);
      clockOut.setHours(clockIn.getHours() + 8 + (i % 2));

      await prisma.attendance_Log.create({
        data: {
          user_id: employees[i].user_id,
          action: 'clock_in',
          timestamp: clockIn,
          location_lat: 14.5995,
          location_lng: 120.9842
        }
      });

      // Keep some current-day records open to mimic real-time active workers.
      const isToday = d === 0;
      const leaveOpen = isToday && i >= Math.max(1, presentCount - 2);
      if (!leaveOpen) {
        await prisma.attendance_Log.create({
          data: {
            user_id: employees[i].user_id,
            action: 'clock_out',
            timestamp: clockOut,
            location_lat: 14.5995,
            location_lng: 120.9842
          }
        });
      }
    }
  }
}

async function seedInquiries(users) {
  const adminUser = users.find(u => u.role === 'ADMIN') || null;

  await prisma.client_Inquiry.deleteMany({
    where: {
      client_email: {
        endsWith: '@demo.client'
      }
    }
  });

  const inquiries = [
    {
      client_name: 'RMC Builders',
      client_email: 'procurement@demo.client',
      contact_number: '09180010001',
      message_body: '[DEMO] Requesting quotation for 30 safety helmets and 20 harness sets.',
      status: 'Pending'
    },
    {
      client_name: 'North Axis Construction',
      client_email: 'ops@demo.client',
      contact_number: '09180010002',
      message_body: '[DEMO] Can you provide equipment availability for tower crane parts this week?',
      status: 'In Progress'
    },
    {
      client_name: 'Metro Drainage JV',
      client_email: 'admin@demo.client',
      contact_number: '09180010003',
      message_body: '[DEMO] Follow-up on submitted project files and turnaround timeline.',
      status: 'Resolved'
    },
    {
      client_name: 'Summit Foundations Inc.',
      client_email: 'site.lead@demo.client',
      contact_number: '09180010004',
      message_body: '[DEMO] Need urgent support for maintenance crew dispatch tomorrow morning.',
      status: 'Pending'
    }
  ];

  for (const item of inquiries) {
    await prisma.client_Inquiry.create({
      data: {
        client_name: item.client_name,
        client_email: item.client_email,
        contact_number: item.contact_number,
        message_body: item.message_body,
        status: item.status,
        handled_by: adminUser?.user_id || null,
        submitted_at: daysAgo(Math.floor(Math.random() * 6), 10 + Math.floor(Math.random() * 6), 15)
      }
    });
  }
}

async function seedSystemHealth() {
  await prisma.system_Health_Log.deleteMany({
    where: {
      description: {
        contains: '[DEMO]'
      }
    }
  });

  const logs = [
    { event_type: 'AUTH', description: '[DEMO] Successful admin login from office workstation', ip_address: '192.168.1.10' },
    { event_type: 'BACKUP', description: '[DEMO] Scheduled database backup completed', ip_address: '192.168.1.20' },
    { event_type: 'EQUIPMENT', description: '[DEMO] Bulk equipment status update processed', ip_address: '192.168.1.30' },
    { event_type: 'INQUIRY', description: '[DEMO] Inquiry assignment workflow triggered', ip_address: '192.168.1.40' },
    { event_type: 'ATTENDANCE', description: '[DEMO] Attendance sync completed without errors', ip_address: '192.168.1.50' }
  ];

  for (let i = 0; i < logs.length; i += 1) {
    await prisma.system_Health_Log.create({
      data: {
        event_type: logs[i].event_type,
        description: logs[i].description,
        ip_address: logs[i].ip_address,
        timestamp: daysAgo(i, 11 + i, 20)
      }
    });
  }
}

async function seedSites() {
  const sites = [
    { site_name: 'CICJ Site A - Quezon Ave', site_address: 'Quezon City', center_lat: 14.6488, center_lng: 121.0509, geo_fence_radius_meters: 120 },
    { site_name: 'CICJ Site B - Mandaluyong', site_address: 'Mandaluyong', center_lat: 14.5794, center_lng: 121.0359, geo_fence_radius_meters: 100 },
    { site_name: 'CICJ Site C - Pasig', site_address: 'Pasig', center_lat: 14.5764, center_lng: 121.0851, geo_fence_radius_meters: 110 }
  ];

  for (const site of sites) {
    const existing = await prisma.construction_Site.findFirst({
      where: { site_name: site.site_name }
    });

    if (!existing) {
      await prisma.construction_Site.create({
        data: site
      });
    }
  }
}

async function main() {
  console.log('[Seed] Starting demo data seeding (excluding Project_File table)...');

  const seedAdmin = await upsertSeedAdmin();
  if (seedAdmin) {
    console.log(`[Seed] Admin upserted: ${seedAdmin.email}`);
  }

  const passwordHash = await bcrypt.hash('DemoPass123!', 10);
  const users = await upsertDemoUsers(passwordHash);
  await seedEquipmentAndCheckouts(users);
  await seedAttendance(users);
  await seedInquiries(users);
  await seedSystemHealth();
  await seedSites();

  console.log(`[Seed] Completed. Demo users upserted: ${users.length}`);
  console.log('[Seed] Tables written: User, Attendance_Log, Equipment_Inventory, Equipment_Checkout, Client_Inquiry, System_Health_Log, Construction_Site');
  console.log('[Seed] Table skipped: Project_File');
}

main()
  .catch((error) => {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
