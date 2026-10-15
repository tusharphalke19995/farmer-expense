import { useState } from 'react';
import { sumRupees } from '../data/money';
import { errorMessage, repository } from '../data/repository';
import { useCategories } from '../hooks/useCategories';
import { useCrops } from '../hooks/useCrops';
import { useExpenses } from '../hooks/useExpenses';
import type { Expense } from '../types';
import { downloadText } from '../utils/files';
import { formatDate, formatINR, todayISO } from '../utils/format';
import { initialFilter, type FilterValue } from '../utils/filters';
import { FilterBar } from './FilterBar';
import { Modal } from './Modal';

const ALL_EXPENSES = { cropId: '', categoryId: '', from: '', to: '' };

type ExpenseListProps = {
  onEdit: (expense: Expense) => void;
};

export function ExpenseList({ onEdit }: ExpenseListProps) {
  const crops = useCrops();
  const categories = useCategories();
  const [filter, setFilter] = useState<FilterValue>(() => initialFilter('all'));
  const rows = useExpenses(filter);
  const allRows = useExpenses(ALL_EXPENSES);
  const [pending, setPending] = useState<Expense | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!crops || !categories || !rows || !allRows) {
    return <p className="text-[var(--muted)]">Opening your ledger…</p>;
  }

  const total = sumRupees(rows.map((expense) => expense.amount));
  const cropName = (id: string) => crops.find((crop) => crop.id === id)?.name ?? 'Unknown crop';
  const categoryOf = (id: string) => categories.find((category) => category.id === id);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    setError('');
    try {
      await repository.deleteExpense(pending.id);
      setPending(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    setError('');
    try {
      const csv = await repository.exportExpensesCsv(filter);
      downloadText(`farm-ledger-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl">Expenses</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Newest first. The total matches the filters below.</p>
      </div>
      <FilterBar crops={crops} categories={categories} value={filter} onChange={setFilter} />
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--muted)]">
            {rows.length} expense{rows.length === 1 ? '' : 's'}
          </p>
          <p className="font-serif text-3xl tabular-nums">{formatINR(total)}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      {error && !pending ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="card">
          <p className="font-semibold">
            {allRows.length === 0 ? 'No expenses yet.' : 'No expenses match these filters.'}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {allRows.length === 0
              ? 'Add seed, diesel, labour, or any other cost when you spend it.'
              : 'Clear a crop, category, or date to see more.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((expense) => {
            const category = categoryOf(expense.categoryId);
            return (
              <li key={expense.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--muted)]">{formatDate(expense.date)}</p>
                    <h3 className="text-lg font-semibold">{cropName(expense.cropId)}</h3>
                    <p>
                      {category?.icon ?? '•'} {category?.name ?? 'Unknown category'}
                    </p>
                    {expense.note ? <p className="mt-1 text-sm text-[var(--muted)]">{expense.note}</p> : null}
                  </div>
                  <p className="font-semibold tabular-nums">{formatINR(expense.amount)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => onEdit(expense)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => setPending(expense)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pending ? (
        <Modal
          title="Delete expense?"
          onClose={() => {
            if (deleting) return;
            setPending(null);
            setError('');
          }}
        >
          <p>
            Delete the {formatINR(pending.amount)} {categoryOf(pending.categoryId)?.name ?? 'expense'} for{' '}
            {cropName(pending.cropId)} on {formatDate(pending.date)}? This cannot be undone.
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={deleting}
              onClick={() => {
                setPending(null);
                setError('');
              }}
            >
              Keep
            </button>
            <button type="button" className="btn btn-danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
