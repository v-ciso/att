// Shift hours per retailer + weekday. Costco filled in per the owner's spec;
// other retailers get a generic default.
// ponytail: hours hardcoded here; a per-store hours editor is the upgrade path.

export type ShiftCode = 'AM' | 'SWING' | 'PM' | 'FULL';
export const SHIFT_CODES: ShiftCode[] = ['AM', 'SWING', 'PM', 'FULL'];

type DayHours = Record<ShiftCode, string>;

function costcoHours(dow: number): DayHours {
  if (dow === 0) return { AM: '9–1', SWING: '11–4', PM: '1–6', FULL: '9–6' };   // Sun, closes 6
  if (dow === 6) return { AM: '9–2', SWING: '11–5', PM: '2–7', FULL: '9–7' };   // Sat, closes 7
  return { AM: '9–3:30', SWING: '11–6', PM: '3:30–8:30', FULL: '9–8:30' };       // Mon–Fri
}

function genericHours(dow: number): DayHours {
  if (dow === 0) return { AM: '9–1', SWING: '11–4', PM: '1–6', FULL: '9–6' };
  return { AM: '9–2', SWING: '11–5', PM: '2–close', FULL: 'open–close' };
}

export function retailerOf(store: string): string {
  const s = store.toLowerCase();
  if (s.includes('costco')) return 'Costco';
  if (s.includes('target')) return 'Target';
  if (s.includes("bj")) return "BJ's";
  return 'Custom';
}

export const RETAILERS = ['Costco', 'Target', "BJ's", 'Custom'];

export function dayHours(store: string, dateStr: string): DayHours {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  return retailerOf(store) === 'Costco' ? costcoHours(dow) : genericHours(dow);
}

export function shiftTime(store: string, dateStr: string, code: ShiftCode): string {
  return dayHours(store, dateStr)[code];
}

// Schedule cell value is "store|CODE" (or 'OFF'/''); helpers to encode/parse.
export function encodeShift(store: string, code: ShiftCode): string {
  return `${store}|${code}`;
}
export function parseShift(value: string): { store: string; code: ShiftCode | null } {
  if (!value || value === 'OFF') return { store: '', code: null };
  const [store, code] = value.split('|');
  return { store, code: (code as ShiftCode) || null };
}

// ---------------------------------------------------------------------------
// Staffing coverage — is a store actually covered open-to-close on a given day?
// A store must not be "half assed": either full-day / AM+PM cover, or closed.
// FULL covers both halves; a lone PM leaves the morning open, and one person
// all day is covered-but-thin (the owner should confirm it on purpose).
// ---------------------------------------------------------------------------

export type CoverageStatus = 'ok' | 'thin' | 'gap' | 'unstaffed' | 'closed';

export interface Coverage {
  status: CoverageStatus;
  label: string;
  am: number;   // bodies covering the morning (AM or FULL)
  pm: number;   // bodies covering the evening (PM or FULL)
  swing: number;
  total: number;
}

// `codes` = the shift each assigned rep works at this store that day.
export function storeCoverage(codes: ShiftCode[], closed: boolean): Coverage {
  if (closed) return { status: 'closed', label: 'Closed', am: 0, pm: 0, swing: 0, total: 0 };

  let am = 0, pm = 0, swing = 0;
  for (const c of codes) {
    if (c === 'AM' || c === 'FULL') am++;
    if (c === 'PM' || c === 'FULL') pm++;
    if (c === 'SWING') swing++;
  }
  const total = codes.length;

  if (total === 0) return { status: 'unstaffed', label: 'No one scheduled', am, pm, swing, total };
  // A swing shift bridges the middle but does not open or close alone.
  if (am === 0) return { status: 'gap', label: 'No morning coverage', am, pm, swing, total };
  if (pm === 0) return { status: 'gap', label: 'No evening coverage', am, pm, swing, total };
  if (total === 1) return { status: 'thin', label: 'Only 1 person all day', am, pm, swing, total };
  return { status: 'ok', label: 'Covered', am, pm, swing, total };
}
