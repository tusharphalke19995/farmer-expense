import type { DateRange } from '../types';

export type SeasonPreset = 'all' | 'month' | 'year' | 'kharif' | 'rabi' | 'custom';

export function defaultPreset(today = new Date()): SeasonPreset {
  const month = today.getMonth();
  if (month >= 5 && month <= 9) return 'kharif';
  if (month >= 10 || month <= 2) return 'rabi';
  return 'year';
}

export function rangeForPreset(preset: SeasonPreset, today = new Date()): DateRange {
  switch (preset) {
    case 'all':
    case 'custom':
      return { from: '', to: '' };
    case 'month':
      return monthRange(today);
    case 'year':
      return yearRange(today);
    case 'kharif':
      return kharifRange(today);
    case 'rabi':
      return rabiRange(today);
  }
}

export function monthRange(today: Date): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return { from: iso(year, month + 1, 1), to: iso(year, month + 1, last) };
}

export function yearRange(today: Date): DateRange {
  const year = today.getFullYear();
  return { from: iso(year, 1, 1), to: iso(year, 12, 31) };
}

/** Kharif: 1 Jun – 31 Oct. Before June, this returns the previous year’s season. */
export function kharifRange(today: Date): DateRange {
  const year = today.getMonth() < 5 ? today.getFullYear() - 1 : today.getFullYear();
  return { from: iso(year, 6, 1), to: iso(year, 10, 31) };
}

/** Rabi: 1 Nov – 31 Mar. January through March belong to the season that started last November. */
export function rabiRange(today: Date): DateRange {
  if (today.getMonth() <= 2) {
    return { from: iso(today.getFullYear() - 1, 11, 1), to: iso(today.getFullYear(), 3, 31) };
  }
  return { from: iso(today.getFullYear(), 11, 1), to: iso(today.getFullYear() + 1, 3, 31) };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
