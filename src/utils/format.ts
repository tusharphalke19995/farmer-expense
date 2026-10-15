import { fromPaise } from '../data/money';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function formatDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAcres(acres: number | null): string {
  if (acres == null) return '';
  return String(acres);
}

export function parseAmount(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = raw.trim().replace(/₹/g, '').replace(/,/g, '').replace(/\s/g, '');
  if (!cleaned) return { ok: false, error: 'Enter an amount.' };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Use rupees with up to 2 decimal places.' };
  }
  const paise = decimalToPaise(cleaned);
  if (paise <= 0) return { ok: false, error: 'Amount must be greater than 0.' };
  if (paise > 9_999_999_900) return { ok: false, error: 'Amount is too large.' };
  return { ok: true, value: fromPaise(paise) };
}

export function parseAcres(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const cleaned = raw.trim();
  if (!cleaned) return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: 'Enter acres with up to 2 decimal places.' };
  }
  const paise = decimalToPaise(cleaned);
  if (paise <= 0) return { ok: false, error: 'Acres must be greater than 0.' };
  if (paise > 10_000_000) return { ok: false, error: 'Acres value is too large.' };
  return { ok: true, value: fromPaise(paise) };
}

function decimalToPaise(cleaned: string): number {
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
