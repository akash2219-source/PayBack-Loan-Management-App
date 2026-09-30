import { PaymentFrequency } from '../types';

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export function getTodayISO(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function parseISODate(isoString: string): Date {
  if (typeof isoString === 'string') {
    const parts = isoString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  const fallback = new Date(Date.now() + IST_OFFSET_MS);
  fallback.setUTCHours(0, 0, 0, 0);
  return fallback;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseISODate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function addMonthsPreservingDay(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const targetDay = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(y, m + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(targetDay, daysInTargetMonth);
  return new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), clampedDay));
}

export function calculateNextDueDate(startDate: string, cycle: number, frequency: PaymentFrequency): string {
  const base = parseISODate(startDate);
  if (frequency === 'MONTHLY') {
    return toISODate(addMonthsPreservingDay(base, cycle));
  }
  if (frequency === 'WEEKLY') {
    const nextMs = new Date(base.getTime() + cycle * 7 * 86400000);
    return toISODate(nextMs);
  }
  // DAILY frequency (Pigmy collection / daily loan)
  const nextMs = new Date(base.getTime() + cycle * 1 * 86400000);
  return toISODate(nextMs);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const d1 = parseISODate(fromISO).getTime();
  const d2 = parseISODate(toISO).getTime();
  return Math.round((d2 - d1) / 86400000);
}

export function formatDateDisplay(iso: string | undefined): string {
  if (!iso || iso === 'N/A') return 'N/A';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function isTenDigitPhone(phone: string): boolean {
  return /^\d{10}$/.test(String(phone || '').replace(/\D/g, ''));
}

export function getMonthBounds(isoDate?: string): [string, string] {
  const d = parseISODate(isoDate || getTodayISO());
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return [toISODate(start), toISODate(end)];
}

export function getPreviousMonthStart(isoDate?: string): string {
  const d = parseISODate(isoDate || getTodayISO());
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return toISODate(prev);
}
