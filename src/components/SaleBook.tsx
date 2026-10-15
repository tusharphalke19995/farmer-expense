import { useState, type FormEvent } from 'react';
import { errorMessage, repository } from '../data/repository';
import { useIncomes } from '../hooks/useIncomes';
import type { Crop, DateRange, Income } from '../types';
import { describedBy } from '../utils/filters';
import { formatDate, formatINR, parseAmount, todayISO } from '../utils/format';
import { Field } from './Field';
import { Modal } from './Modal';

type SaleBookProps = {
  crops: Crop[];
  range: DateRange;
};

export function SaleBook({ crops, range }: SaleBookProps) {
  const sales = useIncomes(range);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [pending, setPending] = useState<Income | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!sales) return <p className="text-[var(--muted)]">Opening sales…</p>;

  const cropName = (id: string) => crops.find((crop) => crop.id === id)?.name ?? 'Unknown crop';

  function startNew() {
    setEditing(null);
    setOpen(true);
  }

  function startEdit(sale: Income) {
    setEditing(sale);
    setOpen(true);
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    setError('');
    try {
      await repository.deleteIncome(pending.id);
      setPending(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Sales</h2>
        <button type="button" className="btn btn-primary" onClick={startNew}>
          Record a sale
        </button>
      </div>
      {open ? (
        <SaleForm
          key={editing?.id ?? 'new-sale'}
          crops={crops}
          sale={editing}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      ) : null}
      {sales.length === 0 ? (
        <div className="card">
          <p className="font-semibold">No sales in this range.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Record what a crop sold for to see profit.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sales.map((sale) => (
            <li key={sale.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-[var(--muted)]">{formatDate(sale.date)}</p>
                  <h3 className="text-lg font-semibold">{cropName(sale.cropId)}</h3>
                  {sale.note ? <p className="text-sm text-[var(--muted)]">{sale.note}</p> : null}
                </div>
                <p className="font-semibold tabular-nums text-[var(--leaf)]">{formatINR(sale.amount)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => startEdit(sale)}>
                  Edit
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setPending(sale)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <Modal
          title="Delete sale?"
          onClose={() => {
            if (deleting) return;
            setPending(null);
            setError('');
          }}
        >
          <p>
            Delete the {formatINR(pending.amount)} sale for {cropName(pending.cropId)} on {formatDate(pending.date)}?
            This cannot be undone.
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setPending(null)}>
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

function SaleForm({
  crops,
  sale,
  onClose,
  onSaved,
}: {
  crops: Crop[];
  sale: Income | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const choices = crops.filter((crop) => !crop.archived || crop.id === sale?.cropId);
  const [date, setDate] = useState(sale?.date ?? todayISO());
  const [cropId, setCropId] = useState(sale?.cropId ?? choices[0]?.id ?? '');
  const [amount, setAmount] = useState(sale ? String(sale.amount) : '');
  const [note, setNote] = useState(sale?.note ?? '');
  const [errors, setErrors] = useState<Partial<Record<'date' | 'cropId' | 'amount' | 'form', string>>>({});
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    const next: typeof errors = {};
    if (!date) next.date = 'Enter a date.';
    if (!cropId) next.cropId = 'Choose a crop.';
    if (!parsed.ok) next.amount = parsed.error;
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.ok) return;
    setSaving(true);
    try {
      const input = { date, cropId, amount: parsed.value, note };
      if (sale) await repository.updateIncome(sale.id, input);
      else await repository.addIncome(input);
      onSaved();
    } catch (caught) {
      setErrors({ form: errorMessage(caught) });
      setSaving(false);
    }
  }

  return (
    <form className="card space-y-3" noValidate onSubmit={onSubmit}>
      <h3 className="text-lg font-semibold">{sale ? 'Edit sale' : 'New sale'}</h3>
      {choices.length === 0 ? (
        <p className="error" role="alert">
          Add or restore a crop in Manage before recording a sale.
        </p>
      ) : null}
      {errors.form ? (
        <p className="error" role="alert">
          {errors.form}
        </p>
      ) : null}
      <Field id="sale-date" label="Date" error={errors.date}>
        <input
          id="sale-date"
          className="field"
          type="date"
          value={date}
          aria-invalid={Boolean(errors.date)}
          aria-describedby={describedBy('sale-date', errors.date)}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>
      <Field id="sale-crop" label="Crop" error={errors.cropId}>
        <select
          id="sale-crop"
          className="field"
          value={cropId}
          aria-invalid={Boolean(errors.cropId)}
          aria-describedby={describedBy('sale-crop', errors.cropId)}
          onChange={(event) => setCropId(event.target.value)}
        >
          {choices.length === 0 ? <option value="">No active crops</option> : null}
          {choices.map((crop) => (
            <option key={crop.id} value={crop.id}>
              {crop.name}
              {crop.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <Field id="sale-amount" label="Amount" error={errors.amount}>
        <input
          id="sale-amount"
          className="field tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          aria-invalid={Boolean(errors.amount)}
          aria-describedby={describedBy('sale-amount', errors.amount)}
          onChange={(event) => setAmount(event.target.value)}
        />
      </Field>
      <Field id="sale-note" label="Note" hint="(optional)">
        <input
          id="sale-note"
          className="field"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" type="submit" disabled={saving || choices.length === 0}>
          {saving ? 'Saving…' : sale ? 'Save' : 'Add sale'}
        </button>
      </div>
    </form>
  );
}
