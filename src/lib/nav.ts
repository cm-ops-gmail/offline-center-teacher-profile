import { Building2, ClipboardCheck, Presentation, LayoutDashboard, Scale, ScanLine, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Colour dot shown instead of an icon (used for programs). */
  dot?: string;
  /** Sub-menu entries (Collect → the three rating screens). */
  children?: NavItem[];
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
      {
        label: 'Collect',
        href: '/collect',
        icon: ScanLine,
        children: [
          { label: 'Student rating', href: '/collect', icon: ScanLine },
          { label: 'OpEx rating', href: '/opex', icon: ClipboardCheck },
          { label: 'Programme team rating', href: '/programme-team', icon: Presentation },
        ],
      },
    ],
  },
];

export const APP_NAME = 'Offline Teacher';
