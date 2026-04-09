const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Script executed - No default users created');
  console.log('[Seed] Create your admin account through the registration system');
}

main().catch(console.error).finally(() => prisma.$disconnect());
