/** Latest backup / app schema. Dexie versions live in src/data/db.ts. */
export const APP_ID = 'farm-ledger';
export const SCHEMA_VERSION = 2;

export const CROP_COLORS = [
  '#2f6b4f',
  '#c47b2b',
  '#2f5d8a',
  '#8a3d4b',
  '#6a5a2a',
  '#2f6b62',
  '#704878',
  '#a15c38',
];

export const CATEGORY_ICONS = ['🚜', '👷', '🌱', '💧', '🧪', '⛽', '🔧', '📦', '💰', '📋'];

export const CATEGORY_BAR_COLORS = [
  '#1f6b45',
  '#c47b2b',
  '#2f5d8a',
  '#8a3d4b',
  '#6a5a2a',
  '#2f6b62',
  '#704878',
  '#a15c38',
];

export function categoryColor(index: number): string {
  return CATEGORY_BAR_COLORS[index % CATEGORY_BAR_COLORS.length];
}
