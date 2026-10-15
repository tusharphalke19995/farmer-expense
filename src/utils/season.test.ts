import { describe, expect, it } from 'vitest';
import { defaultPreset, kharifRange, monthRange, rabiRange, yearRange } from './season';

describe('season ranges', () => {
  it('treats 15 Oct 2026 as kharif', () => {
    const today = new Date(2026, 9, 15);
    expect(monthRange(today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(yearRange(today)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(kharifRange(today)).toEqual({ from: '2026-06-01', to: '2026-10-31' });
    expect(rabiRange(today)).toEqual({ from: '2026-11-01', to: '2027-03-31' });
    expect(defaultPreset(today)).toBe('kharif');
  });

  it('uses the rabi season that covers January', () => {
    const today = new Date(2026, 0, 10);
    expect(kharifRange(today)).toEqual({ from: '2025-06-01', to: '2025-10-31' });
    expect(rabiRange(today)).toEqual({ from: '2025-11-01', to: '2026-03-31' });
    expect(defaultPreset(today)).toBe('rabi');
  });

  it('uses the calendar year in the gap before kharif', () => {
    const today = new Date(2026, 4, 2);
    expect(defaultPreset(today)).toBe('year');
    expect(rabiRange(today)).toEqual({ from: '2026-11-01', to: '2027-03-31' });
  });
});
