/*
 * One spelling per thing, so "Fahad", "FAHAD", " fahad " and "Fahad  " never end up as different values in the sheet.
 * (Matching in the app already ignores case and spaces; this decides what is WRITTEN.)
 */

export const compact = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Letters+digits only, lower-case — the "is this the same thing?" key. */
export const looseKey = (s: unknown): string => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s.\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

const CODE = /^([A-Za-z]{2,5}\d{1,4})\s*[-–—]\s*(.*)$/;

/** True if any word is written entirely in capitals or entirely in lower case ("FAHAD", "sirazum MUNIRA", "md rahim"). */
const unevenCase = (name: string): boolean => name.split(/[\s.\-'’]+/).some((w) => w.length > 1 && /\p{L}/u.test(w) && (w === w.toUpperCase() || w === w.toLowerCase()));

/**
 * Formats a person's name for a NEW entry: spaces tidied, staff code upper-case ("lci004 - x" → "LCI004 - X"),
 * and any name with an all-caps or all-lower word turned into Title Case. Properly capitalised names
 * ("Nusrat McDonald") are left alone.
 * (For a person already in the sheet, the sheet's own spelling is used instead — see the server.)
 */
export function formatName(raw: string): string {
  const t = compact(raw);
  const m = CODE.exec(t);
  const code = m ? m[1].toUpperCase() : null;
  let name = m ? compact(m[2]) : t;
  if (name && unevenCase(name)) name = titleCase(name);
  return code ? (name ? `${code} - ${name}` : code) : name;
}

/** "a 11" → "A11", "c2 - c3" → "C2-C3". */
export function formatBatch(raw: string): string {
  return compact(raw).toUpperCase().replace(/\s*[-–—]\s*/g, '-').replace(/\s+/g, '');
}

export function formatPlace(raw: string): string {
  return titleCase(compact(raw));
}

/** The canonical spelling from a list (case/space/punctuation-insensitive), or null if it is not in the list. */
export function fromList(raw: string, list: readonly string[]): string | null {
  const k = looseKey(raw);
  return k ? (list.find((x) => looseKey(x) === k) ?? null) : null;
}
