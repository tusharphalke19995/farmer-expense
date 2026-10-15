import { useState } from 'react';
import { categoryColor } from '../constants';
import { useCategories } from '../hooks/useCategories';
import { useCrops } from '../hooks/useCrops';
import { useSummary } from '../hooks/useSummary';
import type { Category, Crop, CropSummary } from '../types';
import { formatINR } from '../utils/format';
import { initialFilter, type FilterValue } from '../utils/filters';
import { FilterBar } from './FilterBar';
import { SaleBook } from './SaleBook';

type DashboardProps = {
  onManage: () => void;
};

export function Dashboard({ onManage }: DashboardProps) {
  const crops = useCrops();
  const categories = useCategories();
  const [filter, setFilter] = useState<FilterValue>(() => initialFilter());
  const summary = useSummary(filter);

  if (!crops || !categories || !summary) {
    return <p className="text-[var(--muted)]">Opening your ledger…</p>;
  }

  const cropOf = (id: string) => crops.find((crop) => crop.id === id);
  const categoryOf = (id: string) => categories.find((category) => category.id === id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-3xl">This season</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Spending, sales, and cost per acre for the dates you pick.</p>
      </div>
      <FilterBar
        crops={crops}
        categories={categories}
        value={filter}
        onChange={setFilter}
        showCrop={false}
        showCategory={false}
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Spent" value={formatINR(summary.spent)} />
        <Stat label="Sales" value={formatINR(summary.income)} />
        <Stat label="Profit" value={formatINR(summary.profit)} tone={moneyTone(summary.profit)} />
      </div>
      <article className="card">
        <h3 className="font-semibold">By category</h3>
        {summary.categories.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No spending in this range.</p>
        ) : (
          <>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-[var(--chip)]" aria-hidden="true">
              {summary.categories.map((share) => (
                <div
                  key={share.categoryId}
                  style={{
                    flex: share.amount,
                    background: colorFor(share.categoryId, categories),
                  }}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-2">
              {summary.categories.map((share) => {
                const category = categoryOf(share.categoryId);
                return (
                  <li key={share.categoryId} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: colorFor(share.categoryId, categories) }}
                    />
                    <span className="flex-1">
                      {category?.icon ?? '•'} {category?.name ?? 'Unknown'}
                    </span>
                    <span className="tabular-nums">{formatINR(share.amount)}</span>
                    <span className="w-14 text-right tabular-nums text-[var(--muted)]">
                      {share.percent.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </article>
      {summary.crops.length === 0 ? (
        <div className="card">
          <p className="font-semibold">No crops yet.</p>
          <button type="button" className="btn btn-primary mt-3" onClick={onManage}>
            Add a crop
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {summary.crops.map((item) => (
            <CropCard
              key={item.cropId}
              item={item}
              crop={cropOf(item.cropId)}
              categories={categories}
              onManage={onManage}
            />
          ))}
        </ul>
      )}
      <SaleBook crops={crops} range={filter} />
    </div>
  );
}

function CropCard({
  item,
  crop,
  categories,
  onManage,
}: {
  item: CropSummary;
  crop: Crop | undefined;
  categories: Category[];
  onManage: () => void;
}) {
  return (
    <li className="card" style={{ borderLeft: `6px solid ${crop?.color ?? 'var(--line)'}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{crop?.name ?? 'Unknown crop'}</h3>
          {crop?.archived ? <span className="badge">Archived</span> : null}
        </div>
        <p className="text-right font-semibold tabular-nums">{formatINR(item.spent)}</p>
      </div>
      <p className={`mt-1 text-sm ${moneyTone(item.profit)}`}>
        Sales {formatINR(item.income)} · Profit {formatINR(item.profit)}
      </p>
      {item.acres != null && item.costPerAcre != null ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {item.acres} acres · {formatINR(item.costPerAcre)} / acre in this range
        </p>
      ) : (
        <button type="button" className="mt-2 text-sm font-semibold text-[var(--leaf)] underline" onClick={onManage}>
          Set acres in Manage
        </button>
      )}
      {item.categories.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {item.categories.map((share) => {
            const category = categories.find((entry) => entry.id === share.categoryId);
            return (
              <li key={share.categoryId}>
                <div className="flex justify-between gap-2 text-sm">
                  <span>
                    {category?.icon ?? '•'} {category?.name ?? 'Unknown'}
                  </span>
                  <span className="tabular-nums">
                    {formatINR(share.amount)} · {share.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--chip)]" aria-hidden="true">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(share.percent, 100)}%`,
                      background: colorFor(share.categoryId, categories),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">No spending in this range.</p>
      )}
    </li>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="card min-w-0 px-2 py-3">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className={`mt-1 text-sm leading-tight font-semibold break-words tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function colorFor(categoryId: string, categories: Category[]): string {
  const index = categories.findIndex((category) => category.id === categoryId);
  return categoryColor(index < 0 ? 0 : index);
}

function moneyTone(value: number): string {
  if (value > 0) return 'text-[var(--leaf)]';
  if (value < 0) return 'text-[var(--danger)]';
  return 'text-[var(--muted)]';
}
