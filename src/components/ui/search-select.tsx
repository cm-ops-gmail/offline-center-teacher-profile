'use client';
import { useMemo, useState } from 'react';
import { Combobox } from '@tenminuteschool/design-system';
import { cn } from '@/lib/utils';

export interface SearchOption {
  value: string;
  label: string;
}

/**
 * A dropdown you can type into (the design system's Combobox). "all" is the empty state: it shows `allLabel`
 * as its placeholder, and the little × puts it back. Same look as the other filter controls.
 */
export function SearchSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  searchPlaceholder,
  emptyText = 'No match',
  className,
  dropdownWidth = 'w-[22rem]',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  allLabel: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  dropdownWidth?: string;
}) {
  // Plain "contains" search: every word typed must appear in the name ("sira mun" → "Sirazum Munira").
  // (Passing onSearch turns off the Combobox's own fuzzy matcher, which also lists names that merely contain the letters scattered about.)
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    const hits = options.filter((o) => words.every((w) => o.label.toLowerCase().includes(w)));
    const picked = options.find((o) => o.value === value);
    return picked && !hits.includes(picked) ? [picked, ...hits] : hits; // keep the chosen one so the button can still show its name
  }, [options, query, value]);

  return (
    <div role="group" aria-label={label} className={cn('min-w-0', className)}>
      <Combobox
        options={shown}
        onSearch={setQuery}
        value={value === 'all' ? '' : value}
        onValueChange={(v) => onChange(v || 'all')}
        placeholder={allLabel}
        searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`}
        emptyText={emptyText}
        clearable
        dropdownWidth={dropdownWidth}
        className="h-9 w-full"
      />
    </div>
  );
}
