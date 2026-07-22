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
