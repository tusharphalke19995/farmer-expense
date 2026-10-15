import { CATEGORY_ICONS, CROP_COLORS } from '../constants';
import type {
  Category,
  Crop,
  DashboardSummary,
  DateRange,
  Expense,
  ExpenseFilter,
  ExpenseInput,
  Income,
  IncomeInput,
  UsageCounts,
} from '../types';
import { buildSummary } from './aggregates';
import { expensesToCsv, isIsoDate, parseBackup, type BackupFile } from './backup';
import { db, type ExpenseRecord, type IncomeRecord } from './db';
import { fromPaise, round2, toPaise } from './money';
import { displayName, findDuplicateName } from './names';

/**
 * The only data access the UI should use.
 * Swap this object for a Supabase or REST implementation of ExpenseRepository
 * without changing screens or hooks.
 *
 * Expense and sale amounts cross this boundary as rupees.
 * IndexedDB stores those amounts as integer paise.
 */

export type RepositoryErrorCode = 'DUPLICATE_NAME' | 'IN_USE' | 'NOT_FOUND' | 'VALIDATION' | 'STORAGE';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(message: string, code: RepositoryErrorCode) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export type ImportCounts = {
  crops: number;
  categories: number;
  expenses: number;
  incomes: number;
};

export type ExpenseRepository = {
  listCrops(): Promise<Crop[]>;
  addCrop(name: string): Promise<Crop>;
  renameCrop(id: string, name: string): Promise<Crop>;
  setCropArchived(id: string, archived: boolean): Promise<void>;
  setCropAcres(id: string, acres: number | null): Promise<void>;
  deleteCrop(id: string): Promise<void>;
  mergeCrops(fromId: string, intoId: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  addCategory(name: string, icon?: string): Promise<Category>;
  renameCategory(id: string, name: string): Promise<Category>;
  setCategoryIcon(id: string, icon: string): Promise<void>;
  setCategoryArchived(id: string, archived: boolean): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  mergeCategories(fromId: string, intoId: string): Promise<void>;

  listExpenses(filter: ExpenseFilter): Promise<Expense[]>;
  addExpense(input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;

  listIncomes(range: DateRange): Promise<Income[]>;
  addIncome(input: IncomeInput): Promise<Income>;
  updateIncome(id: string, input: IncomeInput): Promise<Income>;
  deleteIncome(id: string): Promise<void>;

  summarize(range: DateRange): Promise<DashboardSummary>;
  usage(): Promise<UsageCounts>;

  exportBackup(): Promise<BackupFile>;
  exportExpensesCsv(filter: ExpenseFilter): Promise<string>;
  importBackup(data: unknown): Promise<ImportCounts>;
};

const dexieRepository: ExpenseRepository = {
  listCrops: () => run(listCrops),
  addCrop: (name) => run(() => addCrop(name)),
  renameCrop: (id, name) => run(() => renameCrop(id, name)),
  setCropArchived: (id, archived) => run(() => setCropArchived(id, archived)),
  setCropAcres: (id, acres) => run(() => setCropAcres(id, acres)),
  deleteCrop: (id) => run(() => deleteCrop(id)),
  mergeCrops: (fromId, intoId) => run(() => mergeCrops(fromId, intoId)),

  listCategories: () => run(listCategories),
  addCategory: (name, icon) => run(() => addCategory(name, icon)),
  renameCategory: (id, name) => run(() => renameCategory(id, name)),
  setCategoryIcon: (id, icon) => run(() => setCategoryIcon(id, icon)),
  setCategoryArchived: (id, archived) => run(() => setCategoryArchived(id, archived)),
  deleteCategory: (id) => run(() => deleteCategory(id)),
  mergeCategories: (fromId, intoId) => run(() => mergeCategories(fromId, intoId)),

  listExpenses: (filter) => run(() => listExpenses(filter)),
  addExpense: (input) => run(() => addExpense(input)),
  updateExpense: (id, input) => run(() => updateExpense(id, input)),
  deleteExpense: (id) => run(() => deleteExpense(id)),

  listIncomes: (range) => run(() => listIncomes(range)),
  addIncome: (input) => run(() => addIncome(input)),
  updateIncome: (id, input) => run(() => updateIncome(id, input)),
  deleteIncome: (id) => run(() => deleteIncome(id)),

  summarize: (range) => run(() => summarize(range)),
  usage: () => run(usage),

  exportBackup: () => run(exportBackup),
  exportExpensesCsv: (filter) => run(() => exportExpensesCsv(filter)),
  importBackup: (data) => run(() => importBackup(data)),
};

export const repository: ExpenseRepository = dexieRepository;

export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong while saving.';
}

async function listCrops(): Promise<Crop[]> {
  return byName(await db.crops.toArray());
}

async function addCrop(name: string): Promise<Crop> {
  const clean = assertName(name, 'crop');
  return db.transaction('rw', db.crops, async () => {
    const crops = await db.crops.toArray();
    assertUnique(crops, clean, 'crop');
    const crop: Crop = {
      id: createId(),
      name: clean,
      color: nextColor(crops),
      archived: false,
      acres: null,
      createdAt: new Date().toISOString(),
    };
    await db.crops.add(crop);
    return crop;
  });
}

async function renameCrop(id: string, name: string): Promise<Crop> {
  const clean = assertName(name, 'crop');
  return db.transaction('rw', db.crops, async () => {
    const crops = await db.crops.toArray();
    if (!crops.some((crop) => crop.id === id)) throw new RepositoryError('Crop not found.', 'NOT_FOUND');
    assertUnique(crops, clean, 'crop', id);
    await db.crops.update(id, { name: clean });
    const updated = await db.crops.get(id);
    if (!updated) throw new RepositoryError('Crop not found.', 'NOT_FOUND');
    return updated;
  });
}

async function setCropArchived(id: string, archived: boolean): Promise<void> {
  await requireCrop(id);
  await db.crops.update(id, { archived });
}

async function setCropAcres(id: string, acres: number | null): Promise<void> {
  await requireCrop(id);
  await db.crops.update(id, { acres: assertAcres(acres) });
}

async function deleteCrop(id: string): Promise<void> {
  await requireCrop(id);
  const [expenses, incomes] = await Promise.all([
    db.expenses.where('cropId').equals(id).count(),
    db.incomes.where('cropId').equals(id).count(),
  ]);
  if (expenses + incomes > 0) {
    throw new RepositoryError(usedMessage('crop', expenses, incomes), 'IN_USE');
  }
  await db.crops.delete(id);
}

async function mergeCrops(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) throw new RepositoryError('Choose a different crop to merge into.', 'VALIDATION');
  await db.transaction('rw', db.crops, db.expenses, db.incomes, async () => {
    const [from, into] = await Promise.all([db.crops.get(fromId), db.crops.get(intoId)]);
    if (!from || !into) throw new RepositoryError('Crop not found.', 'NOT_FOUND');
    const now = new Date().toISOString();
    await db.expenses.where('cropId').equals(fromId).modify({ cropId: intoId, updatedAt: now });
    await db.incomes.where('cropId').equals(fromId).modify({ cropId: intoId, updatedAt: now });
    await db.crops.delete(fromId);
  });
}

