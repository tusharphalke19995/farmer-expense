import { useLiveQuery } from 'dexie-react-hooks';
import { repository } from '../data/repository';

export function useCrops() {
  return useLiveQuery(() => repository.listCrops(), []);
}
