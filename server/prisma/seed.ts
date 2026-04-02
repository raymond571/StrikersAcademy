/**
 * Seed script — populates the database with test data for development.
 * Run with: npm run db:seed (from server/)
 * Idempotent: safe to re-run — clears slots first, upserts users & facilities.
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Users ──────────────────────────────────────────────────

  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { phone: '9000000001' },
    update: { name: 'Admin', email: 'admin@strikers.com', age: 30, password: adminPassword, role: 'ADMIN' },
    create: {
      name: 'Admin',
      email: 'admin@strikers.com',
      phone: '9000000001',
      age: 30,
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const staffPassword = await hashPassword('staff123');
  const staff = await prisma.user.upsert({
    where: { phone: '9000000002' },
    update: { name: 'Staff', email: 'staff@strikers.com', age: 25, password: staffPassword, role: 'STAFF' },
    create: {
      name: 'Staff',
      email: 'staff@strikers.com',
      phone: '9000000002',
      age: 25,
      password: staffPassword,
      role: 'STAFF',
    },
  });

  const customerPassword = await hashPassword('test123');
  const customer = await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: { name: 'Arul', email: 'arul@test.com', age: 25, password: customerPassword, role: 'CUSTOMER' },
    create: {
      name: 'Arul',
      email: 'arul@test.com',
      phone: '9876543210',
      age: 25,
      password: customerPassword,
      role: 'CUSTOMER',
    },
  });

  // ── Facilities ─────────────────────────────────────────────

  const netLane1 = await prisma.facility.upsert({
    where: { id: 'facility-net-1' },
    update: { name: 'Net Lane 1', type: 'NET', pricePerSlot: 50000 },
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
    update: { name: 'Net Lane 2', type: 'NET', pricePerSlot: 50000 },
    create: {
      id: 'facility-net-2',
      name: 'Net Lane 2',
      type: 'NET',
      description: 'Bowling machine net lane — intermediate level',
      pricePerSlot: 50000, // ₹500
      isActive: true,
    },
  });

  const turfPitchA = await prisma.facility.upsert({
    where: { id: 'facility-turf-1' },
    update: { name: 'Turf Pitch A', type: 'TURF', pricePerSlot: 150000 },
    create: {
      id: 'facility-turf-1',
      name: 'Turf Pitch A',
      type: 'TURF',
      description: 'Full-size turf wicket — coaching and match practice',
      pricePerSlot: 150000, // ₹1500
      isActive: true,
    },
  });

  const turfPitchB = await prisma.facility.upsert({
    where: { id: 'facility-turf-2' },
    update: { name: 'Turf Pitch B', type: 'TURF', pricePerSlot: 120000 },
    create: {
      id: 'facility-turf-2',
      name: 'Turf Pitch B',
      type: 'TURF',
      description: 'Turf wicket — practice sessions',
      pricePerSlot: 120000, // ₹1200
      isActive: true,
    },
  });

  const facilities = [netLane1, netLane2, turfPitchA, turfPitchB];

  // ── Slots — next 7 days ────────────────────────────────────

  // Delete existing slots (cascade will handle orphaned bookings in dev)
  // Only delete slots that have no bookings to be safe
  await prisma.slot.deleteMany({
    where: {
      bookings: { none: {} },
    },
  });

  const timeSlots = [
    // Morning
    { startTime: '06:00', endTime: '07:00' },
    { startTime: '07:00', endTime: '08:00' },
    { startTime: '08:00', endTime: '09:00' },
    { startTime: '09:00', endTime: '10:00' },
    // Afternoon
    { startTime: '14:00', endTime: '15:00' },
    { startTime: '15:00', endTime: '16:00' },
    { startTime: '16:00', endTime: '17:00' },
    // Evening
    { startTime: '17:00', endTime: '18:00' },
    { startTime: '18:00', endTime: '19:00' },
    { startTime: '19:00', endTime: '20:00' },
    { startTime: '20:00', endTime: '21:00' },
  ];

  // Generate date strings for the next 7 days
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  let slotsCreated = 0;
  for (const facility of facilities) {
    const capacity = facility.type === 'NET' ? 1 : 2;
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
          update: { endTime: ts.endTime, capacity },
          create: {
            facilityId: facility.id,
            date,
            startTime: ts.startTime,
            endTime: ts.endTime,
            capacity,
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
    { key: 'contact_phone', value: '+91 90000 00001' },
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

  // ── Summary ────────────────────────────────────────────────

  console.log('\nSeed complete!');
  console.log('─────────────────────────────────────────');
  console.log('Users:');
  console.log(`  Admin:    ${admin.name} | phone: ${admin.phone} | password: admin123`);
  console.log(`  Staff:    ${staff.name} | phone: ${staff.phone} | password: staff123`);
  console.log(`  Customer: ${customer.name} | phone: ${customer.phone} | password: test123`);
  console.log(`\nFacilities: ${facilities.length}`);
  facilities.forEach((f) => console.log(`  ${f.name} (${f.type}) — ₹${f.pricePerSlot / 100}/slot`));
  console.log(`\nSlots created/upserted: ${slotsCreated}`);
  console.log(`  ${facilities.length} facilities × ${dates.length} days × ${timeSlots.length} time slots`);
  console.log(`  Dates: ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`  NET capacity: 1, TURF capacity: 2`);
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
