const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const KEEP_EMAILS = [
  'kianbasty11@gmail.com',
  'reiyanneghailem@gmail.com'
];

const FIRST_NAMES = [
  'Althea', 'Brandon', 'Cassandra', 'Dwayne', 'Elise', 'Franco', 'Giselle', 'Harvey', 'Iris', 'Joaquin',
  'Katrina', 'Lester', 'Marina', 'Nico', 'Olivia', 'Paolo', 'Quentin', 'Rhea', 'Sebastian', 'Talia',
  'Uriel', 'Vanessa', 'Winston', 'Xavier', 'Yvette', 'Zachary', 'Alden', 'Bea', 'Caleb', 'Diana',
  'Emilio', 'Farah', 'Gavin', 'Hannah', 'Isabel', 'Julian', 'Kyla', 'Logan', 'Mira', 'Noah'
];

const LAST_NAMES = [
  'Alvarez', 'Bautista', 'Castillo', 'Domingo', 'Evangelista', 'Fernandez', 'Garcia', 'Hernandez', 'Ignacio', 'Jimenez',
  'Lopez', 'Morales', 'Navarro', 'Ocampo', 'Pascual', 'Quimbo', 'Rosales', 'Soriano', 'Torres', 'Umali'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomDateWithinDays(daysBack) {
  const now = Date.now();
  const ms = randomInt(0, daysBack * 24 * 60 * 60 * 1000);
  return new Date(now - ms);
}

function makeEmail(firstName, lastName, index) {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
  return `${cleanFirst}.${cleanLast}${index}@cicjmail.com`;
}

function makeUsers(passwordHash) {
  const users = [];
  for (let i = 1; i <= 40; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    users.push({
      full_name: fullName,
      email: makeEmail(firstName, lastName, i),
      password_hash: passwordHash,
      role: 'EMPLOYEE',
      is_active: true,
      can_view_own_attendance: true,
      can_view_equipment: true,
      can_view_files: true,
      can_download_files: true,
      can_add_inquiries: true
    });
  }
  return users;
}

function makeEquipment() {
  const categories = [
    'Hydraulic Breaker',
    'Concrete Vibrator',
    'Scaffold Frame',
    'Portable Generator',
    'Laser Level',
    'Safety Harness',
    'Welding Machine',
    'Core Drill',
    'Pneumatic Hammer',
    'Rebar Cutter'
  ];

  const conditions = ['Good', 'Good', 'Good', 'Needs Maintenance'];
  const statuses = ['Available', 'Available', 'Checked Out', 'Maintenance'];
  const locations = ['Main Yard', 'Tower A', 'Tower B', 'Warehouse', 'Site Office'];

  const rows = [];
  for (let i = 1; i <= 55; i += 1) {
    rows.push({
      name: `${pick(categories)} ${String(i).padStart(2, '0')}`,
      quantity: randomInt(1, 4),
      condition: pick(conditions),
      status: pick(statuses),
      current_location: pick(locations),
      qr_number: `EQ-${String(9000 + i).padStart(5, '0')}`
    });
  }
  return rows;
}

function makeSites() {
  const baseLat = 14.5995;
  const baseLng = 120.9842;
  const names = [
    'North Gateway Build',
    'Riverside Housing Block',
    'Civic Plaza Retrofit',
    'Greenline Depot Works',
    'Harbor Storage Expansion',
    'Central Avenue Mixed-Use',
    'West Ridge Utility Yard',
    'Skybridge Link Segment',
    'Pioneer Drainage Upgrade',
    'Lakeside Retaining Wall',
    'Metro Pump Station',
    'South District Roads'
  ];

  return names.map((name, idx) => ({
    site_name: name,
    site_address: `${100 + idx} Construction Park, Metro City`,
    center_lat: Number((baseLat + idx * 0.0031).toFixed(6)),
    center_lng: Number((baseLng + idx * 0.0024).toFixed(6)),
    geo_fence_radius_meters: randomInt(90, 220),
    is_active: idx % 5 !== 0
  }));
}

function makeAttendanceLogs(userIds, siteRows) {
  const logs = [];
  for (let i = 0; i < 260; i += 1) {
    const userId = pick(userIds);
    const site = pick(siteRows);
    const clockIn = randomDateWithinDays(35);
    const clockOut = new Date(clockIn.getTime() + randomInt(2, 10) * 60 * 60 * 1000);

    logs.push({
      user_id: userId,
      action: 'clock_in',
      timestamp: clockIn,
      location_lat: site.center_lat,
      location_lng: site.center_lng
    });

    if (Math.random() > 0.08) {
      logs.push({
        user_id: userId,
        action: 'clock_out',
        timestamp: clockOut,
        location_lat: site.center_lat,
        location_lng: site.center_lng
      });
    }
  }
  return logs;
}

function makeInquiries(userIds) {
  const statuses = ['Pending', 'In Progress', 'Resolved', 'Closed'];
  const subjects = [
    'Quotation request for structural works',
    'Follow-up on revised milestone timeline',
    'Material specification clarification',
    'Site access and permit confirmation',
    'Procurement lead time concern',
    'Request for design coordination meeting',
    'Safety plan review request',
    'Utility rerouting status update',
    'Progress billing documentation check',
    'Final handover schedule alignment'
  ];

  const clients = [
    'Lumen Properties', 'Harborline Estates', 'Northfield Holdings', 'Vertex Urban Group', 'Summit Crest Dev',
    'Prime Axis Realty', 'Bluegate Ventures', 'Arcstone Build Corp', 'Terranova Partners', 'Elmbridge Assets'
  ];

  const rows = [];
  for (let i = 1; i <= 85; i += 1) {
    const company = pick(clients);
    const status = pick(statuses);
    rows.push({
      client_name: `${company} Contact ${i}`,
      client_email: `contact${i}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      contact_number: `09${randomInt(100000000, 999999999)}`,
      message_body: `We need coordination regarding ${pick(subjects).toLowerCase()} and target mobilization within the next planning cycle.`,
      status,
      handled_by: status === 'Pending' ? null : pick(userIds),
      submitted_at: randomDateWithinDays(50)
    });
  }
  return rows;
}

function makeHealthLogs() {
  const eventTypes = [
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'MFA_LOGIN_SUCCESS', 'PERMISSION_CHANGE', 'FILE_UPLOAD',
    'BACKUP_CREATED', 'SECURITY_BRUTE_FORCE', 'NOTIFICATION_LOW_INVENTORY', 'EQUIPMENT_CHECKOUT', 'EQUIPMENT_RETURN'
  ];

  const descriptions = {
    LOGIN_SUCCESS: 'User session established with valid credentials.',
    LOGIN_FAILED: 'Authentication failed due to invalid password input.',
    MFA_LOGIN_SUCCESS: 'User logged in successfully with MFA verification.',
    PERMISSION_CHANGE: 'Access rights updated for assigned operational roles.',
    FILE_UPLOAD: 'Project artifact uploaded to managed cloud storage.',
    BACKUP_CREATED: 'Automated database backup completed without warnings.',
    SECURITY_BRUTE_FORCE: 'Multiple failed login attempts detected and blocked.',
    NOTIFICATION_LOW_INVENTORY: 'Inventory threshold reached for an active tool group.',
    EQUIPMENT_CHECKOUT: 'Equipment released to assigned field personnel.',
    EQUIPMENT_RETURN: 'Equipment returned and status updated after inspection.'
  };

  const rows = [];
  for (let i = 0; i < 220; i += 1) {
    const eventType = pick(eventTypes);
    rows.push({
      event_type: eventType,
      description: descriptions[eventType],
      ip_address: `192.168.${randomInt(1, 40)}.${randomInt(2, 250)}`,
      timestamp: randomDateWithinDays(40)
    });
  }
  return rows;
}

async function main() {
  const keepUsers = await prisma.user.findMany({
    where: {
      email: {
        in: KEEP_EMAILS
      }
    }
  });

  if (keepUsers.length !== 2) {
    throw new Error('Could not find both Kian and Reiyanne accounts to preserve.');
  }

  const keepUserIds = keepUsers.map((u) => u.user_id);
  const kian = keepUsers.find((u) => u.email.toLowerCase() === 'kianbasty11@gmail.com') || keepUsers[0];
  const preservedPasswordHash = kian.password_hash;

  await prisma.$transaction(async (tx) => {
    // Preserve project files by reassigning ownership first, then keep all file rows.
    await tx.project_File.updateMany({
      where: {
        uploader_id: {
          notIn: keepUserIds
        }
      },
      data: {
        uploader_id: kian.user_id
      }
    });

    await tx.equipment_Checkout.deleteMany();
    await tx.attendance_Log.deleteMany();
    await tx.client_Inquiry.deleteMany();
    await tx.system_Health_Log.deleteMany();
    await tx.construction_Site.deleteMany();
    await tx.equipment_Inventory.deleteMany();

    await tx.user.deleteMany({
      where: {
        user_id: {
          notIn: keepUserIds
        }
      }
    });
  });

  const newUsers = makeUsers(preservedPasswordHash);
  await prisma.user.createMany({ data: newUsers });

  const allUsers = await prisma.user.findMany({
    where: { is_active: true },
    select: { user_id: true, role: true }
  });
  const allUserIds = allUsers.map((u) => u.user_id);

  const sites = makeSites();
  await prisma.construction_Site.createMany({ data: sites });
  const createdSites = await prisma.construction_Site.findMany({
    select: { center_lat: true, center_lng: true }
  });

  const equipmentRows = makeEquipment();
  await prisma.equipment_Inventory.createMany({ data: equipmentRows });

  const attendanceRows = makeAttendanceLogs(allUserIds, createdSites);
  await prisma.attendance_Log.createMany({ data: attendanceRows });

  const inquiryRows = makeInquiries(keepUserIds);
  await prisma.client_Inquiry.createMany({ data: inquiryRows });

  const healthRows = makeHealthLogs();
  await prisma.system_Health_Log.createMany({ data: healthRows });

  const [userCount, equipmentCount, attendanceCount, inquiryCount, healthCount, siteCount, fileCount] = await Promise.all([
    prisma.user.count(),
    prisma.equipment_Inventory.count(),
    prisma.attendance_Log.count(),
    prisma.client_Inquiry.count(),
    prisma.system_Health_Log.count(),
    prisma.construction_Site.count(),
    prisma.project_File.count()
  ]);

  console.log('\nReset + pagination seed complete.');
  console.log('-----------------------------------');
  console.log(`Users: ${userCount} (kept Kian/Reiyanne + fresh accounts)`);
  console.log(`Equipment: ${equipmentCount}`);
  console.log(`Attendance Logs: ${attendanceCount}`);
  console.log(`Client Inquiries: ${inquiryCount}`);
  console.log(`System Health Logs: ${healthCount}`);
  console.log(`Construction Sites: ${siteCount}`);
  console.log(`Project Files (preserved): ${fileCount}`);
  console.log('No seeded values include the word "demo".');
}

main()
  .catch((error) => {
    console.error('Reset/seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
