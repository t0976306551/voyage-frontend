'use client';

import type { ComponentType } from 'react';
import {
  UtensilsCrossed,
  BedDouble,
  Landmark,
  Ticket,
  Train,
  ClipboardList,
} from 'lucide-react';
import type { SpotCategory } from '@/lib/api/itinerary.api';

const DEFAULT_CATEGORY: SpotCategory = 'attraction';

export const CATEGORY_ORDER: SpotCategory[] = [
  'food',
  'lodging',
  'attraction',
  'activity',
  'transport',
  'admin',
];

export const CATEGORY_CONFIG: Record<
  SpotCategory,
  {
    label: string;
    icon: ComponentType<{ className?: string }>;
    bg: string;
    text: string;
  }
> = {
  food: { label: '美食', icon: UtensilsCrossed, bg: 'bg-orange-100', text: 'text-orange-700' },
  lodging: { label: '住宿', icon: BedDouble, bg: 'bg-blue-100', text: 'text-blue-700' },
  attraction: { label: '景點', icon: Landmark, bg: 'bg-indigo-100', text: 'text-indigo-700' },
  activity: { label: '體驗', icon: Ticket, bg: 'bg-violet-100', text: 'text-violet-700' },
  transport: { label: '交通', icon: Train, bg: 'bg-slate-100', text: 'text-slate-700' },
  admin: { label: '行政', icon: ClipboardList, bg: 'bg-amber-100', text: 'text-amber-700' },
};

export function CategoryBadge({ category }: { category: SpotCategory | null }) {
  const cfg = CATEGORY_CONFIG[category ?? DEFAULT_CATEGORY];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default CategoryBadge;
