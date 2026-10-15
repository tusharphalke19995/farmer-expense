import { repository } from '../data/repository';
import type { DateRange } from '../types';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useSummary(range: DateRange) {
  return useRepositoryQuery(() => repository.summarize(range), [range.from, range.to]);
}
