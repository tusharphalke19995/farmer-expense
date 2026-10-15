/** A crop the farmer grows. `acres` is the current sown area, not a per-season history. */
export type Crop = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  acres: number | null;
  createdAt: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  archived: boolean;
  createdAt: string;
};

/** Expense as the UI sees it. `amount` is rupees. IndexedDB stores paise. */
export type Expense = {
  id: string;
  date: string;
  cropId: string;
  categoryId: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

/** Sale / income for a crop. `amount` is rupees. IndexedDB stores paise. */
export type Income = {
  id: string;
  date: string;
  cropId: string;
  amount: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  date: string;
  cropId: string;
  categoryId: string;
  amount: number;
  note: string;
};

export type IncomeInput = {
  date: string;
  cropId: string;
  amount: number;
  note: string;
};

/** Inclusive ISO dates (yyyy-mm-dd). Empty string means that side is open. */
export type DateRange = {
  from: string;
  to: string;
};

export type ExpenseFilter = DateRange & {
  cropId: string;
  categoryId: string;
};

export type MetaRow = {
  key: string;
  value: string;
};

export type CategoryAmount = {
  categoryId: string;
  amount: number;
  percent: number;
};

export type CropSummary = {
  cropId: string;
  spent: number;
  income: number;
  profit: number;
  acres: number | null;
  costPerAcre: number | null;
  categories: CategoryAmount[];
};

export type DashboardSummary = {
  spent: number;
  income: number;
  profit: number;
  crops: CropSummary[];
  categories: CategoryAmount[];
};

export type UsageCounts = {
  expensesByCrop: Record<string, number>;
  expensesByCategory: Record<string, number>;
  incomesByCrop: Record<string, number>;
};
