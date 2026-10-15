import { useState, type FormEvent } from 'react';
import { errorMessage, repository } from '../data/repository';
import { useCategories } from '../hooks/useCategories';
import { useCrops } from '../hooks/useCrops';
import type { Category, Crop, Expense } from '../types';
import { describedBy } from '../utils/filters';
import { parseAmount, todayISO } from '../utils/format';
import { Field } from './Field';

type ExpenseFormProps = {
  expense?: Expense | null;
  onSaved: () => void;
  onCancel?: () => void;
};

export function ExpenseForm({ expense = null, onSaved, onCancel }: ExpenseFormProps) {
  const crops = useCrops();
  const categories = useCategories();
  if (!crops || !categories) return <p className="text-[var(--muted)]">Opening your ledger…</p>;
  return (
    <ExpenseFields
      crops={crops}
      categories={categories}
      expense={expense}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}

function ExpenseFields({
  crops,
  categories,
  expense,
  onSaved,
  onCancel,
}: ExpenseFormProps & { crops: Crop[]; categories: Category[]; expense: Expense | null }) {
  const cropChoices = crops.filter((crop) => !crop.archived || crop.id === expense?.cropId);
  const categoryChoices = categories.filter(
    (category) => !category.archived || category.id === expense?.categoryId,
  );
  const [date, setDate] = useState(expense?.date ?? todayISO());
  const [cropId, setCropId] = useState(expense?.cropId ?? cropChoices[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? categoryChoices[0]?.id ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [errors, setErrors] = useState<Partial<Record<'date' | 'cropId' | 'categoryId' | 'amount' | 'form', string>>>({});
  const [saving, setSaving] = useState(false);
  const blocked = cropChoices.length === 0 || categoryChoices.length === 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    const next: typeof errors = {};
    if (!date) next.date = 'Enter a date.';
    if (!cropId) next.cropId = 'Choose a crop.';
    if (!categoryId) next.categoryId = 'Choose a category.';
    if (!parsed.ok) next.amount = parsed.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.ok) return;

    setSaving(true);
    try {
      const input = { date, cropId, categoryId, amount: parsed.value, note };
      if (expense) await repository.updateExpense(expense.id, input);
      else await repository.addExpense(input);
      onSaved();
    } catch (error) {
      setErrors({ form: errorMessage(error) });
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl">{expense ? 'Edit expense' : 'Add expense'}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Date, crop, category, and amount are required.</p>
      </div>
      {cropChoices.length === 0 ? (
        <p className="error" role="alert">
          Add or restore a crop in Manage before recording an expense.
        </p>
      ) : null}
      {categoryChoices.length === 0 ? (
        <p className="error" role="alert">
          Add or restore a category in Manage before recording an expense.
        </p>
      ) : null}
      {errors.form ? (
        <p className="error" role="alert">
          {errors.form}
        </p>
      ) : null}
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <Field id="expense-date" label="Date" error={errors.date}>
          <input
            id="expense-date"
            className="field"
            type="date"
            value={date}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={describedBy('expense-date', errors.date)}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field id="expense-crop" label="Crop" error={errors.cropId}>
          <select
            id="expense-crop"
            className="field"
            value={cropId}
            aria-invalid={Boolean(errors.cropId)}
            aria-describedby={describedBy('expense-crop', errors.cropId)}
            onChange={(event) => setCropId(event.target.value)}
          >
            {cropChoices.length === 0 ? <option value="">No active crops</option> : null}
            {cropChoices.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name}
                {crop.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="expense-category" label="Category" error={errors.categoryId}>
          <select
            id="expense-category"
            className="field"
            value={categoryId}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={describedBy('expense-category', errors.categoryId)}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categoryChoices.length === 0 ? <option value="">No active categories</option> : null}
            {categoryChoices.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
                {category.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="expense-amount" label="Amount" error={errors.amount}>
          <input
            id="expense-amount"
            className="field tabular-nums"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0.00"
            value={amount}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={describedBy('expense-amount', errors.amount)}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field id="expense-note" label="Note" hint="(optional)">
          <textarea
            id="expense-note"
            className="field"
            maxLength={500}
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-2">
          <button className="btn btn-primary btn-block" type="submit" disabled={saving || blocked}>
            {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </button>
          {onCancel ? (
            <button className="btn btn-ghost btn-block" type="button" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
