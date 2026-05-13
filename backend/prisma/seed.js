const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');

const prisma = new PrismaClient();

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

function buildEmployeePermissions() {
  return {
    can_view_own_attendance: true,
    can_view_equipment: true,
    can_view_files: true,
    can_download_files: true,
    can_add_inquiries: true
  };
}

async function generateQR(text) {
  return QRCode.toDataURL(text, { width: 200, margin: 1 });
}

async function upsertSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return null;

  const fullName = process.env.SEED_ADMIN_NAME || 'System Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: { email },
    update: { full_name: fullName, role: 'ADMIN', is_active: true, password_hash: passwordHash, ...buildAdminPermissions() },
    create: { full_name: fullName, email, role: 'ADMIN', is_active: true, password_hash: passwordHash, ...buildAdminPermissions() }
  });
}

async function upsertSeedUsers(passwordHash) {
  const defs = [
    { full_name: 'Ariana Dela Cruz',   email: 'a.delacruz@email.com',   role: 'ADMIN',    contact_number: '09171230001' },
    { full_name: 'Ramon Torres',        email: 'r.torres@email.com',      role: 'ADMIN',    contact_number: '09171230002' },
    { full_name: 'Patricia Lim',        email: 'p.lim@email.com',         role: 'ADMIN',    contact_number: '09171230003' },
    { full_name: 'Eduardo Navarro',     email: 'e.navarro@email.com',     role: 'ADMIN',    contact_number: '09171230004' },
    { full_name: 'Miguel Santos',       email: 'm.santos@email.com',      role: 'EMPLOYEE', contact_number: '09171230005' },
    { full_name: 'Jessa Ramirez',       email: 'j.ramirez@email.com',     role: 'EMPLOYEE', contact_number: '09171230006' },
    { full_name: 'Carlo Mendoza',       email: 'c.mendoza@email.com',     role: 'EMPLOYEE', contact_number: '09171230007' },
    { full_name: 'Lara Villanueva',     email: 'l.villanueva@email.com',  role: 'EMPLOYEE', contact_number: '09171230008' },
    { full_name: 'Noel Bautista',       email: 'n.bautista@email.com',    role: 'EMPLOYEE', contact_number: '09171230009' },
    { full_name: 'Diana Cruz',          email: 'd.cruz@email.com',        role: 'EMPLOYEE', contact_number: '09171230010' },
    { full_name: 'Fernando Reyes',      email: 'f.reyes@email.com',       role: 'EMPLOYEE', contact_number: '09171230011' },
    { full_name: 'Gloria Aquino',       email: 'g.aquino@email.com',      role: 'EMPLOYEE', contact_number: '09171230012' },
    { full_name: 'Hernando Ocampo',     email: 'h.ocampo@email.com',      role: 'EMPLOYEE', contact_number: '09171230013' },
    { full_name: 'Isabel Garcia',       email: 'i.garcia@email.com',      role: 'EMPLOYEE', contact_number: '09171230014' },
    { full_name: 'Jose Castillo',       email: 'j.castillo@email.com',    role: 'EMPLOYEE', contact_number: '09171230015' },
    { full_name: 'Karen Flores',        email: 'k.flores@email.com',      role: 'EMPLOYEE', contact_number: '09171230016' },
    { full_name: 'Luis Morales',        email: 'l.morales@email.com',     role: 'EMPLOYEE', contact_number: '09171230017' },
    { full_name: 'Maria Ramos',         email: 'm.ramos@email.com',       role: 'EMPLOYEE', contact_number: '09171230018' },
    { full_name: 'Pedro Salazar',       email: 'p.salazar@email.com',     role: 'EMPLOYEE', contact_number: '09171230019' },
    { full_name: 'Rosa Espinosa',       email: 'r.espinosa@email.com',    role: 'EMPLOYEE', contact_number: '09171230020' }
  ];

  const created = [];
  for (const u of defs) {
    const perms = u.role === 'ADMIN' ? buildAdminPermissions() : buildEmployeePermissions();
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { full_name: u.full_name, role: u.role, contact_number: u.contact_number, is_active: true, password_hash: passwordHash, ...perms },
      create: { full_name: u.full_name, email: u.email, role: u.role, contact_number: u.contact_number, is_active: true, password_hash: passwordHash, ...perms }
    });
    created.push(row);
  }
  return created;
}

