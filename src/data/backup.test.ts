import { describe, expect, it } from 'vitest';
import type { Category, Crop, Expense } from '../types';
import { expensesToCsv, parseBackup } from './backup';

function crop(overrides: Partial<Crop> = {}): Crop {
  return {
    id: 'crop-1',
    name: 'Soybean',
    color: '#2f6b4f',
    archived: false,
    acres: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Tractor',
    icon: '🚜',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    date: '2026-10-15',
    cropId: 'crop-1',
    categoryId: 'cat-1',
    amount: 125.5,
    note: '',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    ...overrides,
  };
}

function backup(overrides: Record<string, unknown> = {}) {
  return {
    app: 'farm-ledger',
    schemaVersion: 2,
    exportedAt: '2026-10-15T00:00:00.000Z',
    crops: [crop()],
    categories: [category()],
    expenses: [expense()],
    incomes: [],
    ...overrides,
  };
}

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    const parsed = parseBackup(backup());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.backup.expenses[0]?.amount).toBe(125.5);
  });

  it('fills acres and sales when importing a version 1 file', () => {
    const { acres: _ignored, ...legacyCrop } = crop();
    void _ignored;
    const parsed = parseBackup(
      backup({
        schemaVersion: 1,
        crops: [legacyCrop],
        incomes: undefined,
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.crops[0]?.acres).toBeNull();
      expect(parsed.backup.incomes).toEqual([]);
    }
  });

  it('rejects duplicate names, unknown crops, and invalid amounts', () => {
    expect(parseBackup(backup({ app: 'other' })).ok).toBe(false);
    expect(
      parseBackup(
        backup({
          crops: [crop(), crop({ id: 'crop-2', name: ' soybean ' })],
        }),
      ).ok,
    ).toBe(false);
    expect(parseBackup(backup({ expenses: [expense({ cropId: 'missing' })] })).ok).toBe(false);
    expect(parseBackup(backup({ expenses: [expense({ amount: 0 })] })).ok).toBe(false);
    expect(parseBackup(backup({ expenses: [expense({ amount: 1.234 })] })).ok).toBe(false);
  });
});

describe('expensesToCsv', () => {
  it('writes rupees and escapes notes', () => {
    const csv = expensesToCsv(
      [expense({ note: 'diesel, morning' })],
      [crop()],
      [category()],
    );
    expect(csv.startsWith('\uFEFFDate,Crop,Category,Amount (INR),Note')).toBe(true);
    expect(csv).toContain('125.50');
    expect(csv).toContain('"diesel, morning"');
  });
});
