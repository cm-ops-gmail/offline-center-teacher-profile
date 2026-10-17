import { Building2, ClipboardCheck, Presentation, GraduationCap, LayoutDashboard, Scale, ScanLine, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { PROGRAMS } from '@/features/ratings/programs';

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Colour dot shown instead of an icon (used for programs). */
  dot?: string;
}
export interface NavGroup {
  category: string;
  items: NavItem[];
}

/** Every menu entry lives here (same convention as the 10MS app template). */
export const NAV: NavGroup[] = [
  {
    category: 'Insights',
    items: [
      { label: 'Overview', href: '/', icon: LayoutDashboard },
      { label: 'Teachers', href: '/teachers', icon: Users },
      { label: 'Compare teachers', href: '/compare', icon: Scale },
      { label: 'Branches', href: '/branches', icon: Building2 },
    ],
  },
  {
    category: 'Programmes',
    items: PROGRAMS.map((p) => ({ label: p.label, href: `/programs/${p.id}`, icon: GraduationCap, dot: p.color })),
  },
  {
    category: 'Collect',
    items: [{ label: 'Upload forms', href: '/collect', icon: ScanLine },
      { label: 'OpEx rating', href: '/opex', icon: ClipboardCheck },
      { label: 'Programme team rating', href: '/programme-team', icon: Presentation },
    ],
  },
  {
    category: 'Source',
    items: [{ label: 'Data health', href: '/data-health', icon: ShieldCheck }],
  },
];

export const APP_NAME = 'Teacher Performance';
