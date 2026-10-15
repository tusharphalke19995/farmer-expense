import { useEffect, useState } from 'react';
import { errorMessage, repository } from '../data/repository';

export type LedgerState =
  | { status: 'opening' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function useLedger(): LedgerState {
  const [state, setState] = useState<LedgerState>({ status: 'opening' });

  useEffect(() => {
    let cancelled = false;
    repository.open().then(
      () => {
        if (!cancelled) setState({ status: 'ready' });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