async function listCategories(): Promise<Category[]> {
  return byName(await db.categories.toArray());
}

async function addCategory(name: string, icon?: string): Promise<Category> {
  const clean = assertName(name, 'category');
  return db.transaction('rw', db.categories, async () => {
    const categories = await db.categories.toArray();
    assertUnique(categories, clean, 'category');
    const category: Category = {
      id: createId(),
      name: clean,
      icon: assertIcon(icon ?? nextIcon(categories)),
      archived: false,
      createdAt: new Date().toISOString(),
    };
    await db.categories.add(category);
    return category;
  });
}

async function renameCategory(id: string, name: string): Promise<Category> {
  const clean = assertName(name, 'category');
  return db.transaction('rw', db.categories, async () => {
    const categories = await db.categories.toArray();
    if (!categories.some((category) => category.id === id)) {
      throw new RepositoryError('Category not found.', 'NOT_FOUND');
    }
    assertUnique(categories, clean, 'category', id);
    await db.categories.update(id, { name: clean });
    const updated = await db.categories.get(id);
    if (!updated) throw new RepositoryError('Category not found.', 'NOT_FOUND');
    return updated;
  });
}

async function setCategoryIcon(id: string, icon: string): Promise<void> {
  await requireCategory(id);
  await db.categories.update(id, { icon: assertIcon(icon) });
}

async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await requireCategory(id);
  await db.categories.update(id, { archived });
}

async function deleteCategory(id: string): Promise<void> {
  await requireCategory(id);
  const expenses = await db.expenses.where('categoryId').equals(id).count();
  if (expenses > 0) throw new RepositoryError(usedMessage('category', expenses), 'IN_USE');
  await db.categories.delete(id);
}

