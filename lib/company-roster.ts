import type { Person, RosterRole } from '@/components/dashboard/roster';

interface Account { id: string; name: string | null; email: string; employeeId: string | null; role: string }
interface Profile { id: string; employeeCode: string; displayName: string; email: string | null; status: string; title: string | null; teamName: string | null; storeName: string | null }
const roleFor = (role: string | null): RosterRole => ['OWNER', 'REP', 'LEAD', 'ASM', 'INTERN'].includes(role ?? '') ? role as RosterRole : 'REP';
const emailKey = (email?: string | null) => email?.trim().toLowerCase();

/** Append durable identities without overwriting edited roster rows or joining names. */
export function companyRoster(saved: Person[], profiles: Profile[], accounts: Account[]): Person[] {
  const result = saved.map(person => ({ ...person }));
  const hasIdentity = (id: string, code: string | null, email: string | null) => result.some(person => person.id === id || (!!code && person.employeeCode === code) || (!!emailKey(email) && emailKey(person.email) === emailKey(email)));
  const append = (person: Person) => {
    if (result.some(row => row.name.trim().toLowerCase() === person.name.trim().toLowerCase())) person.name = `${person.name} (${person.employeeCode})`;
    result.push(person);
  };
  for (const profile of profiles) {
    if (hasIdentity(profile.id, profile.employeeCode, profile.email)) continue;
    const role = roleFor(profile.title);
    append({ id: profile.id, employeeCode: profile.employeeCode, name: profile.displayName, email: profile.email ?? undefined, role,
      status: profile.status.toLowerCase() === 'retired' ? 'retired' : profile.status.toLowerCase() === 'archived' ? 'archived' : 'active',
      stores: profile.storeName ? [profile.storeName] : [], team: role === 'OWNER' ? '' : profile.teamName ?? '', attendance: 0, weeklyProfit: [] });
  }
  for (const account of accounts) {
    if (hasIdentity(account.id, account.employeeId, account.email)) continue;
    append({ id: account.id, employeeCode: account.employeeId ?? `ACCOUNT-${account.id}`, name: account.name || account.email.split('@')[0], email: account.email,
      role: roleFor(account.role), status: 'active', stores: [], team: '', attendance: 0, weeklyProfit: [] });
  }
  return result;
}
