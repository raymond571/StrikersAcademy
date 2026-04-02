/**
 * Seed script — populates the database with initial data for development.
 * Run with: npm run db:seed (from server/)
 */

import { PrismaClient, Role, FacilityType } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Quick hash for seed — in production use bcrypt
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@strikersacademy.in' },
    update: {},
    create: {
      name: 'Academy Admin',
      email: 'admin@strikersacademy.in',
      phone: '9000000000',
      password: hashPassword('admin123'),
      role: Role.ADMIN,
    },
  });

  // Sample customer
  const customer = await prisma.user.upsert({
    where: { email: 'cricketer@example.com' },
    update: {},
    create: {
      name: 'Ravi Kumar',
      email: 'cricketer@example.com',
      phone: '9876543210',
      password: hashPassword('customer123'),
      role: Role.CUSTOMER,
    },
  });

  // Facilities
  const netLane1 = await prisma.facility.upsert({
    where: { id: 'facility-net-1' },
    update: {},
    create: {
      id: 'facility-net-1',
      name: 'Net Lane 1',
      type: FacilityType.NET,
      description: 'Bowling machine net lane — suitable for all skill levels',
      pricePerSlot: 50000, // ₹500
      isActive: true,
    },
  });

  const netLane2 = await prisma.facility.upsert({
    where: { id: 'facility-net-2' },
    update: {},
    create: {
      id: 'facility-net-2',
      name: 'Net Lane 2',
      type: FacilityType.NET,
      description: 'Bowling machine net lane — intermediate',
      pricePerSlot: 50000,
      isActive: true,
    },
  });

  const turfPitch = await prisma.facility.upsert({
    where: { id: 'facility-turf-1' },
    update: {},
    create: {
      id: 'facility-turf-1',
      name: 'Turf Pitch A',
      type: FacilityType.TURF,
      description: 'Full-size turf wicket — coaching and match practice',
      pricePerSlot: 120000, // ₹1200
      isActive: true,
    },
  });

  console.log('Seed complete:', { admin: admin.email, customer: customer.email });
  console.log('Facilities created:', [netLane1.name, netLane2.name, turfPitch.name]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
