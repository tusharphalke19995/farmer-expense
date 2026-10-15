import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';
import type { DateRange } from '../types';

export function useIncomes(range: DateRange) {
  return useLiveQuery(() => repository.listIncomes(range), [range.from, range.to]);
}
