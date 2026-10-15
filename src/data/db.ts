import Dexie, { type Table } from 'dexie';
import type { Category, Crop, Expense, Income, MetaRow } from '../types';

/**
 * IndexedDB database "FarmLedger".
 *
 * Amounts on expenses and incomes are integer paise (₹1 = 100).
 * Crops, categories, and acres are stored as written.
 * Only repository.ts reads and writes this module.
 *
 * Version 1: crops, categories, expenses.
 * Version 2: adds incomes, and sets crop.acres to null on existing crops.
 * The populate handler seeds Soybean, Onion, Tractor, Labor, and Other
 * only when the database is created for the first time.
 */

export type ExpenseRecord = Omit<Expense, 'amount'> & { amount: number };
export type IncomeRecord = Omit<Income, 'amount'> & { amount: number };

export class FarmLedgerDB extends Dexie {
  crops!: Table<Crop, string>;
  categories!: Table<Category, string>;
  expenses!: Table<ExpenseRecord, string>;
  incomes!: Table<IncomeRecord, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('FarmLedger');

    this.version(1).stores({
      crops: 'id, name, archived, createdAt',
      categories: 'id, name, archived, createdAt',
      expenses: 'id, date, cropId, categoryId, [cropId+date], createdAt',
      meta: 'key',
    });

    this.version(2)
      .stores({
        crops: 'id, name, archived, createdAt',
        categories: 'id, name, archived, createdAt',
        expenses: 'id, date, cropId, categoryId, [cropId+date], createdAt',
        incomes: 'id, date, cropId, [cropId+date], createdAt',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('crops').toCollection().modify((crop: Crop) => {
          if (crop.acres === undefined) crop.acres = null;
        });
      });

    this.on('populate', async () => {
      const now = new Date().toISOString();
      await this.crops.bulkAdd([
        {
          id: '11111111-1111-4111-8111-111111111101',
          name: 'Soybean',
          color: '#2f6b4f',
          archived: false,
          acres: null,
          createdAt: now,
        },
        {
          id: '11111111-1111-4111-8111-111111111102',
          name: 'Onion',
          color: '#c47b2b',
          archived: false,
          acres: null,
          createdAt: now,
        },
      ]);
      await this.categories.bulkAdd([
        {
          id: '22222222-2222-4222-8222-222222222201',
          name: 'Tractor',
          icon: '🚜',
          archived: false,
          createdAt: now,
        },
        {
          id: '22222222-2222-4222-8222-222222222202',
          name: 'Labor',
          icon: '👷',
          archived: false,
          createdAt: now,
        },
        {
          id: '22222222-2222-4222-8222-222222222203',
          name: 'Other',
          icon: '📋',
          archived: false,
          createdAt: now,
        },
      ]);
      await this.meta.add({ key: 'seeded', value: now });
    });
  }
}

export const db = new FarmLedgerDB();
