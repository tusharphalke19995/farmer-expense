import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';

export function useUsage() {
  return useLiveQuery(() => repository.usage(), []);
}
