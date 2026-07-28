// Pure identity + lifecycle helpers for the roster. No React, no storage, no
// server imports, so this is safe to use from client components, the tenant-data
// migration, and the archive API alike. The Person type itself still lives in
// the roster component (where it is consumed most); we take it by type only.
import type { Person, PersonStatus } from '@/components/dashboard/roster';

/** A person with no explicit status predates Phase 4 and is treated as active. */
export function personStatus(p: Pick<Person, 'status'>): PersonStatus {
  return p.status ?? 'active';
}

export function isActive(p: Pick<Person, 'status'>): boolean {
  return personStatus(p) === 'active';
}

export function isRetired(p: Pick<Person, 'status'>): boolean {
  return personStatus(p) === 'retired';
}

/**
 * The people shown in day-to-day views (scheduling, attendance, active
 * leaderboards). Retired and archived people are kept for history but excluded
 * here so they stop appearing in operational lists.
 */
export function activePeople<T extends Pick<Person, 'status'>>(people: T[]): T[] {
  return people.filter(isActive);
}

/**
 * Company code prefix, e.g. "Sorami" -> "SOR", "BJ's Wholesale" -> "BJS".
 * Letters only, upper-cased, padded to 3 so every company yields a stable
 * 3-char stem. Falls back to "EMP" when a name has no letters at all.
 */
export function companyCodePrefix(companyName?: string | null): string {
  const letters = String(companyName ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!letters) return 'EMP';
  return (letters.slice(0, 3) + 'XX').slice(0, 3);
}

/** Parse the numeric suffix of an employee code ("SOR-0007" -> 7), else null. */
export function codeSequence(code?: string | null): number | null {
  const m = /(\d+)\s*$/.exec(String(code ?? ''));
  return m ? parseInt(m[1], 10) : null;
}

/**
 * The next free employee code for a company. Sequence is one past the highest
 * already in use (across every status, so a retired person's code is never
 * reissued), zero-padded to 4 digits.
 */
export function nextEmployeeCode(people: Pick<Person, 'employeeCode'>[], companyName?: string | null): string {
  const prefix = companyCodePrefix(companyName);
  let max = 0;
  for (const p of people) {
    const seq = codeSequence(p.employeeCode);
    if (seq != null && seq > max) max = seq;
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Backfill stable identity onto any people missing it. Idempotent: a person who
 * already has an employeeCode keeps it. Used by the one-time migration and when
 * importing a roster that has no codes yet. Returns a new array; input is not
 * mutated. Codes are assigned in array order so they are deterministic.
 */
export function assignEmployeeCodes(people: Person[], companyName?: string | null): Person[] {
  const prefix = companyCodePrefix(companyName);
  let max = 0;
  for (const p of people) {
    const seq = codeSequence(p.employeeCode);
    if (seq != null && seq > max) max = seq;
  }
  return people.map(p => {
    if (p.employeeCode && codeSequence(p.employeeCode) != null) return p;
    max += 1;
    return { ...p, employeeCode: `${prefix}-${String(max).padStart(4, '0')}` };
  });
}

/** Normalise a name for matching: trimmed, collapsed whitespace, lower-cased. */
export function normalizeName(name: string): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * When someone types a name that matches a retired/archived person, we want to
 * offer "rehire and keep history" instead of silently creating a duplicate.
 * Returns the first non-active person whose name matches, or null.
 */
export function findRehireCandidate(people: Person[], name: string): Person | null {
  const target = normalizeName(name);
  if (!target) return null;
  return people.find(p => !isActive(p) && normalizeName(p.name) === target) ?? null;
}
