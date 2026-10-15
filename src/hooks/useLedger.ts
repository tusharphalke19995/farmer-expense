import { useEffect, useState } from 'react';
import { errorMessage, repository } from '../data/repository';

export type LedgerState =
  | { status: 'opening' }
  | { status: 'ready'; persistent: boolean }
  | { status: 'error'; message: string };

export function useLedger(): LedgerState {
  const [state, setState] = useState<LedgerState>({ status: 'opening' });

  useEffect(() => {
    let cancelled = false;
    repository.open().then(
      (persistent) => {
        if (!cancelled) setState({ status: 'ready', persistent });
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
