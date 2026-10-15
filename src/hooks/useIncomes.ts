import { repository } from '../data/repository';
import type { DateRange } from '../types';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useIncomes(range: DateRange) {
  return useRepositoryQuery(() => repository.listIncomes(range), [range.from, range.to]);
}
