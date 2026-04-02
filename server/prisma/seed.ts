/**
 * Seed script — populates the database with initial data for development.
 * Run with: npm run db:seed (from server/)
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────

  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { phone: '9000000000' },
    update: {},
    create: {
      name: 'Academy Admin',
      email: 'admin@strikersacademy.in',
      phone: '9000000000',
      age: 35,
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const staffPassword = await hashPassword('staff123');
  const staff = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: {
      name: 'Reception Staff',
      email: 'staff@strikersacademy.in',
      phone: '9000000001',
      age: 28,
      password: staffPassword,
      role: 'STAFF',
    },
  });

  const customerPassword = await hashPassword('customer123');
  const customer = await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      age: 22,
      password: customerPassword,
      role: 'CUSTOMER',
    },
  });

  // ── Facilities ─────────────────────────────────────────────

  const netLane1 = await prisma.facility.upsert({
    where: { id: 'facility-net-1' },
    update: {},
    create: {
      id: 'facility-net-1',
      name: 'Net Lane 1',
      type: 'NET',
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
      type: 'NET',
      description: 'Bowling machine net lane — intermediate level',
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
      type: 'TURF',
      description: 'Full-size turf wicket — coaching and match practice',
      pricePerSlot: 120000, // ₹1200
      isActive: true,
    },
  });

  // ── Slots for today + tomorrow ─────────────────────────────

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const timeSlots = [
    { startTime: '06:00', endTime: '07:00' },
    { startTime: '07:00', endTime: '08:00' },
    { startTime: '08:00', endTime: '09:00' },
    { startTime: '16:00', endTime: '17:00' },
    { startTime: '17:00', endTime: '18:00' },
    { startTime: '18:00', endTime: '19:00' },
    { startTime: '19:00', endTime: '20:00' },
  ];

  const facilities = [netLane1, netLane2, turfPitch];
  const dates = [todayStr, tomorrowStr];

  let slotsCreated = 0;
  for (const facility of facilities) {
    for (const date of dates) {
      for (const ts of timeSlots) {
        await prisma.slot.upsert({
          where: {
            facilityId_date_startTime: {
              facilityId: facility.id,
              date,
              startTime: ts.startTime,
            },
          },
          update: {},
          create: {
            facilityId: facility.id,
            date,
            startTime: ts.startTime,
            endTime: ts.endTime,
            // Turf allows teams (11 players), nets allow 2 people per slot
            capacity: facility.type === 'TURF' ? 11 : 2,
          },
        });
        slotsCreated++;
      }
    }
  }

  // ── Content blocks (landing page defaults) ─────────────────

  const contentDefaults = [
    { key: 'hero_title', value: "StrikersAcademy — Chennai's Premier Cricket Training Centre" },
    { key: 'hero_subtitle', value: 'Book nets, turf, and coaching slots online in seconds' },
    { key: 'about_text', value: 'StrikersAcademy has been nurturing cricket talent in Chennai since 2010. Our state-of-the-art facilities include bowling machine nets, full-size turf pitches, and expert coaching sessions.' },
    { key: 'contact_phone', value: '+91 90000 00000' },
    { key: 'contact_email', value: 'info@strikersacademy.in' },
    { key: 'contact_address', value: 'StrikersAcademy, Chennai, Tamil Nadu' },
  ];

  for (const block of contentDefaults) {
    await prisma.contentBlock.upsert({
      where: { key: block.key },
      update: {},
      create: block,
    });
  }

  console.log('Seed complete.');
  console.log('Users:', {
    admin: `${admin.name} (phone: ${admin.phone}, password: admin123)`,
    staff: `${staff.name} (phone: ${staff.phone}, password: staff123)`,
    customer: `${customer.name} (phone: ${customer.phone}, password: customer123)`,
  });
  console.log('Facilities:', [netLane1.name, netLane2.name, turfPitch.name]);
  console.log(`Slots created/confirmed: ${slotsCreated} across dates: ${todayStr}, ${tomorrowStr}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
