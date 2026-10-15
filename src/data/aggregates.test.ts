import { describe, expect, it } from 'vitest';
import { buildSummary, costPerAcre, percentOf, profit, totalsByCategory, totalsByCrop } from './aggregates';
import { sumRupees } from './money';

const range = { from: '2026-10-01', to: '2026-10-31' };

describe('money totals', () => {
  it('adds paise so 0.10 and 0.20 stay 0.30', () => {
    expect(sumRupees([0.1, 0.2])).toBe(0.3);
    expect(totalsByCrop([
      { cropId: 'soy', categoryId: 'labor', amount: 0.1, date: '2026-10-01' },
      { cropId: 'soy', categoryId: 'labor', amount: 0.2, date: '2026-10-02' },
    ]).get('soy')).toBe(0.3);
  });

  it('totals each crop and each category', () => {
    const expenses = [
      { cropId: 'soy', categoryId: 'labor', amount: 70, date: '2026-10-01' },
      { cropId: 'soy', categoryId: 'tractor', amount: 30, date: '2026-10-02' },
      { cropId: 'onion', categoryId: 'labor', amount: 10, date: '2026-10-03' },
    ];
    expect(totalsByCrop(expenses).get('soy')).toBe(100);
    expect(totalsByCrop(expenses).get('onion')).toBe(10);
    expect(totalsByCategory(expenses).get('labor')).toBe(80);
    expect(totalsByCategory(expenses).get('tractor')).toBe(30);
  });
});

describe('profit and cost per acre', () => {
  it('subtracts spending from sales in paise', () => {
    expect(profit(10, 3.5)).toBe(6.5);
    expect(profit(3, 10)).toBe(-7);
  });

  it('returns null until acres are set', () => {
    expect(costPerAcre(100, 3)).toBe(33.33);
    expect(costPerAcre(10, null)).toBeNull();
    expect(costPerAcre(10, 0)).toBeNull();
  });
});

describe('buildSummary', () => {
  const crops = [
    { id: 'soybean', archived: false, acres: 2 },
    { id: 'onion', archived: false, acres: null },
    { id: 'gram', archived: false, acres: null },
    { id: 'wheat', archived: true, acres: 1 },
    { id: 'millet', archived: true, acres: 4 },
  ];

  const expenses = [
    { cropId: 'soybean', categoryId: 'labor', amount: 0.1, date: '2026-10-01' },
    { cropId: 'soybean', categoryId: 'labor', amount: 0.2, date: '2026-10-02' },
    { cropId: 'soybean', categoryId: 'tractor', amount: 30, date: '2026-10-03' },
    { cropId: 'onion', categoryId: 'labor', amount: 10, date: '2026-10-04' },
    { cropId: 'soybean', categoryId: 'labor', amount: 100, date: '2026-05-01' },
  ];

  const incomes = [
    { cropId: 'soybean', amount: 50, date: '2026-10-15' },
    { cropId: 'onion', amount: 5, date: '2026-09-01' },
    { cropId: 'wheat', amount: 8, date: '2026-10-20' },
  ];

  const summary = buildSummary({ crops, expenses, incomes, range });

  it('filters the date range and totals spending, sales, and profit', () => {
    expect(summary.spent).toBe(40.3);
    expect(summary.income).toBe(58);
    expect(summary.profit).toBe(17.7);
  });

  it('splits each crop by category and keeps an active crop with no records', () => {
    const soybean = summary.crops.find((crop) => crop.cropId === 'soybean');
    expect(soybean).toMatchObject({
      spent: 30.3,
      income: 50,
      profit: 19.7,
      acres: 2,
      costPerAcre: 15.15,
    });
    expect(soybean?.categories).toEqual([
      { categoryId: 'tractor', amount: 30, percent: 99 },
      { categoryId: 'labor', amount: 0.3, percent: 1 },
    ]);

    expect(summary.crops.find((crop) => crop.cropId === 'onion')).toMatchObject({
      spent: 10,
      income: 0,
      profit: -10,
      costPerAcre: null,
    });
    expect(summary.crops.find((crop) => crop.cropId === 'gram')).toMatchObject({
      spent: 0,
      income: 0,
      profit: 0,
    });
  });

  it('hides archived crops that have nothing in the range and shows those that do', () => {
    expect(summary.crops.map((crop) => crop.cropId)).toEqual(['soybean', 'onion', 'gram', 'wheat']);
    expect(summary.crops.find((crop) => crop.cropId === 'wheat')).toMatchObject({
      spent: 0,
      income: 8,
      profit: 8,
      costPerAcre: 0,
    });
  });

  it('builds the category percentage bar from spending in range', () => {
    expect(summary.categories).toEqual([
      { categoryId: 'tractor', amount: 30, percent: 74.4 },
      { categoryId: 'labor', amount: 10.3, percent: 25.6 },
    ]);
    expect(percentOf(30, 40.3)).toBe(74.4);
  });

  it('includes the boundary dates and excludes the days outside them', () => {
    const onEdges = buildSummary({
      crops: [{ id: 'soybean', archived: false, acres: null }],
      expenses: [
        { cropId: 'soybean', categoryId: 'labor', amount: 1, date: '2026-09-30' },
        { cropId: 'soybean', categoryId: 'labor', amount: 2, date: '2026-10-01' },
        { cropId: 'soybean', categoryId: 'labor', amount: 4, date: '2026-10-31' },
        { cropId: 'soybean', categoryId: 'labor', amount: 8, date: '2026-11-01' },
      ],
      incomes: [],
      range,
    });
    expect(onEdges.spent).toBe(6);
  });
});
