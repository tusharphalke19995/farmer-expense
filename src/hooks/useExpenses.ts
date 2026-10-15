import { repository } from '../data/repository';
import type { ExpenseFilter } from '../types';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useExpenses(filter: ExpenseFilter) {
  return useRepositoryQuery(
    () => repository.listExpenses(filter),
    [filter.cropId, filter.categoryId, filter.from, filter.to],
  );
}
