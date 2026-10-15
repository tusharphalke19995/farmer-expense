import { APP_ID, SCHEMA_VERSION } from '../constants';
import { displayName, findDuplicateName, normalizeName } from './names';
import { fromPaise, toPaise } from './money';
import type { Category, Crop, Expense, Income } from '../types';

export type BackupFile = {
  app: typeof APP_ID;
  schemaVersion: number;
  exportedAt: string;
  crops: Crop[];
  categories: Category[];
  expenses: Expense[];
  incomes: Income[];
};

export type BackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

const MAX_NOTE = 500;
const MAX_NAME = 40;
const MAX_AMOUNT = 99_999_999;

export function parseBackup(data: unknown): BackupResult {
  const errors: string[] = [];
  if (!isRecord(data)) {
    return { ok: false, error: 'The file is not a Farm Ledger backup.' };
  }
  if (data.app !== APP_ID) {
    errors.push('This file is not a Farm Ledger backup.');
  }
  const version = data.schemaVersion;
  if (version !== 1 && version !== SCHEMA_VERSION) {
    errors.push('This backup is from an unsupported version.');
  }
  if (errors.length > 0) return { ok: false, error: errors.join(' ') };

  const crops = readCrops(data.crops, version === 1, errors);
  const categories = readCategories(data.categories, errors);
  const cropIds = new Set(crops.map((crop) => crop.id));
  const categoryIds = new Set(categories.map((category) => category.id));
  const expenses = readExpenses(data.expenses, cropIds, categoryIds, errors);
  const incomes = readIncomes(version === 1 ? (data.incomes ?? []) : data.incomes, cropIds, errors);

  if (errors.length > 0) {
    const extra = errors.length > 4 ? ` (+${errors.length - 4} more)` : '';
    return { ok: false, error: `${errors.slice(0, 4).join(' ')}${extra}` };
  }

  return {
    ok: true,
    backup: {
      app: APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
      crops,
      categories,
      expenses,
      incomes,
    },
  };
}

export function expensesToCsv(
  expenses: readonly Expense[],
  crops: readonly Crop[],
  categories: readonly Category[],
): string {
  const cropName = new Map(crops.map((crop) => [crop.id, crop.name]));
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const lines = ['Date,Crop,Category,Amount (INR),Note'];
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const expense of sorted) {
    lines.push(
      [
        expense.date,
        csvCell(cropName.get(expense.cropId) ?? 'Unknown'),
        csvCell(categoryName.get(expense.categoryId) ?? 'Unknown'),
        expense.amount.toFixed(2),
        csvCell(expense.note),
      ].join(','),
    );
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

function readCrops(value: unknown, allowMissingAcres: boolean, errors: string[]): Crop[] {
  if (!Array.isArray(value)) {
    errors.push('Crops must be a list.');
    return [];
  }
  const crops: Crop[] = [];
  value.forEach((item, index) => {
    const label = `Crop ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${label} is not an object.`);
      return;
    }
    const name = readName(item.name, label, errors);
    const id = readId(item.id, label, errors);
    const acres = readAcres(item.acres, label, allowMissingAcres, errors);
    if (!name || !id || acres === undefined) return;
    if (typeof item.color !== 'string' || item.color.trim() === '') {
      errors.push(`${label} is missing a color.`);
      return;
    }
    if (typeof item.archived !== 'boolean') {
      errors.push(`${label} has an invalid archived flag.`);
      return;
    }
    const createdAt = readTimestamp(item.createdAt, label, errors);
    if (!createdAt) return;
    crops.push({
      id,
      name,
      color: item.color,
      archived: item.archived,
      acres,
      createdAt,
    });
  });
  rejectDuplicateIds(crops, 'crop', errors);
  rejectDuplicateNames(crops, 'crop', errors);
  return crops;
}

function readCategories(value: unknown, errors: string[]): Category[] {
  if (!Array.isArray(value)) {
    errors.push('Categories must be a list.');
    return [];
  }
  const categories: Category[] = [];
  value.forEach((item, index) => {
    const label = `Category ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${label} is not an object.`);
      return;
    }
    const name = readName(item.name, label, errors);
    const id = readId(item.id, label, errors);
    if (!name || !id) return;
    if (typeof item.icon !== 'string' || item.icon.trim() === '' || item.icon.length > 8) {
      errors.push(`${label} is missing an icon.`);
      return;
    }
    if (typeof item.archived !== 'boolean') {
      errors.push(`${label} has an invalid archived flag.`);
      return;
    }
    const createdAt = readTimestamp(item.createdAt, label, errors);
    if (!createdAt) return;
    categories.push({
      id,
      name,
      icon: item.icon,
      archived: item.archived,
      createdAt,
    });
  });
  rejectDuplicateIds(categories, 'category', errors);
  rejectDuplicateNames(categories, 'category', errors);
  return categories;
}

