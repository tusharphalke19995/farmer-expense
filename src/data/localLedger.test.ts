import { describe, expect, it } from 'vitest';
import { createLocalLedger, type KeyValueStore } from './localLedger';

function memoryStore(): KeyValueStore & { snapshot(): string | null } {
  let raw: string | null = null;
  return {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
    },
    snapshot: () => raw,
  };
}

describe('local ledger', () => {
  it('seeds crops and keeps an expense after reopening', async () => {
    const store = memoryStore();
    const first = createLocalLedger(store);
    const crops = await first.db.crops.toArray();
    expect(crops.map((crop) => crop.name).sort()).toEqual(['Onion', 'Soybean']);

    const soybean = crops.find((crop) => crop.name === 'Soybean');
    expect(soybean).toBeDefined();
    await first.db.expenses.add({
      id: 'expense-1',
      date: '2026-10-15',
      cropId: soybean!.id,
      categoryId: '22222222-2222-4222-8222-222222222201',
      amount: 25000,
      note: 'seed',
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    });

    const reopened = createLocalLedger(store);
    const saved = await reopened.db.expenses.where('date').between('2026-10-01', '2026-10-31', true, true).toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.amount).toBe(25000);
    expect(reopened.persistent).toBe(true);
  });

  it('stays in memory when storage rejects writes', async () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const ledger = createLocalLedger(store);
    expect(ledger.persistent).toBe(false);
    expect(await ledger.db.crops.toArray()).toHaveLength(2);
  });
});
