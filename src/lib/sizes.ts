/**
 * Centralized Apparel Size Definitions and Sorting Utilities
 * Used across Reports, Operations, QR Modals, and Inventory.
 */

export const SIZE_ORDER: readonly string[] = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '2XL',
  '3XL',
  'TALLA UNICA',
  '(TALLA UNICA)',
  '10K',
  '20K',
  'S/T',
] as const;

/**
 * Returns a numerical rank for sorting sizes.
 * Lower rank means smaller size. Unrecognized sizes are pushed to the end.
 */
export function sizeRank(size: string): number {
  const normalized = size.trim().toUpperCase();
  const idx = SIZE_ORDER.indexOf(normalized);
  return idx === -1 ? 999 : idx;
}

/**
 * Sorts an array of size strings according to standard textile sizing order.
 */
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ra = sizeRank(a);
    const rb = sizeRank(b);
    if (ra === rb) return a.localeCompare(b);
    return ra - rb;
  });
}
