import type { Category, Crop } from '../types';
import type { ExpenseRecord, IncomeRecord } from './db';
import { seedCategories, seedCrops } from './seed';

const STORAGE_KEY = 'farm-ledger-local';

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type Snapshot = {
  crops: Crop[];
  categories: Category[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
};

type TableName = keyof Snapshot;

export type LedgerTable<T> = {
  toArray(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(row: T): Promise<void>;
  put(row: T): Promise<void>;
  update(id: string, changes: Partial<T>): Promise<number>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  bulkAdd(rows: readonly T[]): Promise<void>;
  where(index: string): {
    equals(value: string): {
      count(): Promise<number>;
      modify(changes: Partial<T>): Promise<number>;
    };
    between(
      lower: string,
      upper: string,
      includeLower: boolean,
      includeUpper: boolean,
    ): { toArray(): Promise<T[]> };
  };
};

export type LedgerDb = {
  crops: LedgerTable<Crop>;
  categories: LedgerTable<Category>;
  expenses: LedgerTable<ExpenseRecord>;
  incomes: LedgerTable<IncomeRecord>;
  transaction<T>(mode: string, table: unknown, scope: () => Promise<T> | T): Promise<T>;
  transaction<T>(mode: string, a: unknown, b: unknown, scope: () => Promise<T> | T): Promise<T>;
  transaction<T>(mode: string, a: unknown, b: unknown, c: unknown, scope: () => Promise<T> | T): Promise<T>;
  transaction<T>(
    mode: string,
    a: unknown,
    b: unknown,
    c: unknown,
    d: unknown,
    scope: () => Promise<T> | T,
  ): Promise<T>;
};

export type LocalLedger = {
  db: LedgerDb;
  readonly persistent: boolean;
};

export function createLocalLedger(store: KeyValueStore | null): LocalLedger {
  let persistent = store !== null;
  let data = load(store) ?? seedSnapshot();

  const persist = () => {
    if (!store || !persistent) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      persistent = false;
    }
  };

  if (store && persistent) persist();

  const table = <T extends { id: string }>(name: TableName): LedgerTable<T> => ({
    async toArray() {
      return rows<T>(data, name).map((row) => ({ ...row }));
    },
    async get(id) {
      const row = rows<T>(data, name).find((item) => item.id === id);
      return row ? { ...row } : undefined;
    },
    async add(row) {
      rows<T>(data, name).push({ ...row });
      persist();
    },
    async put(row) {
      const list = rows<T>(data, name);
      const index = list.findIndex((item) => item.id === row.id);
      if (index === -1) list.push({ ...row });
      else list[index] = { ...row };
      persist();
    },
    async update(id, changes) {
      const row = rows<T>(data, name).find((item) => item.id === id);
      if (!row) return 0;
      Object.assign(row, changes);
      persist();
      return 1;
    },
    async delete(id) {
      const list = rows<T>(data, name);
      const index = list.findIndex((item) => item.id === id);
      if (index !== -1) list.splice(index, 1);
      persist();
    },
    async clear() {
      data = { ...data, [name]: [] };
      persist();
    },
    async bulkAdd(next) {
      rows<T>(data, name).push(...next.map((row) => ({ ...row })));
      persist();
    },
    where(index) {
      const list = () => rows<T>(data, name);
      return {
        equals(value: string) {
          const matches = () => list().filter((row) => field(row, index) === value);
          return {
            async count() {
              return matches().length;
            },
            async modify(changes: Partial<T>) {
              const found = matches();
              found.forEach((row) => Object.assign(row, changes));
              if (found.length > 0) persist();
              return found.length;
            },
          };
        },
        between(lower: string, upper: string, includeLower: boolean, includeUpper: boolean) {
          return {
            async toArray() {
              return list()
                .filter((row) => inRange(field(row, index), lower, upper, includeLower, includeUpper))
                .map((row) => ({ ...row }));
            },
          };
        },
      };
    },
  });

  const db = {
    crops: table<Crop>('crops'),
    categories: table<Category>('categories'),
    expenses: table<ExpenseRecord>('expenses'),
    incomes: table<IncomeRecord>('incomes'),
    async transaction(_mode: string, ...args: unknown[]) {
      const scope = args[args.length - 1];
      if (typeof scope !== 'function') return undefined;
      return scope();
    },
  } as LedgerDb;

  return {
    db,
    get persistent() {
      return persistent;
    },
  };
}

function seedSnapshot(): Snapshot {
  const now = new Date().toISOString();
  return {
    crops: seedCrops(now),
    categories: seedCategories(now),
    expenses: [],
    incomes: [],
  };
}

function load(store: KeyValueStore | null): Snapshot | null {
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSnapshot(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isSnapshot(value: unknown): value is Snapshot {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Partial<Snapshot>;
  return (
    Array.isArray(record.crops) &&
    Array.isArray(record.categories) &&
    Array.isArray(record.expenses) &&
    Array.isArray(record.incomes)
  );
}

function rows<T>(data: Snapshot, name: TableName): T[] {
  return data[name] as T[];
}

function field(row: object, index: string): string {
  const value = (row as Record<string, unknown>)[index];
  return typeof value === 'string' ? value : '';
}

function inRange(
  value: string,
  lower: string,
  upper: string,
  includeLower: boolean,
  includeUpper: boolean,
): boolean {
  const afterLower = includeLower ? value >= lower : value > lower;
  const beforeUpper = includeUpper ? value <= upper : value < upper;
  return afterLower && beforeUpper;
}
