import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'The ledger could not be opened.';
    return { message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-serif text-3xl">Farm Ledger</h1>
        <p className="mt-3">The ledger on this phone could not be read.</p>
        <p className="error" role="alert">
          {this.state.message}
        </p>
        <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
