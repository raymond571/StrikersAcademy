/**
 * SettingsService — key-value store for admin-configurable settings.
 */
import { PrismaClient } from '@prisma/client';

// Default values for settings
const DEFAULTS: Record<string, string> = {
  cancellation_charge_percent: '10',  // 10% cancellation fee
  academy_name: 'StrikersAcademy',
  academy_address: 'Chennai, Tamil Nadu',
  academy_phone: '+91 90000 00001',
  academy_email: 'info@strikersacademy.in',
  academy_gst: '',
};

export const SettingsService = {
  async get(prisma: PrismaClient, key: string): Promise<string> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? DEFAULTS[key] ?? '';
  },

  async getMany(prisma: PrismaClient, keys: string[]): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    const result: Record<string, string> = {};
    for (const key of keys) {
      const found = settings.find((s: any) => s.key === key);
      result[key] = found?.value ?? DEFAULTS[key] ?? '';
    }
    return result;
  },

  async getAll(prisma: PrismaClient): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  },

  async set(prisma: PrismaClient, key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  async setMany(prisma: PrismaClient, data: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(data)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  },

  /** Get cancellation charge as percentage (0-100) */
  async getCancellationChargePercent(prisma: PrismaClient): Promise<number> {
    const val = await this.get(prisma, 'cancellation_charge_percent');
    const pct = parseFloat(val);
    return isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
  },
};
