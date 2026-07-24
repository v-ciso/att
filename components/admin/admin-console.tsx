'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Building2, Plus, Users, Power, Trash2, Copy, Check, ShieldCheck, ChevronDown, ChevronRight, KeyRound,
} from 'lucide-react';

interface AdminUser {
  id: string; email: string; name: string; role: string; disabled: boolean; authBackend: string;
}
interface Company {
  id: string; name: string; slug: string; disabled: boolean; tier: string; seats: number;
  campaign: string; createdAt: string; users: AdminUser[];
}

const ROLES = ['MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN'];

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ title: string; lines: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/companies');
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load');
      setCompanies((await res.json()).companies);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleCompany = async (c: Company) => {
    await fetch('/api/admin/companies', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, disabled: !c.disabled }),
    });
    load();
  };

  return (
    <div className="min-h-screen bg-bg-primary p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold neon-brand flex items-center gap-2">
              <ShieldCheck className="w-7 h-7" style={{ color: 'var(--brand)' }} /> Admin Console
            </h1>
            <p className="text-xs text-text-muted mt-1">Signed in as {adminEmail} · KGV Inc</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard" className="tab-btn inactive">← Dashboard</a>
            <Button size="sm" onClick={() => setCreating(v => !v)}>
              <Plus className="w-4 h-4" /> New company
            </Button>
          </div>
        </div>

        {banner && (
          <Card className="mb-4 p-4 border-accent-green/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-accent-green mb-1">{banner.title}</p>
                {banner.lines.map((l, i) => (
                  <p key={i} className="text-xs text-text-secondary font-mono">{l}</p>
                ))}
                <p className="text-[11px] text-text-muted mt-2">
                  Send these to the customer. They change the password under Settings → Account on first sign-in.
                </p>
              </div>
              <button onClick={() => setBanner(null)} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10" aria-label="Dismiss">✕</button>
            </div>
          </Card>
        )}

        {creating && <CreateCompany onDone={(b) => { setCreating(false); if (b) setBanner(b); load(); }} />}

        {error && <p className="text-sm text-accent-red mb-4">{error}</p>}
        {loading ? (
          <p className="text-sm text-text-muted">Loading companies…</p>
        ) : companies.length === 0 ? (
          <Card className="p-6 text-center">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-secondary">No companies yet. Create your first one.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {companies.map(c => (
              <Card key={c.id} className={cn('p-4', c.disabled && 'opacity-60')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="flex items-center gap-2 text-left min-w-0"
                  >
                    {expanded === c.id ? <ChevronDown className="w-4 h-4 flex-none" /> : <ChevronRight className="w-4 h-4 flex-none" />}
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2">
                        {c.name}
                        {c.disabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-red/20 text-accent-red">SUSPENDED</span>}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {c.slug} · {c.campaign} · {c.users.length}/{c.seats} seats
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCompany(c)}
                      className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors',
                        c.disabled ? 'text-accent-green hover:bg-accent-green/10' : 'text-text-muted hover:text-accent-red hover:bg-accent-red/10')}
                      title={c.disabled ? 'Reinstate — logins work again' : 'Suspend — every login refused, data kept'}
                    >
                      <Power className="w-3.5 h-3.5" /> {c.disabled ? 'Reinstate' : 'Suspend'}
                    </button>
                  </div>
                </div>

                {expanded === c.id && (
                  <CompanyUsers company={c} onChange={load} onBanner={setBanner} />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCompany({ onDone }: { onDone: (banner: { title: string; lines: string[] } | null) => void }) {
  const [form, setForm] = useState({
    companyName: '', ownerEmail: '', ownerName: '', password: '',
    campaign: 'retail', tier: 'single', theme: 'obsidian-gold',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onDone({
        title: `${form.companyName} created (${data.authBackend === 'supabase' ? 'in Supabase Auth' : 'bcrypt fallback'})`,
        lines: [`Sign in: att.soramimarketing.com`, `Email: ${data.ownerEmail}`, `Temp password: ${data.tempPassword}`],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Card className="mb-4 p-5">
      <h2 className="font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4" /> New company</h2>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Company name"><Input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Thompson Wireless" required /></Field>
        <Field label="Owner name"><Input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="Jane Thompson" /></Field>
        <Field label="Owner email"><Input type="email" value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} placeholder="owner@company.com" required /></Field>
        <Field label="Temporary password (optional)"><Input value={form.password} onChange={e => set('password', e.target.value)} placeholder="auto-generate if blank" /></Field>
        <Field label="Campaign">
          <Select value={form.campaign} onChange={v => set('campaign', v)} options={[['retail', 'Retail EDM'], ['b2b', 'B2B (50% split)']]} />
        </Field>
        <Field label="Plan">
          <Select value={form.tier} onChange={v => set('tier', v)} options={[['single', 'Single operator (1)'], ['team', 'Team (up to 5)']]} />
        </Field>
        <Field label="Theme">
          <Select value={form.theme} onChange={v => set('theme', v)} options={[['obsidian-gold', 'Obsidian & Gold'], ['command-blue', 'Command Blue'], ['emerald', 'Emerald']]} />
        </Field>
        <div className="sm:col-span-2 flex items-center gap-3 mt-1">
          <Button type="submit" loading={busy} disabled={busy}>Create company</Button>
          {err && <span className="text-xs text-accent-red">{err}</span>}
        </div>
      </form>
    </Card>
  );
}

function CompanyUsers({ company, onChange, onBanner }: {
  company: Company; onChange: () => void; onBanner: (b: { title: string; lines: string[] }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'VIEWER', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const atCapacity = company.users.length >= company.seats;

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, marketOwnerId: company.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onBanner({ title: `${data.email} added to ${company.name}`, lines: [`Email: ${data.email}`, `Temp password: ${data.tempPassword}`, `Access: ${data.role}`] });
      setForm({ email: '', name: '', role: 'VIEWER', password: '' });
      setAdding(false);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: AdminUser) => {
    if (!confirm(`Remove ${u.email}? Their login is deleted; the company keeps their production history.`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: u.id }),
    });
    if (!res.ok) alert((await res.json()).error);
    onChange();
  };

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-text-secondary flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Users</p>
        <button
          onClick={() => setAdding(v => !v)}
          disabled={atCapacity}
          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors',
            atCapacity ? 'text-text-muted/40 cursor-not-allowed' : 'text-text-secondary hover:text-white hover:bg-white/5')}
          title={atCapacity ? 'Seat limit reached — upgrade the plan first' : 'Add a login'}
        >
          <Plus className="w-3 h-3" /> Add user
        </button>
      </div>

      <div className="space-y-1.5 mb-2">
        {company.users.map(u => (
          <div key={u.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{u.email}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-text-muted">{u.role}</span>
              {u.authBackend === 'supabase' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green flex items-center gap-1" title="Managed in Supabase Auth — OAuth/MFA available from the Supabase console">
                  <KeyRound className="w-2.5 h-2.5" /> Supabase
                </span>
              )}
            </span>
            {u.role !== 'OWNER' && (
              <button onClick={() => removeUser(u)} className="p-1 rounded text-text-muted hover:text-accent-red hover:bg-accent-red/10" aria-label={`Remove ${u.email}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <form onSubmit={addUser} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="person@company.com" type="email" required className="sm:col-span-2" />
          <Select value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={ROLES.map(r => [r, r] as [string, string])} />
          <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="temp pw (optional)" />
          <div className="sm:col-span-4 flex items-center gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={busy}>Add</Button>
            {err && <span className="text-xs text-accent-red">{err}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-text-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[rgba(var(--brand-rgb),0.5)]"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
