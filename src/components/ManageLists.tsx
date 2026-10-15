import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CATEGORY_ICONS } from '../constants';
import type { BackupFile } from '../data/backup';
import { parseBackup } from '../data/backup';
import { errorMessage, repository } from '../data/repository';
import { useCategories } from '../hooks/useCategories';
import { useCrops } from '../hooks/useCrops';
import { useUsage } from '../hooks/useUsage';
import type { Category, Crop } from '../types';
import { downloadText, readJsonFile } from '../utils/files';
import { formatAcres, parseAcres, todayISO } from '../utils/format';
import { Modal } from './Modal';

type Notice = { tone: 'ok' | 'err'; text: string };
type RenameState = { kind: 'crop' | 'category'; id: string; value: string; error: string };
type PendingDelete = { kind: 'crop'; id: string } | { kind: 'category'; id: string };

export function ManageLists() {
  const crops = useCrops();
  const categories = useCategories();
  const usage = useUsage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropName, setCropName] = useState('');
  const [cropError, setCropError] = useState('');
  const [addingCrop, setAddingCrop] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('🌱');
  const [categoryError, setCategoryError] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [rename, setRename] = useState<RenameState | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [importing, setImporting] = useState<BackupFile | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!crops || !categories || !usage) {
    return <p className="text-[var(--muted)]">Opening your ledger…</p>;
  }

  const pendingCrop = pending?.kind === 'crop' ? crops.find((crop) => crop.id === pending.id) : undefined;
  const pendingCategory =
    pending?.kind === 'category' ? categories.find((category) => category.id === pending.id) : undefined;

  async function onAddCrop(event: FormEvent) {
    event.preventDefault();
    if (addingCrop) return;
    setCropError('');
    setAddingCrop(true);
    try {
      await repository.addCrop(cropName);
      setCropName('');
      setNotice({ tone: 'ok', text: 'Crop added.' });
    } catch (error) {
      setCropError(errorMessage(error));
    } finally {
      setAddingCrop(false);
    }
  }

  async function onAddCategory(event: FormEvent) {
    event.preventDefault();
    if (addingCategory) return;
    setCategoryError('');
    setAddingCategory(true);
    try {
      await repository.addCategory(categoryName, categoryIcon);
      setCategoryName('');
      setNotice({ tone: 'ok', text: 'Category added.' });
    } catch (error) {
      setCategoryError(errorMessage(error));
    } finally {
      setAddingCategory(false);
    }
  }

  async function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!rename) return;
    try {
      if (rename.kind === 'crop') await repository.renameCrop(rename.id, rename.value);
      else await repository.renameCategory(rename.id, rename.value);
      setRename(null);
      setNotice({ tone: 'ok', text: 'Name updated.' });
    } catch (error) {
      setRename({ ...rename, error: errorMessage(error) });
    }
  }

  async function toggleCrop(crop: Crop) {
    setBusyId(crop.id);
    try {
      await repository.setCropArchived(crop.id, !crop.archived);
      setNotice({ tone: 'ok', text: crop.archived ? `${crop.name} restored.` : `${crop.name} archived.` });
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCategory(category: Category) {
    setBusyId(category.id);
    try {
      await repository.setCategoryArchived(category.id, !category.archived);
      setNotice({
        tone: 'ok',
        text: category.archived ? `${category.name} restored.` : `${category.name} archived.`,
      });
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  }

  async function onExportJson() {
    try {
      const backup = await repository.exportBackup();
      downloadText(`farm-ledger-${todayISO()}.json`, JSON.stringify(backup, null, 2), 'application/json');
      setNotice({ tone: 'ok', text: 'JSON backup downloaded.' });
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
    }
  }

  async function onExportCsv() {
    try {
      const csv = await repository.exportExpensesCsv({ cropId: '', categoryId: '', from: '', to: '' });
      downloadText(`farm-ledger-expenses-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
      setNotice({ tone: 'ok', text: 'CSV downloaded.' });
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = await readJsonFile(file);
      const parsed = parseBackup(data);
      if (!parsed.ok) {
        setNotice({ tone: 'err', text: parsed.error });
        return;
      }
      setImporting(parsed.backup);
      setNotice(null);
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
    }
  }

  async function confirmImport() {
    if (!importing || importBusy) return;
    setImportBusy(true);
    try {
      const counts = await repository.importBackup(importing);
      setImporting(null);
      setNotice({
        tone: 'ok',
        text: `Imported ${counts.crops} crops, ${counts.categories} categories, ${counts.expenses} expenses, and ${counts.incomes} sales.`,
      });
    } catch (error) {
      setNotice({ tone: 'err', text: errorMessage(error) });
      setImporting(null);
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-3xl">Manage</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Archived crops and categories stay on old records, but they are hidden when you add an expense. A name
          already in the list, including an archived one, cannot be used again. Records in use can be archived or
          merged, not deleted.
        </p>
      </div>
      {notice ? (
        <p className={notice.tone === 'err' ? 'error' : 'text-sm font-semibold text-[var(--leaf)]'} role="status">
          {notice.text}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Crops</h3>
        <form className="card space-y-2" onSubmit={onAddCrop}>
          <label className="label" htmlFor="new-crop">
            New crop
          </label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <input
                id="new-crop"
                className="field"
                value={cropName}
                maxLength={40}
                autoCapitalize="words"
                onChange={(event) => setCropName(event.target.value)}
              />
            </div>
            <button className="btn btn-primary shrink-0" type="submit" disabled={addingCrop}>
              {addingCrop ? 'Adding…' : 'Add'}
            </button>
          </div>
          {cropError ? (
            <p className="error" role="alert">
              {cropError}
            </p>
          ) : null}
        </form>
        <ul className="space-y-3">
          {crops.map((crop) => (
            <li key={crop.id} className={`card space-y-3 ${crop.archived ? 'opacity-75' : ''}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1 h-8 w-3 shrink-0 rounded-full" style={{ background: crop.color }} />
                <div className="min-w-0 flex-1">
                  {rename?.kind === 'crop' && rename.id === crop.id ? (
                    <form onSubmit={saveRename}>
                      <label className="sr-only" htmlFor={`rename-${crop.id}`}>
                        New name for {crop.name}
                      </label>
                      <input
                        id={`rename-${crop.id}`}
                        className="field"
                        value={rename.value}
                        maxLength={40}
                        autoFocus
                        onChange={(event) => setRename({ ...rename, value: event.target.value, error: '' })}
                      />
                      {rename.error ? (
                        <p className="error" role="alert">
                          {rename.error}
                        </p>
                      ) : null}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button className="btn btn-primary" type="submit">
                          Save
                        </button>
                        <button className="btn btn-ghost" type="button" onClick={() => setRename(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold">{crop.name}</h4>
                      {crop.archived ? <span className="badge">Archived</span> : null}
                    </div>
                  )}
                  <p className="text-sm text-[var(--muted)]">
                    {usageLabel(usage.expensesByCrop[crop.id] ?? 0, usage.incomesByCrop[crop.id] ?? 0)}
                  </p>
                </div>
              </div>
              <AcresField crop={crop} onError={(text) => setNotice({ tone: 'err', text })} />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn btn-ghost col-span-2"
                  onClick={() => setRename({ kind: 'crop', id: crop.id, value: crop.name, error: '' })}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === crop.id}
                  onClick={() => toggleCrop(crop)}
                >
                  {crop.archived ? 'Restore' : 'Archive'}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => setPending({ kind: 'crop', id: crop.id })}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="font-serif text-2xl">Categories</h3>
        <form className="card space-y-3" onSubmit={onAddCategory}>
          <label className="label" htmlFor="new-category">
            New category
          </label>
          <input
            id="new-category"
            className="field"
            value={categoryName}
            maxLength={40}
            autoCapitalize="words"
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Category icon">
            {CATEGORY_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className="icon-btn"
                aria-pressed={categoryIcon === icon}
                onClick={() => setCategoryIcon(icon)}
              >
                {icon}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={addingCategory}>
            {addingCategory ? 'Adding…' : 'Add category'}
          </button>
          {categoryError ? (
            <p className="error" role="alert">
              {categoryError}
            </p>
          ) : null}
        </form>
        <ul className="space-y-3">
          {categories.map((category) => (
            <li key={category.id} className={`card space-y-3 ${category.archived ? 'opacity-75' : ''}`}>
              {rename?.kind === 'category' && rename.id === category.id ? (
                <form onSubmit={saveRename}>
                  <label className="sr-only" htmlFor={`rename-${category.id}`}>
                    New name for {category.name}
                  </label>
                  <input
                    id={`rename-${category.id}`}
                    className="field"
                    value={rename.value}
                    maxLength={40}
                    autoFocus
                    onChange={(event) => setRename({ ...rename, value: event.target.value, error: '' })}
                  />
                  {rename.error ? (
                    <p className="error" role="alert">
                      {rename.error}
                    </p>
                  ) : null}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button className="btn btn-primary" type="submit">
                      Save
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => setRename(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">
                    {category.icon}
                  </span>
                  <h4 className="text-lg font-semibold">{category.name}</h4>
                  {category.archived ? <span className="badge">Archived</span> : null}
                </div>
              )}
              <p className="text-sm text-[var(--muted)]">{usageLabel(usage.expensesByCategory[category.id] ?? 0)}</p>
              <IconChoices
                selected={category.icon}
                onSelect={async (icon) => {
                  try {
                    await repository.setCategoryIcon(category.id, icon);
                  } catch (error) {
                    setNotice({ tone: 'err', text: errorMessage(error) });
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn btn-ghost col-span-2"
                  onClick={() => setRename({ kind: 'category', id: category.id, value: category.name, error: '' })}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === category.id}
                  onClick={() => toggleCategory(category)}
                >
                  {category.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setPending({ kind: 'category', id: category.id })}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3">
        <h3 className="font-serif text-2xl">Backup</h3>
        <p className="text-sm text-[var(--muted)]">
          JSON includes crops, categories, expenses, and sales. CSV is the expense list in rupees. Import checks the
          file first, then asks before replacing what is on this phone.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={onExportJson}>
          Export JSON
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onExportCsv}>
          Export CSV
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input ref={fileRef} className="sr-only" type="file" accept="application/json,.json" onChange={onFile} />
      </section>

      {pendingCrop ? (
        <RemoveCropDialog
          crop={pendingCrop}
          crops={crops}
          expenses={usage.expensesByCrop[pendingCrop.id] ?? 0}
          sales={usage.incomesByCrop[pendingCrop.id] ?? 0}
          onClose={() => setPending(null)}
          onNotice={(text) => setNotice({ tone: 'ok', text })}
        />
      ) : null}
      {pendingCategory ? (
        <RemoveCategoryDialog
          category={pendingCategory}
          categories={categories}
          expenses={usage.expensesByCategory[pendingCategory.id] ?? 0}
          onClose={() => setPending(null)}
          onNotice={(text) => setNotice({ tone: 'ok', text })}
        />
      ) : null}
      {importing ? (
        <Modal title="Replace this phone’s ledger?" onClose={() => setImporting(null)}>
          <p>Importing replaces every crop, category, expense, and sale stored here.</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>{importing.crops.length} crops</li>
            <li>{importing.categories.length} categories</li>
            <li>{importing.expenses.length} expenses</li>
            <li>{importing.incomes.length} sales</li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setImporting(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" disabled={importBusy} onClick={confirmImport}>
              {importBusy ? 'Replacing…' : 'Replace'}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function AcresField({ crop, onError }: { crop: Crop; onError: (text: string) => void }) {
  const [acres, setAcres] = useState(() => formatAcres(crop.acres));
  const [error, setError] = useState('');

  useEffect(() => {
    setAcres(formatAcres(crop.acres));
    setError('');
  }, [crop.acres]);

  async function save() {
    const parsed = parseAcres(acres);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    if (parsed.value === crop.acres) return;
    try {
      await repository.setCropAcres(crop.id, parsed.value);
    } catch (caught) {
      const text = errorMessage(caught);
      setError(text);
      onError(text);
    }
  }

  return (
    <div>
      <label className="label" htmlFor={`acres-${crop.id}`}>
        Acres
      </label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <input
            id={`acres-${crop.id}`}
            className="field tabular-nums"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Not set"
            value={acres}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `acres-${crop.id}-error` : undefined}
            onChange={(event) => setAcres(event.target.value)}
            onBlur={() => void save()}
          />
        </div>
        <button type="button" className="btn btn-ghost shrink-0" onClick={() => void save()}>
          Save
        </button>
      </div>
      {error ? (
        <p id={`acres-${crop.id}-error`} className="error" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-sm text-[var(--muted)]">Used for cost per acre on the dashboard.</p>
      )}
    </div>
  );
}

function IconChoices({ selected, onSelect }: { selected: string; onSelect: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(true)}>
        Change icon {selected}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose icon">
      {CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          className="icon-btn"
          aria-pressed={selected === icon}
          onClick={() => {
            onSelect(icon);
            setOpen(false);
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function RemoveCropDialog({
  crop,
  crops,
  expenses,
  sales,
  onClose,
  onNotice,
}: {
  crop: Crop;
  crops: Crop[];
  expenses: number;
  sales: number;
  onClose: () => void;
  onNotice: (text: string) => void;
}) {
  const others = crops.filter((item) => item.id !== crop.id);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const used = expenses + sales > 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Modal title={used ? `${crop.name} is in use` : `Delete ${crop.name}?`} onClose={onClose}>
      {used ? (
        <p>
          This crop is used by {usageLabel(expenses, sales)}, so it cannot be deleted. Archive it to hide it from new
          expenses, or merge its records into another crop.
        </p>
      ) : (
        <p>Delete {crop.name}? This cannot be undone.</p>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        {used ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repository.setCropArchived(crop.id, true);
                  onNotice(`${crop.name} archived.`);
                  onClose();
                })
              }
            >
              {crop.archived ? 'Keep archived' : 'Archive'}
            </button>
            {others.length > 0 ? (
              <>
                <label className="label" htmlFor="merge-crop">
                  Merge into
                </label>
                <select id="merge-crop" className="field" value={target} onChange={(event) => setTarget(event.target.value)}>
                  {others.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.archived ? ' (archived)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  disabled={busy || !target}
                  onClick={() =>
                    void run(async () => {
                      await repository.mergeCrops(crop.id, target);
                      const into = others.find((item) => item.id === target);
                      onNotice(`${crop.name} merged into ${into?.name ?? 'the other crop'}.`);
                      onClose();
                    })
                  }
                >
                  Merge and remove
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Add another crop if you want to merge this one.</p>
            )}
          </>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await repository.deleteCrop(crop.id);
                onNotice(`${crop.name} deleted.`);
                onClose();
              })
            }
          >
            Delete
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function RemoveCategoryDialog({
  category,
  categories,
  expenses,
  onClose,
  onNotice,
}: {
  category: Category;
  categories: Category[];
  expenses: number;
  onClose: () => void;
  onNotice: (text: string) => void;
}) {
  const others = categories.filter((item) => item.id !== category.id);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Modal title={expenses > 0 ? `${category.name} is in use` : `Delete ${category.name}?`} onClose={onClose}>
      {expenses > 0 ? (
        <p>
          This category is used by {expenses} expense{expenses === 1 ? '' : 's'}, so it cannot be deleted. Archive it,
          or merge it into another category.
        </p>
      ) : (
        <p>Delete {category.name}? This cannot be undone.</p>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        {expenses > 0 ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repository.setCategoryArchived(category.id, true);
                  onNotice(`${category.name} archived.`);
                  onClose();
                })
              }
            >
              {category.archived ? 'Keep archived' : 'Archive'}
            </button>
            {others.length > 0 ? (
              <>
                <label className="label" htmlFor="merge-category">
                  Merge into
                </label>
                <select
                  id="merge-category"
                  className="field"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  {others.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.icon} {item.name}
                      {item.archived ? ' (archived)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  disabled={busy || !target}
                  onClick={() =>
                    void run(async () => {
                      await repository.mergeCategories(category.id, target);
                      const into = others.find((item) => item.id === target);
                      onNotice(`${category.name} merged into ${into?.name ?? 'the other category'}.`);
                      onClose();
                    })
                  }
                >
                  Merge and remove
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Add another category if you want to merge this one.</p>
            )}
          </>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-block"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await repository.deleteCategory(category.id);
                onNotice(`${category.name} deleted.`);
                onClose();
              })
            }
          >
            Delete
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-block" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function usageLabel(expenses: number, sales = 0): string {
  if (expenses === 0 && sales === 0) return 'Not used yet';
  const parts: string[] = [];
  if (expenses > 0) parts.push(`${expenses} expense${expenses === 1 ? '' : 's'}`);
  if (sales > 0) parts.push(`${sales} sale${sales === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