function readExpenses(
  value: unknown,
  cropIds: Set<string>,
  categoryIds: Set<string>,
  errors: string[],
): Expense[] {
  if (!Array.isArray(value)) {
    errors.push('Expenses must be a list.');
    return [];
  }
  const expenses: Expense[] = [];
  value.forEach((item, index) => {
    const label = `Expense ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${label} is not an object.`);
      return;
    }
    const id = readId(item.id, label, errors);
    const date = readDate(item.date, label, errors);
    const amount = readMoney(item.amount, label, errors);
    const note = readNote(item.note, label, errors);
    const createdAt = readTimestamp(item.createdAt, label, errors);
    const updatedAt = readTimestamp(item.updatedAt, label, errors);
    if (!id || !date || amount == null || note == null || !createdAt || !updatedAt) return;
    if (typeof item.cropId !== 'string' || !cropIds.has(item.cropId)) {
      errors.push(`${label} refers to a crop that is not in the file.`);
      return;
    }
    if (typeof item.categoryId !== 'string' || !categoryIds.has(item.categoryId)) {
      errors.push(`${label} refers to a category that is not in the file.`);
      return;
    }
    expenses.push({
      id,
      date,
      cropId: item.cropId,
      categoryId: item.categoryId,
      amount,
      note,
      createdAt,
      updatedAt,
    });
  });
  rejectDuplicateIds(expenses, 'expense', errors);
  return expenses;
}

function readIncomes(value: unknown, cropIds: Set<string>, errors: string[]): Income[] {
  if (!Array.isArray(value)) {
    errors.push('Sales must be a list.');
    return [];
  }
  const incomes: Income[] = [];
  value.forEach((item, index) => {
    const label = `Sale ${index + 1}`;
    if (!isRecord(item)) {
      errors.push(`${label} is not an object.`);
      return;
    }
    const id = readId(item.id, label, errors);
    const date = readDate(item.date, label, errors);
    const amount = readMoney(item.amount, label, errors);
    const note = readNote(item.note, label, errors);
    const createdAt = readTimestamp(item.createdAt, label, errors);
    const updatedAt = readTimestamp(item.updatedAt, label, errors);
    if (!id || !date || amount == null || note == null || !createdAt || !updatedAt) return;
    if (typeof item.cropId !== 'string' || !cropIds.has(item.cropId)) {
      errors.push(`${label} refers to a crop that is not in the file.`);
      return;
    }
    incomes.push({
      id,
      date,
      cropId: item.cropId,
      amount,
      note,
      createdAt,
      updatedAt,
    });
  });
  rejectDuplicateIds(incomes, 'sale', errors);
  return incomes;
}

function readName(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || normalizeName(value) === '') {
    errors.push(`${label} needs a name.`);
    return null;
  }
  const name = displayName(value);
  if (name.length > MAX_NAME) {
    errors.push(`${label} name must be ${MAX_NAME} characters or fewer.`);
    return null;
  }
  return name;
}

function readId(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 80) {
    errors.push(`${label} has an invalid id.`);
    return null;
  }
  return value;
}

function readDate(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || !isIsoDate(value)) {
    errors.push(`${label} has an invalid date.`);
    return null;
  }
  return value;
}

function readMoney(value: unknown, label: string, errors: string[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
    errors.push(`${label} amount must be greater than 0.`);
    return null;
  }
  const rupees = fromPaise(toPaise(value));
  if (Math.abs(value - rupees) > 0.001) {
    errors.push(`${label} amount must have at most 2 decimal places.`);
    return null;
  }
  return rupees;
}

function readNote(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string') {
    errors.push(`${label} note must be text.`);
    return null;
  }
  const note = value.trim();
  if (note.length > MAX_NOTE) {
    errors.push(`${label} note is too long.`);
    return null;
  }
  return note;
}

function readTimestamp(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} is missing a timestamp.`);
    return null;
  }
  return value;
}

function readAcres(
  value: unknown,
  label: string,
  allowMissing: boolean,
  errors: string[],
): number | null | undefined {
  if (value == null) {
    if (allowMissing || value === null) return null;
    errors.push(`${label} is missing acres.`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100_000) {
    errors.push(`${label} has an invalid acres value.`);
    return undefined;
  }
  const acres = fromPaise(toPaise(value));
  if (Math.abs(value - acres) > 0.001) {
    errors.push(`${label} acres must have at most 2 decimal places.`);
    return undefined;
  }
  return acres;
}

function rejectDuplicateIds(items: readonly { id: string }[], kind: string, errors: string[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`Duplicate ${kind} id ${item.id}.`);
    seen.add(item.id);
  }
}

function rejectDuplicateNames(items: readonly { id: string; name: string }[], kind: string, errors: string[]) {
  for (const item of items) {
    const duplicate = findDuplicateName(items, item.name, item.id);
    if (duplicate) {
      errors.push(`Duplicate ${kind} name "${item.name}".`);
      return;
    }
  }
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
