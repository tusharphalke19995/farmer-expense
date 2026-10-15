import { useState, type ReactNode } from 'react';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExpenseForm } from './components/ExpenseForm';
import { ExpenseList } from './components/ExpenseList';
import { ManageLists } from './components/ManageLists';
import { useLedger } from './hooks/useLedger';
import { useTheme } from './hooks/useTheme';
import type { Expense } from './types';

type Tab = 'dashboard' | 'expenses' | 'add' | 'manage';

export default function App() {
  const { theme, toggle } = useTheme();
  const ledger = useLedger();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [editing, setEditing] = useState<Expense | null>(null);

  if (typeof indexedDB === 'undefined') {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="font-serif text-3xl">Farm Ledger</h1>
        <p className="mt-3">This browser cannot store an offline ledger. Try a current version of Chrome, Edge, or Safari.</p>
      </main>
    );
  }

  function openTab(next: Tab) {
    if (next === 'add') setEditing(null);
    setTab(next);
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto min-h-dvh max-w-lg">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="font-serif text-2xl leading-none">Farm Ledger</p>
            <p className="mt-1 text-sm text-[var(--muted)]">On this phone · works offline</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggle}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>
        <main className="page-pad px-4 pt-4">
          {ledger.status === 'opening' ? <p className="text-[var(--muted)]">Opening your ledger…</p> : null}
          {ledger.status === 'error' ? (
            <div>
              <p>The ledger on this phone could not be read.</p>
              <p className="error" role="alert">
                {ledger.message}
              </p>
              <button type="button" className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
          ) : null}
          {ledger.status === 'ready' && tab === 'dashboard' ? <Dashboard onManage={() => openTab('manage')} /> : null}
          {ledger.status === 'ready' && tab === 'expenses' ? (
            <ExpenseList
              onEdit={(expense) => {
                setEditing(expense);
                setTab('add');
              }}
            />
          ) : null}
          {ledger.status === 'ready' && tab === 'add' ? (
            <ExpenseForm
              key={editing?.id ?? 'new'}
              expense={editing}
              onSaved={() => {
                setEditing(null);
                setTab('expenses');
              }}
              onCancel={
                editing
                  ? () => {
                      setEditing(null);
                      setTab('expenses');
                    }
                  : undefined
              }
            />
          ) : null}
          {ledger.status === 'ready' && tab === 'manage' ? <ManageLists /> : null}
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--bg-elevated)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg">
            <NavButton label="Home" current={tab === 'dashboard'} onClick={() => openTab('dashboard')}>
              <HomeIcon />
            </NavButton>
            <NavButton label="Expenses" current={tab === 'expenses'} onClick={() => openTab('expenses')}>
              <ListIcon />
            </NavButton>
            <NavButton label="Add" current={tab === 'add'} onClick={() => openTab('add')}>
              <PlusIcon />
            </NavButton>
            <NavButton label="Manage" current={tab === 'manage'} onClick={() => openTab('manage')}>
              <SlidersIcon />
            </NavButton>
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

function NavButton({
  label,
  current,
  onClick,
  children,
}: {
  label: string;
  current: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="nav-btn" aria-current={current ? 'page' : undefined} onClick={onClick}>
      {children}
      {label}
    </button>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 7h12M8 12h12M8 17h12" strokeLinecap="round" />
      <path d="M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M4 17h16" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
