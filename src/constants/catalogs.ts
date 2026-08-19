// Ported verbatim from reference/index.html's catalog constants.
import type { PatternCategory, SectionStatus, ToolType } from '@/types/knitwit';

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  sweaters: 'Sweater',
  accessories: 'Accessory',
  hats: 'Hat',
  scarves: 'Scarf & cowl',
  socks: 'Socks',
  blankets: 'Blanket',
  toys: 'Toy',
  home: 'Home decor',
  baby: 'Baby & kids',
  queue: 'Queue',
};

export const CATEGORY_ORDER: PatternCategory[] = [
  'sweaters',
  'accessories',
  'hats',
  'scarves',
  'socks',
  'blankets',
  'toys',
  'home',
  'baby',
  'queue',
];

export const SECTION_STATUS_LABELS: Record<SectionStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
};

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  straight: 'Straight',
  circular: 'Circular',
  dpn: 'DPN',
  interchangeable: 'Interchangeable',
  'crochet-hook': 'Crochet hook',
  'cable-needle': 'Cable needle',
  'cable-pin': 'Cable pin',
  other: 'Other',
};

export const TOOL_ICONS: Record<ToolType, string> = {
  straight: '➖',
  circular: '⭕',
  dpn: '▦',
  interchangeable: '🔧',
  'crochet-hook': '🪝',
  'cable-needle': '➰',
  'cable-pin': '📌',
  other: '🧰',
};

export const YARN_WEIGHTS = [
  { code: '0', label: 'Lace' },
  { code: '1', label: 'Super fine' },
  { code: '2', label: 'Fine' },
  { code: '3', label: 'Light' },
  { code: '4', label: 'Medium' },
  { code: '5', label: 'Bulky' },
  { code: '6', label: 'Super bulky' },
  { code: '7', label: 'Jumbo' },
] as const;

export function yarnWeightLabel(code: string): string {
  const w = YARN_WEIGHTS.find((x) => x.code === String(code));
  return w ? `${w.code} · ${w.label}` : '';
}

export const WASHING_LABELS: Record<string, string> = {
  'hand-wash': 'Hand wash cold',
  'machine-cold': 'Machine wash cold',
  'machine-wool': 'Machine wash (wool cycle)',
  'dry-clean': 'Dry clean only',
  'lay-flat': 'Lay flat to dry',
  'no-wash': 'Do not wash',
};
