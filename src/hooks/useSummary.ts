import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';
import type { DateRange } from '../types';

export function useSummary(range: DateRange) {
  return useLiveQuery(() => repository.summarize(range), [range.from, range.to]);
}