async function mergeCategories(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) {
    throw new RepositoryError('Choose a different category to merge into.', 'VALIDATION');
  }
  await db.transaction('rw', db.categories, db.expenses, async () => {
    const [from, into] = await Promise.all([db.categories.get(fromId), db.categories.get(intoId)]);
    if (!from || !into) throw new RepositoryError('Category not found.', 'NOT_FOUND');
    const now = new Date().toISOString();
    await db.expenses.where('categoryId').equals(fromId).modify({ categoryId: intoId, updatedAt: now });
    await db.categories.delete(fromId);
  });
}

async function listExpenses(filter: ExpenseFilter): Promise<Expense[]> {
  const rows = await expenseRows({ from: filter.from, to: filter.to });
  return rows
    .map(fromExpenseRecord)
    .filter((expense) => !filter.cropId || expense.cropId === filter.cropId)
    .filter((expense) => !filter.categoryId || expense.categoryId === filter.categoryId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

async function addExpense(input: ExpenseInput): Promise<Expense> {
  const draft = validateExpenseInput(input);
  await assertExpenseLinks(draft.cropId, draft.categoryId, null);
  const now = new Date().toISOString();
  const record: ExpenseRecord = {
    id: createId(),
    date: draft.date,
    cropId: draft.cropId,
    categoryId: draft.categoryId,
    amount: draft.amountPaise,
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  };
  await db.expenses.add(record);
  return fromExpenseRecord(record);
}

async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new RepositoryError('Expense not found.', 'NOT_FOUND');
  const draft = validateExpenseInput(input);
  await assertExpenseLinks(draft.cropId, draft.categoryId, fromExpenseRecord(existing));
  const record: ExpenseRecord = {
    ...existing,
    date: draft.date,
    cropId: draft.cropId,
    categoryId: draft.categoryId,
    amount: draft.amountPaise,
    note: draft.note,
    updatedAt: new Date().toISOString(),
  };
  await db.expenses.put(record);
  return fromExpenseRecord(record);
}

async function deleteExpense(id: string): Promise<void> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new RepositoryError('Expense not found.', 'NOT_FOUND');
  await db.expenses.delete(id);
}

