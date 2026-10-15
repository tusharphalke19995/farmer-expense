import { repository } from '../data/repository';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useCategories() {
  return useRepositoryQuery(() => repository.listCategories(), []);
}
