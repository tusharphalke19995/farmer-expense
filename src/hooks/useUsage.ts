import { repository } from '../data/repository';
import { useRepositoryQuery } from './useRepositoryQuery';

export function useUsage() {
  return useRepositoryQuery(() => repository.usage(), []);
}
