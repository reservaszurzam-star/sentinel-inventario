import { describe, it, expect } from 'vitest';
import { getColorHex, getColorStyle, isLightColor } from './colors';

describe('colors utilities', () => {
  it('maps standard colors to calibrated textile hex codes', () => {
    expect(getColorHex('Azul')).toBe('#182b49');
    expect(getColorHex('Denim')).toBe('#375375');
    expect(getColorHex('Botella')).toBe('#113a24');
    expect(getColorHex('Camote')).toBe('#b75232');
  });

  it('provides heather pattern gradient for Melange and Melanqe', () => {
    const melangeStyle = getColorStyle('Melange');
    expect(melangeStyle.bg).toBeDefined();
    expect(melangeStyle.bg).toContain('repeating-linear-gradient');

    const melanqeStyle = getColorStyle('Melanqe');
    expect(melanqeStyle.bg).toBeDefined();
  });

  it('accurately evaluates dark vs light colors for text contrast', () => {
    expect(isLightColor('#ffffff')).toBe(true);
    expect(isLightColor('#121212')).toBe(false);
    expect(isLightColor('#182b49')).toBe(false);
    expect(isLightColor('#f8fafc')).toBe(true);
  });
});
