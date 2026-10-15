import type { Category, Crop } from '../types';
import type { FilterValue } from '../utils/filters';
import { rangeForPreset, type SeasonPreset } from '../utils/season';

const PRESETS: { id: SeasonPreset; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'kharif', label: 'Kharif' },
  { id: 'rabi', label: 'Rabi' },
];

const HINTS: Record<SeasonPreset, string> = {
  all: 'Every date is included.',
  month: 'This calendar month.',
  year: 'This calendar year.',
  kharif: 'Kharif is 1 Jun – 31 Oct.',
  rabi: 'Rabi is 1 Nov – 31 Mar.',
  custom: 'Custom date range.',
};

type FilterBarProps = {
  crops: Crop[];
  categories: Category[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  showCrop?: boolean;
  showCategory?: boolean;
};

export function FilterBar({
  crops,
  categories,
  value,
  onChange,
  showCrop = true,
  showCategory = true,
}: FilterBarProps) {
  const rangeInvalid = Boolean(value.from && value.to && value.from > value.to);

  function choosePreset(preset: SeasonPreset) {
    onChange({
      ...value,
      preset,
      ...rangeForPreset(preset),
    });
  }

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`chip ${value.preset === preset.id ? 'chip-active' : ''}`}
            aria-pressed={value.preset === preset.id}
            onClick={() => choosePreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--muted)]">{HINTS[value.preset]}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="filter-from">
            From
          </label>
          <input
            id="filter-from"
            className="field"
            type="date"
            value={value.from}
            onChange={(event) => onChange({ ...value, preset: 'custom', from: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="filter-to">
            To
          </label>
          <input
            id="filter-to"
            className="field"
            type="date"
            value={value.to}
            onChange={(event) => onChange({ ...value, preset: 'custom', to: event.target.value })}
          />
        </div>
      </div>
      {rangeInvalid ? (
        <p className="error" role="alert">
          Start date must be on or before the end date.
        </p>
      ) : null}
      {showCrop || showCategory ? (
        <div className="grid grid-cols-1 gap-3">
          {showCrop ? (
            <div>
              <label className="label" htmlFor="filter-crop">
                Crop
              </label>
              <select
                id="filter-crop"
                className="field"
                value={value.cropId}
                onChange={(event) => onChange({ ...value, cropId: event.target.value })}
              >
                <option value="">All crops</option>
                {crops.map((crop) => (
                  <option key={crop.id} value={crop.id}>
                    {crop.name}
                    {crop.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {showCategory ? (
            <div>
              <label className="label" htmlFor="filter-category">
                Category
              </label>
              <select
                id="filter-category"
                className="field"
                value={value.categoryId}
                onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                    {category.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
