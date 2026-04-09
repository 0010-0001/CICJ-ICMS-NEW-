const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [
    demoUsers,
    attendanceLogsTotal,
    demoEquipment,
    demoCheckouts,
    demoInquiries,
    demoHealthLogs,
    demoSites,
    demoProjectFiles
  ] = await Promise.all([
    prisma.user.count({ where: { email: { endsWith: '@demo.cicj.local' } } }),
    prisma.attendance_Log.count(),
    prisma.equipment_Inventory.count({ where: { qr_number: { startsWith: 'DEMO-EQ-' } } }),
    prisma.equipment_Checkout.count({ where: { notes: { contains: '[DEMO]' } } }),
    prisma.client_Inquiry.count({ where: { client_email: { endsWith: '@demo.client' } } }),
    prisma.system_Health_Log.count({ where: { description: { contains: '[DEMO]' } } }),
    prisma.construction_Site.count({ where: { site_name: { startsWith: 'CICJ Site' } } }),
    prisma.project_File.count({
      where: {
        OR: [
          { file_name: { contains: '[DEMO]' } },
          { cloudinary_public_id: { contains: 'DEMO' } },
          { local_ftp_path: { contains: 'DEMO' } }
        ]
      }
    })
  ]);

  console.log(
    JSON.stringify(
      {
        demoUsers,
        attendanceLogsTotal,
        demoEquipment,
        demoCheckouts,
        demoInquiries,
        demoHealthLogs,
        demoSites,
        demoProjectFiles
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
