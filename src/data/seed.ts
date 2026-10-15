import type { Category, Crop } from '../types';

export function seedCrops(now: string): Crop[] {
  return [
    {
      id: '11111111-1111-4111-8111-111111111101',
      name: 'Soybean',
      color: '#2f6b4f',
      archived: false,
      acres: null,
      createdAt: now,
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      name: 'Onion',
      color: '#c47b2b',
      archived: false,
      acres: null,
      createdAt: now,
    },
  ];
}

export function seedCategories(now: string): Category[] {
  return [
    {
      id: '22222222-2222-4222-8222-222222222201',
      name: 'Tractor',
      icon: '🚜',
      archived: false,
      createdAt: now,
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      name: 'Labor',
      icon: '👷',
      archived: false,
      createdAt: now,
    },
    {
      id: '22222222-2222-4222-8222-222222222203',
      name: 'Other',
      icon: '📋',
      archived: false,
      createdAt: now,
    },
  ];
}