async function seedEquipmentAndCheckouts(users) {
  const inventory = [
    { name: 'Excavator CAT 320GC',            qty: 2, cond: 'Good',  status: 'Checked Out', loc: 'Site A - Quezon Ave',      qr: 'EQ-00001' },
    { name: 'Excavator Komatsu PC210',         qty: 1, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00002' },
    { name: 'Bulldozer CAT D6',                qty: 1, cond: 'Good',  status: 'Available',   loc: 'Site B - Mandaluyong',     qr: 'EQ-00003' },
    { name: 'Tower Crane Liebherr 130EC',      qty: 1, cond: 'Good',  status: 'Checked Out', loc: 'Site C - Pasig',           qr: 'EQ-00004' },
    { name: 'Mobile Crane 50T',                qty: 1, cond: 'Fair',  status: 'Maintenance', loc: 'Maintenance Bay',          qr: 'EQ-00005' },
    { name: 'Hydraulic Excavator 20T',         qty: 2, cond: 'Good',  status: 'Checked Out', loc: 'Site D - Makati',          qr: 'EQ-00006' },
    { name: 'Motor Grader CAT 140',            qty: 1, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00007' },
    { name: 'Vibrating Roller 10T',            qty: 2, cond: 'Good',  status: 'Available',   loc: 'Site A - Quezon Ave',      qr: 'EQ-00008' },
    { name: 'Backhoe Loader JCB 3CX',         qty: 3, cond: 'Good',  status: 'Checked Out', loc: 'Site E - Taguig',          qr: 'EQ-00009' },
    { name: 'Skid Steer Loader',               qty: 1, cond: 'Poor',  status: 'Out of Order',loc: 'Maintenance Bay',          qr: 'EQ-00010' },
    { name: 'Hydraulic Loader 3T',             qty: 2, cond: 'Good',  status: 'Checked Out', loc: 'Site B - Mandaluyong',     qr: 'EQ-00011' },
    { name: 'Pallet Jack 2T',                  qty: 4, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00012' },
    { name: 'Electric Chain Hoist 1T',         qty: 3, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00013' },
    { name: 'Telescopic Handler 3.5T',         qty: 1, cond: 'Fair',  status: 'Maintenance', loc: 'Maintenance Bay',          qr: 'EQ-00014' },
    { name: 'Material Hoist 500kg',            qty: 2, cond: 'Good',  status: 'Available',   loc: 'Site C - Pasig',           qr: 'EQ-00015' },
    { name: 'Forklift 3.5T',                   qty: 2, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00016' },
    { name: 'Concrete Mixer 350L',             qty: 4, cond: 'Fair',  status: 'Maintenance', loc: 'Maintenance Bay',          qr: 'EQ-00017' },
    { name: 'Concrete Pump 40m',               qty: 1, cond: 'Good',  status: 'Checked Out', loc: 'Site A - Quezon Ave',      qr: 'EQ-00018' },
    { name: 'Concrete Vibrator 50mm',          qty: 6, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00019' },
    { name: 'Concrete Vibrator 75mm',          qty: 4, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00020' },
    { name: 'Transit Mixer 6m3',               qty: 2, cond: 'Good',  status: 'Checked Out', loc: 'Site D - Makati',          qr: 'EQ-00021' },
    { name: 'Portable Concrete Batching Plant',qty: 1, cond: 'Good',  status: 'Available',   loc: 'Site F - Caloocan',        qr: 'EQ-00022' },
    { name: 'Portable Arc Welder 250A',        qty: 8, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00023' },
    { name: 'Angle Grinder 9-inch',            qty: 10,cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00024' },
    { name: 'Rotary Hammer Drill 32mm',        qty: 8, cond: 'Good',  status: 'Checked Out', loc: 'Site E - Taguig',          qr: 'EQ-00025' },
    { name: 'Circular Saw 7.25-inch',          qty: 6, cond: 'Good',  status: 'Checked Out', loc: 'Site B - Mandaluyong',     qr: 'EQ-00026' },
    { name: 'Plasma Cutter 60A',               qty: 2, cond: 'Fair',  status: 'Maintenance', loc: 'Maintenance Bay',          qr: 'EQ-00027' },
    { name: 'MIG Welder 350A',                 qty: 3, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00028' },
    { name: 'Safety Harness Set (20 pcs)',     qty: 20,cond: 'Good',  status: 'Checked Out', loc: 'Site A - Quezon Ave',      qr: 'EQ-00029' },
    { name: 'Hard Hat Set (50 pcs)',           qty: 50,cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00030' },
    { name: 'Safety Boot Set (30 pairs)',      qty: 30,cond: 'Good',  status: 'Checked Out', loc: 'Site C - Pasig',           qr: 'EQ-00031' },
    { name: 'Hi-Vis Vest Set (40 pcs)',        qty: 40,cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00032' },
    { name: 'Respirator Set (20 pcs)',         qty: 20,cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00033' },
    { name: 'Safety Goggles Set (30 pcs)',     qty: 30,cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00034' },
    { name: 'Diesel Generator 45kVA',          qty: 3, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00035' },
    { name: 'Diesel Generator 100kVA',         qty: 2, cond: 'Good',  status: 'Available',   loc: 'Site D - Makati',          qr: 'EQ-00036' },
    { name: 'Air Compressor 185 CFM',          qty: 2, cond: 'Good',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00037' },
    { name: 'Air Compressor 375 CFM',          qty: 1, cond: 'Fair',  status: 'Maintenance', loc: 'Maintenance Bay',          qr: 'EQ-00038' },
    { name: 'Scaffolding Set (100 frames)',    qty: 1, cond: 'Good',  status: 'Available',   loc: 'Site B - Mandaluyong',     qr: 'EQ-00039' },
    { name: 'Steel Formwork Set',              qty: 1, cond: 'Good',  status: 'Checked Out', loc: 'Site F - Caloocan',        qr: 'EQ-00040' },
    { name: 'Aluminum Scaffolding (50 frames)',qty: 1, cond: 'Good',  status: 'Available',   loc: 'Site E - Taguig',          qr: 'EQ-00041' },
    { name: 'Slab Formwork Panels',            qty: 1, cond: 'Fair',  status: 'Available',   loc: 'Main Warehouse',           qr: 'EQ-00042' }
  ];

  const equipmentRows = [];
  for (const item of inventory) {
    const qrImage = await generateQR(item.qr);
    const row = await prisma.equipment_Inventory.upsert({
      where: { qr_number: item.qr },
      update: { name: item.name, quantity: item.qty, condition: item.cond, status: item.status, current_location: item.loc, qr_code: qrImage },
      create: { name: item.name, quantity: item.qty, condition: item.cond, status: item.status, current_location: item.loc, qr_number: item.qr, qr_code: qrImage }
    });
    equipmentRows.push(row);
  }

  await prisma.equipment_Checkout.deleteMany({ where: { notes: { contains: '[SEEDED]' } } });

  const employees = users.filter(u => u.role === 'EMPLOYEE');
  const checkedOut = equipmentRows.filter(e => e.status === 'Checked Out');
  for (let i = 0; i < checkedOut.length; i += 1) {
    await prisma.equipment_Checkout.create({
      data: {
        equipment_id: checkedOut[i].equipment_id,
        user_id: employees[i % employees.length].user_id,
        checkout_date: daysAgo(i + 1, 8, 30),
        status: 'Checked Out',
        notes: '[SEEDED] Auto-created checkout record'
      }
    });
  }

  return equipmentRows;
}

async function seedAttendance(users) {
  const userIds = users.map(u => u.user_id);
  await prisma.attendance_Log.deleteMany({
    where: { user_id: { in: userIds }, timestamp: { gte: daysAgo(30, 0, 0) } }
  });

  const employees = users.filter(u => u.role === 'EMPLOYEE');
  const sites = [
    { lat: 14.6488, lng: 121.0509 },
    { lat: 14.5794, lng: 121.0359 },
    { lat: 14.5764, lng: 121.0851 },
    { lat: 14.5547, lng: 121.0244 },
    { lat: 14.5243, lng: 121.0530 }
  ];

  for (let d = 0; d < 30; d += 1) {
    const baseDate = daysAgo(d, 8, 0);
    const weekday = baseDate.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const presentCount = isWeekend
      ? Math.floor(employees.length * 0.3)
      : Math.floor(employees.length * 0.85);

    for (let i = 0; i < presentCount; i += 1) {
      const emp = employees[i];
      const site = sites[i % sites.length];
      const clockIn = daysAgo(d, 7 + (i % 2), 5 + (i * 4) % 50);
      const clockOut = new Date(clockIn);
      clockOut.setHours(clockIn.getHours() + 8 + (i % 2), (i * 7) % 59);

      await prisma.attendance_Log.create({
        data: { user_id: emp.user_id, action: 'clock_in', timestamp: clockIn, location_lat: site.lat, location_lng: site.lng }
      });

      const isToday = d === 0;
      const leaveOpen = isToday && i >= presentCount - 3;
      if (!leaveOpen) {
        await prisma.attendance_Log.create({
          data: { user_id: emp.user_id, action: 'clock_out', timestamp: clockOut, location_lat: site.lat, location_lng: site.lng }
        });
      }
    }
  }
}

async function seedInquiries(users) {
  const admins = users.filter(u => u.role === 'ADMIN');
  await prisma.client_Inquiry.deleteMany({ where: { client_email: { endsWith: '@seed.email.com' } } });

  const inquiries = [
    { name: 'RMC Builders Corp.',         email: 'procurement@seed.email.com',  contact: '09180010001', subject: 'Quotation for Safety Equipment',         body: 'Requesting quotation for 30 safety helmets and 20 harness sets for our Q3 project rollout.', status: 'Pending',     daysBack: 1 },
    { name: 'North Axis Construction',    email: 'ops@seed.email.com',           contact: '09180010002', subject: 'Tower Crane Parts Availability',          body: 'Can you confirm availability of tower crane hook assemblies for the Mandaluyong project this week?', status: 'In Progress', daysBack: 2 },
    { name: 'Metro Drainage JV',          email: 'admin@seed.email.com',         contact: '09180010003', subject: 'Project Files Turnaround',                body: 'Following up on submitted project files and expected approval timeline.', status: 'Resolved',    daysBack: 3 },
    { name: 'Summit Foundations Inc.',    email: 'site.lead@seed.email.com',     contact: '09180010004', subject: 'Urgent Maintenance Crew Dispatch',        body: 'Need urgent support for a maintenance crew to be dispatched by 6 AM tomorrow at Site B.', status: 'Pending',     daysBack: 1 },
    { name: 'Greenway Structures',        email: 'engineer@seed.email.com',      contact: '09180010005', subject: 'Equipment Rental Rates Inquiry',          body: 'Inquiring about rental rates for excavators and concrete mixers for a 3-month project in Pasig.', status: 'In Progress', daysBack: 4 },
    { name: 'Apex Contracting Group',     email: 'contracts@seed.email.com',     contact: '09180010006', subject: 'Subcontractor Agreement Review',          body: 'Please send updated subcontractor agreement templates for our legal team to review.', status: 'Pending',     daysBack: 2 },
    { name: 'Horizon Developers',         email: 'hd.inquiry@seed.email.com',    contact: '09180010007', subject: 'Site Survey Request',                    body: 'We need a site survey team at our Caloocan property before breaking ground next month.', status: 'Resolved',    daysBack: 7 },
    { name: 'Pacific Build Corp.',        email: 'pacific@seed.email.com',       contact: '09180010008', subject: 'Bulk Scaffolding Order',                  body: 'Requesting availability and pricing for 200 scaffolding frames for a high-rise project.', status: 'In Progress', daysBack: 5 },
    { name: 'Landmark Realty',            email: 'landmark@seed.email.com',      contact: '09180010009', subject: 'Construction Progress Report',            body: 'Requesting an updated progress report for the Taguig residential complex project.', status: 'Pending',     daysBack: 3 },
    { name: 'Stronghold Infra Inc.',      email: 'stronghold@seed.email.com',    contact: '09180010010', subject: 'Concrete Pump Rental',                   body: 'Need a 40m concrete pump on-site by next Monday. Please confirm availability and mobilization cost.', status: 'Resolved',    daysBack: 6 },
    { name: 'BlueSky Construction',       email: 'bluesky@seed.email.com',       contact: '09180010011', subject: 'Welding Equipment Request',               body: 'Requesting 5 portable arc welders for a 2-week structural steel project in Makati.', status: 'Pending',     daysBack: 2 },
    { name: 'Urban Land Corp.',           email: 'urban@seed.email.com',         contact: '09180010012', subject: 'Personnel Deployment Request',            body: 'We need 10 skilled laborers deployed to our Quezon Ave site starting this Thursday.', status: 'In Progress', daysBack: 4 },
    { name: 'Mainland Constructors',      email: 'mainland@seed.email.com',      contact: '09180010013', subject: 'Equipment Maintenance Partnership',       body: 'Interested in a preventive maintenance contract covering all excavators and loaders.', status: 'Pending',     daysBack: 8 },
    { name: 'Crown Properties Inc.',      email: 'crown@seed.email.com',         contact: '09180010014', subject: 'Formwork System Inquiry',                 body: 'Looking for steel formwork sets for a 10-floor residential project. Please send specs.', status: 'Resolved',    daysBack: 10 },
    { name: 'Alliance Builders',          email: 'alliance@seed.email.com',      contact: '09180010015', subject: 'Safety Training Coordination',            body: 'We would like to coordinate a safety training session for 50 workers before site mobilization.', status: 'Pending',     daysBack: 1 },
    { name: 'Fortis Construction',        email: 'fortis@seed.email.com',        contact: '09180010016', subject: 'Generator Rental for Site Power',         body: 'Need two 45kVA diesel generators for temporary power supply at our Caloocan project.', status: 'In Progress', daysBack: 3 },
    { name: 'Meridian Developers',        email: 'meridian@seed.email.com',      contact: '09180010017', subject: 'Project Handover Documentation',          body: 'Please prepare and submit all handover documents for the Mandaluyong tower project.', status: 'Resolved',    daysBack: 12 },
    { name: 'Crestview Holdings',         email: 'crestview@seed.email.com',     contact: '09180010018', subject: 'Crane Operator Availability',             body: 'Requesting availability of a certified tower crane operator for a 6-week engagement.', status: 'Pending',     daysBack: 2 },
    { name: 'Galaxy Infra Solutions',     email: 'galaxy@seed.email.com',        contact: '09180010019', subject: 'Air Compressor Availability Check',       body: 'Need a 375 CFM air compressor on-site by end of week for pneumatic drilling works.', status: 'In Progress', daysBack: 5 },
    { name: 'Premier Structure Corp.',    email: 'premier@seed.email.com',       contact: '09180010020', subject: 'Backhoe Rental for Excavation',           body: 'Requesting 2 backhoe loaders for a 3-week soil excavation at the Taguig mixed-use site.', status: 'Pending',     daysBack: 1 },
    { name: 'Titan Build Group',          email: 'titan@seed.email.com',         contact: '09180010021', subject: 'Bulk PPE Procurement',                    body: 'Requesting bulk pricing for 100 hard hats, 80 harness sets, and 100 pairs of safety boots.', status: 'Resolved',    daysBack: 9 },
    { name: 'Obelisk Construction',       email: 'obelisk@seed.email.com',       contact: '09180010022', subject: 'Concrete Batching Plant Lease',           body: 'Interested in a 3-month lease of a portable concrete batching plant for our Pasig project.', status: 'Pending',     daysBack: 3 },
    { name: 'Vertex Land Inc.',           email: 'vertex@seed.email.com',        contact: '09180010023', subject: 'Structural Steel Fabrication Inquiry',    body: 'Requesting fabrication quotation for steel columns and beams for a 5-story building.', status: 'In Progress', daysBack: 6 },
    { name: 'Pinnacle Realty Group',      email: 'pinnacle@seed.email.com',      contact: '09180010024', subject: 'Vibrating Roller Availability',           body: 'Need a 10T vibrating roller for road compaction works starting next week.', status: 'Pending',     daysBack: 2 },
    { name: 'Archway Development Corp.',  email: 'archway@seed.email.com',       contact: '09180010025', subject: 'Material Hoist for High-Rise Project',    body: 'Requesting 2 material hoists rated at 500kg for vertical transport at our 20-floor building project.', status: 'Resolved',    daysBack: 14 }
  ];

  for (const item of inquiries) {
    const handler = admins[Math.floor(Math.random() * admins.length)];
    await prisma.client_Inquiry.create({
      data: {
        client_name: item.name,
        client_email: item.email,
        contact_number: item.contact,
        subject: item.subject,
        message_body: item.body,
        status: item.status,
        handled_by: item.status !== 'Pending' ? (handler?.user_id || null) : null,
        submitted_at: daysAgo(item.daysBack, 9 + (item.daysBack % 5), 15)
      }
    });
  }
}

async function seedSystemHealth() {
  await prisma.system_Health_Log.deleteMany({ where: { description: { contains: '[SEEDED]' } } });

  const logs = [
    { type: 'LOGIN_SUCCESS',      desc: '[SEEDED] Admin login from office workstation.',              ip: '192.168.1.10', d: 0,  h: 8  },
    { type: 'LOGIN_FAILED',       desc: '[SEEDED] Failed login attempt — invalid credentials.',       ip: '203.177.88.42',d: 0,  h: 9  },
    { type: 'BACKUP',             desc: '[SEEDED] Scheduled database backup completed successfully.', ip: '192.168.1.1',  d: 1,  h: 2  },
    { type: 'PERMISSION_CHANGE',  desc: '[SEEDED] User permissions updated by system admin.',         ip: '192.168.1.10', d: 1,  h: 10 },
    { type: 'EQUIPMENT_UPDATE',   desc: '[SEEDED] Bulk equipment status update processed.',           ip: '192.168.1.12', d: 2,  h: 11 },
    { type: 'ATTENDANCE_EXPORT',  desc: '[SEEDED] Attendance export for payroll generated.',          ip: '192.168.1.10', d: 2,  h: 14 },
    { type: 'INQUIRY_ASSIGN',     desc: '[SEEDED] Inquiry assignment workflow triggered.',            ip: '192.168.1.15', d: 3,  h: 10 },
    { type: 'LOGIN_SUCCESS',      desc: '[SEEDED] Employee login from mobile device.',                ip: '192.168.1.55', d: 3,  h: 7  },
    { type: 'BACKUP',             desc: '[SEEDED] Manual database backup triggered by admin.',        ip: '192.168.1.1',  d: 4,  h: 16 },
    { type: 'LOGIN_FAILED',       desc: '[SEEDED] Multiple failed login attempts detected.',          ip: '180.244.100.5',d: 4,  h: 22 },
    { type: 'SECURITY_ALERT',     desc: '[SEEDED] Unusual login attempt from unknown IP flagged.',    ip: '203.100.22.88',d: 5,  h: 1  },
    { type: 'USER_CREATED',       desc: '[SEEDED] New employee account created by admin.',            ip: '192.168.1.10', d: 5,  h: 9  },
    { type: 'PERMISSION_CHANGE',  desc: '[SEEDED] Equipment permissions updated for employee.',       ip: '192.168.1.10', d: 6,  h: 11 },
    { type: 'EQUIPMENT_UPDATE',   desc: '[SEEDED] Equipment condition changed to Maintenance.',       ip: '192.168.1.12', d: 6,  h: 14 },
    { type: 'ATTENDANCE_SYNC',    desc: '[SEEDED] Attendance sync completed without errors.',         ip: '192.168.1.20', d: 7,  h: 18 },
    { type: 'BACKUP',             desc: '[SEEDED] Weekly automated backup completed.',                ip: '192.168.1.1',  d: 7,  h: 2  },
    { type: 'LOGIN_SUCCESS',      desc: '[SEEDED] Admin login from home network.',                    ip: '49.144.22.100',d: 8,  h: 20 },
    { type: 'FILE_UPLOAD',        desc: '[SEEDED] Project file uploaded to cloud storage.',           ip: '192.168.1.10', d: 8,  h: 10 },
    { type: 'INQUIRY_RESOLVED',   desc: '[SEEDED] Client inquiry marked as resolved.',               ip: '192.168.1.15', d: 9,  h: 13 },
    { type: 'USER_DEACTIVATED',   desc: '[SEEDED] Inactive employee account deactivated.',            ip: '192.168.1.10', d: 9,  h: 15 },
    { type: 'SECURITY_ALERT',     desc: '[SEEDED] Brute force pattern detected and blocked.',        ip: '185.220.101.3',d: 10, h: 3  },
    { type: 'EQUIPMENT_CHECKOUT', desc: '[SEEDED] Equipment checked out — Excavator CAT 320GC.',     ip: '192.168.1.22', d: 10, h: 9  },
    { type: 'BACKUP',             desc: '[SEEDED] Backup integrity check passed.',                    ip: '192.168.1.1',  d: 11, h: 2  },
    { type: 'LOGIN_SUCCESS',      desc: '[SEEDED] Bulk employee login during morning shift.',         ip: '192.168.1.30', d: 11, h: 7  },
    { type: 'ATTENDANCE_EXPORT',  desc: '[SEEDED] Monthly attendance report exported.',               ip: '192.168.1.10', d: 12, h: 16 }
  ];

  for (const log of logs) {
    await prisma.system_Health_Log.create({
      data: { event_type: log.type, description: log.desc, ip_address: log.ip, timestamp: daysAgo(log.d, log.h, 0) }
    });
  }
}

async function seedSites() {
  const sites = [
    { site_name: 'CICJ Site A - Quezon Ave',    site_address: 'Quezon City',   center_lat: 14.6488, center_lng: 121.0509, geo_fence_radius_meters: 120 },
    { site_name: 'CICJ Site B - Mandaluyong',   site_address: 'Mandaluyong',   center_lat: 14.5794, center_lng: 121.0359, geo_fence_radius_meters: 100 },
    { site_name: 'CICJ Site C - Pasig',         site_address: 'Pasig',         center_lat: 14.5764, center_lng: 121.0851, geo_fence_radius_meters: 110 },
    { site_name: 'CICJ Site D - Makati CBD',    site_address: 'Makati',        center_lat: 14.5547, center_lng: 121.0244, geo_fence_radius_meters: 100 },
    { site_name: 'CICJ Site E - Taguig BGC',    site_address: 'Taguig',        center_lat: 14.5243, center_lng: 121.0530, geo_fence_radius_meters: 130 },
    { site_name: 'CICJ Site F - Caloocan',      site_address: 'Caloocan',      center_lat: 14.6507, center_lng: 120.9723, geo_fence_radius_meters: 115 }
  ];

  for (const site of sites) {
    const existing = await prisma.construction_Site.findFirst({ where: { site_name: site.site_name } });
    if (!existing) {
      await prisma.construction_Site.create({ data: site });
    }
  }
}

async function main() {
  console.log('[Seed] Starting...');

  const seedAdmin = await upsertSeedAdmin();
  if (seedAdmin) console.log(`[Seed] Admin upserted: ${seedAdmin.email}`);

  const passwordHash = await bcrypt.hash('Cicj2025!', 10);
  const users = await upsertSeedUsers(passwordHash);
  console.log(`[Seed] Users upserted: ${users.length}`);

  await seedEquipmentAndCheckouts(users);
  console.log('[Seed] Equipment (42) + checkouts seeded.');

  await seedAttendance(users);
  console.log('[Seed] Attendance logs seeded (30 days).');

  await seedInquiries(users);
  console.log('[Seed] Client inquiries seeded (25).');

  await seedSystemHealth();
  console.log('[Seed] System health logs seeded (25).');

  await seedSites();
  console.log('[Seed] Construction sites seeded (6).');

  console.log('[Seed] Done. Tables written: User, Attendance_Log, Equipment_Inventory, Equipment_Checkout, Client_Inquiry, System_Health_Log, Construction_Site');
  console.log('[Seed] Skipped: Project_File');
  console.log('[Seed] Default password for seeded users: Cicj2025!');
}

main()
  .catch((error) => {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
