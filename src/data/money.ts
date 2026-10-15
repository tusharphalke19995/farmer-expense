/**
 * Money is stored as integer paise in IndexedDB (₹1 = 100 paise).
 * The repository converts to rupees before the UI, CSV, or JSON sees a value.
 * Sums add paise so 0.10 + 0.20 stays 0.30.
 */

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100 + 1e-8);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function round2(value: number): number {
  return fromPaise(toPaise(value));
}

export function sumRupees(amounts: readonly number[]): number {
  const paise = amounts.reduce((sum, amount) => sum + toPaise(amount), 0);
  return fromPaise(paise);
}
