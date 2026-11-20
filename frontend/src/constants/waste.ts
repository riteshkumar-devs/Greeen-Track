import type { CategoryCode } from '../types/api';

export const CATEGORY_CODES: CategoryCode[] = [
  'WET',
  'PLASTIC',
  'PAPER',
  'METAL_GLASS',
  'OTHER',
];

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  WET: 'Wet / Organics',
  PLASTIC: 'Plastic',
  PAPER: 'Paper & Cardboard',
  METAL_GLASS: 'Metal & Glass',
  OTHER: 'Other / Residual',
};

export const DISPOSAL_GUIDANCE: Record<CategoryCode, string> = {
  WET: 'Food scraps, compostable organics, and soiled paper napkins only. Keep plastic bags out.',
  PLASTIC: 'Empty and rinsed bottles, tubs, and rigid containers. No film bags or food residue.',
  PAPER: 'Clean dry paper, flattened cartons, and cardboard sleeves. Keep wet food packaging out.',
  METAL_GLASS: 'Rinsed aluminum cans, tin cans, and glass bottles or jars.',
  OTHER: 'Non-recyclable wrappers, multilayer foils, and residual waste.',
};
