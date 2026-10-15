import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';

export function useCategories() {
  return useLiveQuery(() => repository.listCategories(), []);
}