async function listIncomes(range: DateRange): Promise<Income[]> {
  const rows = await incomeRows(range);
  return rows
    .map(fromIncomeRecord)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

async function addIncome(input: IncomeInput): Promise<Income> {
  const draft = validateIncomeInput(input);
  await assertIncomeCrop(draft.cropId, null);
  const now = new Date().toISOString();
  const record: IncomeRecord = {
    id: createId(),
    date: draft.date,
    cropId: draft.cropId,
    amount: draft.amountPaise,
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  };
  await db.incomes.add(record);
  return fromIncomeRecord(record);
}

async function updateIncome(id: string, input: IncomeInput): Promise<Income> {
  const existing = await db.incomes.get(id);
  if (!existing) throw new RepositoryError('Sale not found.', 'NOT_FOUND');
  const draft = validateIncomeInput(input);
  await assertIncomeCrop(draft.cropId, fromIncomeRecord(existing));
  const record: IncomeRecord = {
    ...existing,
    date: draft.date,
    cropId: draft.cropId,
    amount: draft.amountPaise,
    note: draft.note,
    updatedAt: new Date().toISOString(),
  };
  await db.incomes.put(record);
  return fromIncomeRecord(record);
}

async function deleteIncome(id: string): Promise<void> {
  const existing = await db.incomes.get(id);
  if (!existing) throw new RepositoryError('Sale not found.', 'NOT_FOUND');
  await db.incomes.delete(id);
}

async function summarize(range: DateRange): Promise<DashboardSummary> {
  const [crops, expenses, incomes] = await Promise.all([
    listCrops(),
    listExpenses({ cropId: '', categoryId: '', from: '', to: '' }),
    listIncomes({ from: '', to: '' }),
  ]);
  return buildSummary({ crops, expenses, incomes, range });
}

async function usage(): Promise<UsageCounts> {
  const [expenses, incomes] = await Promise.all([db.expenses.toArray(), db.incomes.toArray()]);
  const expensesByCrop: Record<string, number> = {};
  const expensesByCategory: Record<string, number> = {};
  const incomesByCrop: Record<string, number> = {};
  for (const expense of expenses) {
    expensesByCrop[expense.cropId] = (expensesByCrop[expense.cropId] ?? 0) + 1;
    expensesByCategory[expense.categoryId] = (expensesByCategory[expense.categoryId] ?? 0) + 1;
  }
  for (const sale of incomes) {
    incomesByCrop[sale.cropId] = (incomesByCrop[sale.cropId] ?? 0) + 1;
  }
  return { expensesByCrop, expensesByCategory, incomesByCrop };
}

async function exportBackup(): Promise<BackupFile> {
  const [crops, categories, expenses, incomes] = await Promise.all([
    listCrops(),
    listCategories(),
    listExpenses({ cropId: '', categoryId: '', from: '', to: '' }),
    listIncomes({ from: '', to: '' }),
  ]);
  return {
    app: 'farm-ledger',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    crops,
    categories,
    expenses,
    incomes,
  };
}

async function exportExpensesCsv(filter: ExpenseFilter): Promise<string> {
  const [expenses, crops, categories] = await Promise.all([
    listExpenses(filter),
    listCrops(),
    listCategories(),
  ]);
  return expensesToCsv(expenses, crops, categories);
}

async function importBackup(data: unknown): Promise<ImportCounts> {
  const parsed = parseBackup(data);
  if (!parsed.ok) throw new RepositoryError(parsed.error, 'VALIDATION');
  const backup = parsed.backup;
  await db.transaction('rw', db.crops, db.categories, db.expenses, db.incomes, async () => {
    await db.expenses.clear();
    await db.incomes.clear();
    await db.crops.clear();
    await db.categories.clear();
    if (backup.crops.length > 0) await db.crops.bulkAdd(backup.crops);
    if (backup.categories.length > 0) await db.categories.bulkAdd(backup.categories);
    if (backup.expenses.length > 0) await db.expenses.bulkAdd(backup.expenses.map(toExpenseRecord));
    if (backup.incomes.length > 0) await db.incomes.bulkAdd(backup.incomes.map(toIncomeRecord));
  });
  return {
    crops: backup.crops.length,
    categories: backup.categories.length,
    expenses: backup.expenses.length,
    incomes: backup.incomes.length,
  };
}

async function expenseRows(range: DateRange): Promise<ExpenseRecord[]> {
  if (!range.from && !range.to) return db.expenses.toArray();
  const lower = range.from || '0000-01-01';
  const upper = range.to || '9999-12-31';
  if (lower > upper) return [];
  return db.expenses.where('date').between(lower, upper, true, true).toArray();
}

async function incomeRows(range: DateRange): Promise<IncomeRecord[]> {
  if (!range.from && !range.to) return db.incomes.toArray();
  const lower = range.from || '0000-01-01';
  const upper = range.to || '9999-12-31';
  if (lower > upper) return [];
  return db.incomes.where('date').between(lower, upper, true, true).toArray();
}

async function assertExpenseLinks(cropId: string, categoryId: string, previous: Expense | null) {
  const [crop, category] = await Promise.all([db.crops.get(cropId), db.categories.get(categoryId)]);
  if (!crop || (crop.archived && previous?.cropId !== cropId)) {
    throw new RepositoryError('Choose an active crop.', 'VALIDATION');
  }
  if (!category || (category.archived && previous?.categoryId !== categoryId)) {
    throw new RepositoryError('Choose an active category.', 'VALIDATION');
  }
}

async function assertIncomeCrop(cropId: string, previous: Income | null) {
  const crop = await db.crops.get(cropId);
  if (!crop || (crop.archived && previous?.cropId !== cropId)) {
    throw new RepositoryError('Choose an active crop.', 'VALIDATION');
  }
}

function validateExpenseInput(input: ExpenseInput) {
  return {
    date: assertDate(input.date),
    cropId: requireId(input.cropId, 'Choose a crop.'),
    categoryId: requireId(input.categoryId, 'Choose a category.'),
    amountPaise: assertAmount(input.amount),
    note: assertNote(input.note),
  };
}

function validateIncomeInput(input: IncomeInput) {
  return {
    date: assertDate(input.date),
    cropId: requireId(input.cropId, 'Choose a crop.'),
    amountPaise: assertAmount(input.amount),
    note: assertNote(input.note),
  };
}

function fromExpenseRecord(record: ExpenseRecord): Expense {
  return { ...record, amount: fromPaise(record.amount) };
}

function fromIncomeRecord(record: IncomeRecord): Income {
  return { ...record, amount: fromPaise(record.amount) };
}

function toExpenseRecord(expense: Expense): ExpenseRecord {
  return { ...expense, amount: toPaise(expense.amount) };
}

function toIncomeRecord(income: Income): IncomeRecord {
  return { ...income, amount: toPaise(income.amount) };
}

function assertName(name: string, kind: 'crop' | 'category'): string {
  const clean = displayName(name);
  if (!clean) throw new RepositoryError(`Enter a ${kind} name.`, 'VALIDATION');
  if (clean.length > 40) throw new RepositoryError('Use 40 characters or fewer.', 'VALIDATION');
  return clean;
}

function assertUnique(
  items: readonly { id: string; name: string }[],
  name: string,
  kind: 'crop' | 'category',
  excludeId?: string,
) {
  const duplicate = findDuplicateName(items, name, excludeId);
  if (duplicate) {
    throw new RepositoryError(`A ${kind} named "${duplicate.name}" already exists.`, 'DUPLICATE_NAME');
  }
}

function assertIcon(icon: string): string {
  const clean = icon.trim();
  if (!clean || clean.length > 8) throw new RepositoryError('Choose an icon.', 'VALIDATION');
  return clean;
}

function assertAcres(acres: number | null): number | null {
  if (acres == null) return null;
  if (!Number.isFinite(acres) || acres <= 0 || acres > 100_000) {
    throw new RepositoryError('Acres must be greater than 0.', 'VALIDATION');
  }
  const rounded = round2(acres);
  if (Math.abs(acres - rounded) > 0.001) {
    throw new RepositoryError('Acres can have at most 2 decimal places.', 'VALIDATION');
  }
  return rounded;
}

function assertDate(date: string): string {
  if (!isIsoDate(date)) throw new RepositoryError('Enter a valid date.', 'VALIDATION');
  return date;
}

function assertAmount(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new RepositoryError('Amount must be greater than 0.', 'VALIDATION');
  }
  const paise = toPaise(amount);
  if (paise <= 0 || paise > 9_999_999_900 || Math.abs(amount - fromPaise(paise)) > 0.001) {
    throw new RepositoryError('Enter an amount in rupees, up to 2 decimal places.', 'VALIDATION');
  }
  return paise;
}

