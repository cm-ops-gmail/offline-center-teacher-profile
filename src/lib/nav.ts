import { Building2, ClipboardCheck, Presentation, LayoutDashboard, Scale, ScanLine, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** Colour dot shown instead of an icon (used for programs). */
  dot?: string;
  /** Root routes match exactly, so "/online" is not "active" while on "/online/teachers". */
  exact?: boolean;
  /** Sub-menu entries (Collect → the three rating screens). */
  children?: NavItem[];
}
export interface NavGroup {
  category: string;
  items: NavItem[];
}
export interface NavSegment {
  /** The collapsible heading in the sidebar ("Offline Teacher" / "Online Teacher"). */
  label: string;
  groups: NavGroup[];
}

/** Every menu entry lives here. The sidebar shows one collapsible segment per entry. */
export const SEGMENTS: NavSegment[] = [
  {
    label: 'Offline Teacher',
    groups: [
      {
        category: 'Insights',
        items: [
          { label: 'Overview', href: '/', icon: LayoutDashboard, exact: true },
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
    ],
  },
  {
    label: 'Online Teacher',
    groups: [
      {
        category: 'Insights',
        items: [
          { label: 'Overview', href: '/online', icon: LayoutDashboard, exact: true },
          { label: 'Teachers', href: '/online/teachers', icon: Users },
          { label: 'Compare teachers', href: '/online/compare', icon: Scale },
        ],
      },
    ],
  },
];

export const APP_NAME = 'Teacher Performance';
