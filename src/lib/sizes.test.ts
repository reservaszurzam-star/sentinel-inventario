import { describe, it, expect } from 'vitest';
import { sortSizes, sizeRank, SIZE_ORDER } from './sizes';

describe('sizes utilities', () => {
  it('correctly ranks standard sizes in order', () => {
    expect(sizeRank('XS')).toBeLessThan(sizeRank('S'));
    expect(sizeRank('S')).toBeLessThan(sizeRank('M'));
    expect(sizeRank('M')).toBeLessThan(sizeRank('L'));
    expect(sizeRank('L')).toBeLessThan(sizeRank('XL'));
    expect(sizeRank('XL')).toBeLessThan(sizeRank('XXL'));
  });

  it('ranks unknown sizes with 999', () => {
    expect(sizeRank('UNKNOWN_SIZE')).toBe(999);
  });

  it('sorts scrambled apparel sizes accurately', () => {
    const scrambled = ['XL', 'S', 'XXL', 'M', 'L', 'XS'];
    const sorted = sortSizes(scrambled);
    expect(sorted).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
  });

  it('handles TALLA UNICA and special codes', () => {
    const list = ['TALLA UNICA', 'M', 'S'];
    const sorted = sortSizes(list);
    expect(sorted).toEqual(['S', 'M', 'TALLA UNICA']);
  });
});
