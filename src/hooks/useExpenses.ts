import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';
import type { ExpenseFilter } from '../types';

export function useExpenses(filter: ExpenseFilter) {
  return useLiveQuery(
    () => repository.listExpenses(filter),
    [filter.cropId, filter.categoryId, filter.from, filter.to],
  );
}
