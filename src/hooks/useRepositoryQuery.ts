import { useEffect, useRef, useState } from 'react';
import { subscribeRepository } from '../data/repository';

export function useRepositoryQuery<T>(query: () => Promise<T>, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      queryRef.current()
        .then((result) => {
          if (cancelled) return;
          setError(null);
          setValue(result);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err);
        });
    };
    load();
    const stop = subscribeRepository(load);
    return () => {
      cancelled = true;
      stop();
    };
    // deps are the query inputs from the caller, such as the selected crop and dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (error) throw error instanceof Error ? error : new Error('The ledger could not be read.');
  return value;
}
