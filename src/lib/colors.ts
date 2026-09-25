/**
 * Centralized Textile Color Palette & Style Definitions
 * Calibrated specifically for Peruvian apparel manufacturing (Overshark / Zazu).
 */

export interface ColorStyle {
  hex: string;
  bg?: string;
  background: string;
  textLight?: boolean;
  isLight: boolean;
}

export const TEXTILE_COLOR_MAP: Record<string, { hex: string; bg?: string; textLight?: boolean }> = {
  NEGRO: { hex: '#121212', textLight: false },
  BLACK: { hex: '#121212', textLight: false },
  BLANCO: { hex: '#f8fafc', textLight: true },
  WHITE: { hex: '#f8fafc', textLight: true },
  PERLA: { hex: '#ebe5db', textLight: true },
  BEIGE: { hex: '#d9c8af', textLight: true },
  BEGE: { hex: '#d9c8af', textLight: true },
  AZUL: { hex: '#182b49', textLight: false }, // Deep textile navy
  NAVY: { hex: '#182b49', textLight: false },
  DENIM: { hex: '#375375', textLight: false }, // Washed indigo / denim
  CELESTE: { hex: '#8cb9de', textLight: true },
  BOTELLA: { hex: '#113a24', textLight: false }, // Deep forest bottle green
  VERDE: { hex: '#1e6837', textLight: false },
  MENTA: { hex: '#9ad0b4', textLight: true },
  PACAY: { hex: '#779834', textLight: false }, // Warm olive / chartreuse
  CAMOTE: { hex: '#b75232', textLight: false }, // Genuine terracotta / brick
  CEMENTO: { hex: '#878d95', textLight: true }, // Neutral urban concrete
  PLOMO: { hex: '#475569', textLight: false },
  TOPO: { hex: '#7a7167', textLight: false },
  MARRON: { hex: '#482a1d', textLight: false }, // Rich chocolate
  CAFE: { hex: '#482a1d', textLight: false },
  CAMEL: { hex: '#af7b44', textLight: false },
  VINO: { hex: '#5c1726', textLight: false }, // Deep wine / burgundy
  GUINDA: { hex: '#5c1726', textLight: false },
  ROJO: { hex: '#b91c1c', textLight: false },
  'P.ROSA': { hex: '#cb8e95', textLight: true }, // Dusty antique rose
  PALO_ROSA: { hex: '#cb8e95', textLight: true },
  ROSA: { hex: '#e89db1', textLight: true },
  ROSADO: { hex: '#e89db1', textLight: true },
  LILA: { hex: '#b794f4', textLight: true },
  MORADO: { hex: '#5b21b6', textLight: false },
  AMARILLO: { hex: '#eab308', textLight: true },
  MOSTAZA: { hex: '#c89523', textLight: false },
  MELANGE: {
    hex: '#b8c0c8',
    bg: 'repeating-linear-gradient(45deg, #c8cfd6 0px, #c8cfd6 3px, #9aa2ab 3px, #9aa2ab 6px)',
    textLight: true,
  },
  MELANQE: {
    hex: '#b8c0c8',
    bg: 'repeating-linear-gradient(45deg, #c8cfd6 0px, #c8cfd6 3px, #9aa2ab 3px, #9aa2ab 6px)',
    textLight: true,
  },
  'MELANQE O.': {
    hex: '#78818c',
    bg: 'repeating-linear-gradient(45deg, #88919c 0px, #88919c 3px, #58606b 3px, #58606b 6px)',
    textLight: false,
  },
};

/**
 * Returns full color style object (hex, background pattern if any, text contrast).
 */
export function getColorStyle(colorName?: string): ColorStyle {
  const defaultHex = '#878d95';
  if (!colorName) {
    return { hex: defaultHex, background: defaultHex, textLight: true, isLight: true };
  }
  const clean = colorName.trim().toUpperCase();
  for (const key of Object.keys(TEXTILE_COLOR_MAP)) {
    if (clean.includes(key)) {
      const def = TEXTILE_COLOR_MAP[key];
      const isLight = def.textLight ?? isLightColor(def.hex);
      return {
        ...def,
        background: def.bg ?? def.hex,
        isLight,
      };
    }
  }
  return {
    hex: defaultHex,
    background: defaultHex,
    textLight: true,
    isLight: true,
  };
}

/**
 * Returns primary hex code for given color name.
 */
export function getColorHex(colorName?: string): string {
  return getColorStyle(colorName).hex;
}

/**
 * Determines whether text placed on top of this hex background should be dark.
 */
export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