function assertNote(note: string): string {
  const clean = note.trim();
  if (clean.length > 500) throw new RepositoryError('Note must be 500 characters or fewer.', 'VALIDATION');
  return clean;
}

function requireId(id: string, message: string): string {
  if (!id) throw new RepositoryError(message, 'VALIDATION');
  return id;
}

function usedMessage(kind: 'crop' | 'category', expenses: number, incomes = 0): string {
  const parts: string[] = [];
  if (expenses > 0) parts.push(`${expenses} expense${expenses === 1 ? '' : 's'}`);
  if (incomes > 0) parts.push(`${incomes} sale${incomes === 1 ? '' : 's'}`);
  return `This ${kind} is used by ${parts.join(' and ')}, so it cannot be deleted. Archive it, or merge it into another ${kind}.`;
}

function byName<T extends { name: string; archived: boolean }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'en-IN'),
  );
}

function nextColor(crops: readonly Crop[]): string {
  const used = new Set(crops.map((crop) => crop.color));
  return CROP_COLORS.find((color) => !used.has(color)) ?? CROP_COLORS[crops.length % CROP_COLORS.length];
}

function nextIcon(categories: readonly Category[]): string {
  const used = new Set(categories.map((category) => category.icon));
  return (
    CATEGORY_ICONS.find((icon) => !used.has(icon)) ?? CATEGORY_ICONS[categories.length % CATEGORY_ICONS.length]
  );
}

async function requireCrop(id: string): Promise<Crop> {
  const crop = await db.crops.get(id);
  if (!crop) throw new RepositoryError('Crop not found.', 'NOT_FOUND');
  return crop;
}

async function requireCategory(id: string): Promise<Category> {
  const category = await db.categories.get(id);
  if (!category) throw new RepositoryError('Category not found.', 'NOT_FOUND');
  return category;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw asRepositoryError(error);
  }
}

function asRepositoryError(error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;
  if (isRecord(error) && error.inner instanceof RepositoryError) return error.inner;
  if (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  ) {
    return new RepositoryError('This phone is out of storage space for the ledger.', 'STORAGE');
  }
  console.error(error);
  return new RepositoryError(
    'Could not read or write the ledger on this phone. Check that storage is allowed for this site.',
    'STORAGE',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> & { inner?: unknown } {
  return typeof value === 'object' && value !== null;
}
