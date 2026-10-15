import { describe, expect, it } from 'vitest';
import { findDuplicateName, normalizeName } from './names';

const items = [
  { id: '1', name: 'Soybean' },
  { id: '2', name: 'Onion crop' },
];

describe('duplicate names', () => {
  it('treats case and extra spaces as the same name', () => {
    expect(normalizeName('  SOYBEAN ')).toBe('soybean');
    expect(findDuplicateName(items, '  SOYBEAN ')?.id).toBe('1');
    expect(findDuplicateName(items, 'onion   crop')?.id).toBe('2');
  });

  it('lets a rename keep the same record', () => {
    expect(findDuplicateName(items, 'Soybean', '1')).toBeUndefined();
    expect(findDuplicateName(items, 'soybean', '2')?.id).toBe('1');
  });

  it('allows a different name and does not flag a blank name', () => {
    expect(findDuplicateName(items, 'Wheat')).toBeUndefined();
    expect(findDuplicateName(items, '   ')).toBeUndefined();
  });
});
