import { fromPaise, sumRupees, toPaise } from './money';
import type { CategoryAmount, CropSummary, DashboardSummary, DateRange } from '../types';

export type ExpenseLike = {
  cropId: string;
  categoryId: string;
  amount: number;
  date: string;
};

export type IncomeLike = {
  cropId: string;
  amount: number;
  date: string;
};

export type CropLike = {
  id: string;
  archived: boolean;
  acres: number | null;
};

export function inDateRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export function profit(income: number, spent: number): number {
  return fromPaise(toPaise(income) - toPaise(spent));
}

/** Nearest paise. Null when acres are missing or not positive. */
export function costPerAcre(spent: number, acres: number | null): number | null {
  if (acres == null || acres <= 0) return null;
  return fromPaise(Math.round(toPaise(spent) / acres));
}

export function percentOf(amount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((amount / total) * 1000) / 10;
}

export function totalsByCrop(expenses: readonly ExpenseLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) addAmount(totals, expense.cropId, expense.amount);
  return totals;
}

export function totalsByCategory(expenses: readonly ExpenseLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const expense of expenses) addAmount(totals, expense.categoryId, expense.amount);
  return totals;
}

/** Spent rupees for each crop, split by category. */
export function splitByCropAndCategory(
  expenses: readonly ExpenseLike[],
): Map<string, Map<string, number>> {
  const totals = new Map<string, Map<string, number>>();
  for (const expense of expenses) {
    let byCategory = totals.get(expense.cropId);
    if (!byCategory) {
      byCategory = new Map();
      totals.set(expense.cropId, byCategory);
    }
    addAmount(byCategory, expense.categoryId, expense.amount);
  }
  return totals;
}

export function withPercents(
  parts: readonly { categoryId: string; amount: number }[],
): CategoryAmount[] {
  const total = sumRupees(parts.map((part) => part.amount));
  return [...parts]
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId))
    .map((part) => ({
      categoryId: part.categoryId,
      amount: part.amount,
      percent: percentOf(part.amount, total),
    }));
}

export function buildSummary(input: {
  crops: readonly CropLike[];
  expenses: readonly ExpenseLike[];
  incomes: readonly IncomeLike[];
  range: DateRange;
}): DashboardSummary {
  const expenses = input.expenses.filter((expense) => inDateRange(expense.date, input.range));
  const incomes = input.incomes.filter((sale) => inDateRange(sale.date, input.range));
  const spentByCrop = totalsByCrop(expenses);
  const spentByCategory = totalsByCategory(expenses);
  const spentByCropCategory = splitByCropAndCategory(expenses);
  const incomeByCrop = new Map<string, number>();
  for (const sale of incomes) addAmount(incomeByCrop, sale.cropId, sale.amount);

  const cropIds = new Set<string>();
  for (const crop of input.crops) {
    if (!crop.archived) cropIds.add(crop.id);
  }
  for (const cropId of spentByCrop.keys()) cropIds.add(cropId);
  for (const cropId of incomeByCrop.keys()) cropIds.add(cropId);

  const crops: CropSummary[] = [...cropIds]
    .map((cropId) => {
      const crop = input.crops.find((item) => item.id === cropId);
      const spent = spentByCrop.get(cropId) ?? 0;
      const income = incomeByCrop.get(cropId) ?? 0;
      const acres = crop?.acres ?? null;
      const byCategory = spentByCropCategory.get(cropId) ?? new Map<string, number>();
      return {
        cropId,
        spent,
        income,
        profit: profit(income, spent),
        acres,
        costPerAcre: costPerAcre(spent, acres),
        categories: withPercents(
          [...byCategory.entries()].map(([categoryId, amount]) => ({ categoryId, amount })),
        ),
      };
    })
    .sort((a, b) => b.spent - a.spent || a.cropId.localeCompare(b.cropId));

  return {
    spent: sumRupees(expenses.map((expense) => expense.amount)),
    income: sumRupees(incomes.map((sale) => sale.amount)),
    profit: profit(
      sumRupees(incomes.map((sale) => sale.amount)),
      sumRupees(expenses.map((expense) => expense.amount)),
    ),
    crops,
    categories: withPercents(
      [...spentByCategory.entries()].map(([categoryId, amount]) => ({ categoryId, amount })),
    ),
  };
}

function addAmount(totals: Map<string, number>, key: string, amount: number) {
  totals.set(key, fromPaise(toPaise(totals.get(key) ?? 0) + toPaise(amount)));
}
