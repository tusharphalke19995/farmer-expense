import type { DateRange } from '../types';
import { defaultPreset, rangeForPreset, type SeasonPreset } from './season';

export type FilterValue = DateRange & {
  cropId: string;
  categoryId: string;
  preset: SeasonPreset;
};

export function initialFilter(preset: SeasonPreset = defaultPreset()): FilterValue {
  return {
    cropId: '',
    categoryId: '',
    preset,
    ...rangeForPreset(preset),
  };
}

export function describedBy(id: string, error?: string): string | undefined {
  return error ? `${id}-error` : undefined;
}
