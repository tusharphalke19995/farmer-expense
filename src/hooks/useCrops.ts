import { repository } from '../data/repository';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useCrops() {
  return useRepositoryQuery(() => repository.listCrops(), []);
}
