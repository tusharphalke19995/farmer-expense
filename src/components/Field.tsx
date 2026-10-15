import type { ReactNode } from 'react';

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {hint ? <span className="ml-1 font-normal text-[var(--muted)]">{hint}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
