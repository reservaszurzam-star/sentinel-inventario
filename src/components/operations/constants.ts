import { TransactionType } from '../../types';
import { OperationItem } from '../../lib/emailService';
import { supabase } from '../../lib/supabase';

// --- Types ---------------------------------------------------------------------

export type ActiveOp = TransactionType | 'WRITEOFF';

export type LineItem = { key: string; productId: string; qty: string };

export type OperationGuide = {
  number: string;
  type: TransactionType;
  date: string;
  operator: string;
  brand: string;
  items: OperationItem[];
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  contact?: string;
  signature?: string;
  photo?: string;
};

// --- Constants -----------------------------------------------------------------

export const TX_BADGE: Record<TransactionType, { label: string; cls: string }> = {
  RECEPTION: { label: 'RX', cls: 'text-green-600 bg-green-500/10 border-green-500/40' },
  DISPATCH:  { label: 'TX', cls: 'text-red-600 bg-red-500/10 border-red-500/40' },
  TRANSFER:  { label: 'MV', cls: 'text-blue-600 bg-blue-500/10 border-blue-500/40' },
};

export const GUIDE_PREFIX: Record<TransactionType, string> = {
  RECEPTION: 'RE',
  DISPATCH:  'DE',
  TRANSFER:  'TR',
};

export const BRAND_ABBR: Record<string, string> = {
  OVERSHARK: 'OS',
  BRAVOS: 'BU',
  BOX_PRIME: 'BP',
};

export const BRAND_NAME: Record<string, string> = {
  OVERSHARK: 'OVERSHARK',
  BRAVOS:    'BRAVOS URBAN',
  BOX_PRIME: 'BOX PRIME',
};

export const TYPE_META: Record<TransactionType, { label: string; accentColor: string; bgColor: string; icon: string }> = {
  RECEPTION: { label: 'RECEPCION', accentColor: '#15803d', bgColor: '#f0fdf4', icon: '↓' },
  DISPATCH:  { label: 'DESPACHO',  accentColor: '#b91c1c', bgColor: '#fef2f2', icon: '↑' },
  TRANSFER:  { label: 'TRASLADO',  accentColor: '#0369a1', bgColor: '#eff6ff', icon: '→' },
};

export const WRITEOFF_REASONS = [
  'Prendas en mal estado',
  'Prendas rotas',
  'Prendas sucias / manchadas',
  'Prendas mojadas / húmedas',
  'Prendas con defecto de fabricación',
  'Prendas deterioradas por almacenamiento',
  'Merma por siniestro / robo',
  'Otro motivo',
];

// --- Helpers -------------------------------------------------------------------

export async function nextGuideNumber(type: TransactionType, brand: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_guide_number', { p_brand: brand, p_type: type });
  if (error || !data) {
    // Fallback to a timestamp-based local id so the operation can still complete.
    return `${GUIDE_PREFIX[type]}-${Date.now().toString().slice(-5)}`;
  }
  return data as string;
}

export function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
