'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart } from '@/components/charts/chart-wrapper';
import { PieChart3D } from '@/components/charts/chart-3d';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import {
  FileText, TrendingUp, Zap, DollarSign, Star, Trophy, CalendarCheck, Target, Users,
  Building2, MapPin, PieChart, Maximize2, Minimize2, ChevronDown, Sparkles, ClipboardList,
} from 'lucide-react';
import { MeetingTracker } from '@/components/dashboard/dashboard-components';
import { CommissionEngine, PnlEditor, TeamData } from '@/components/dashboard/editable-sections';
import { ReportTemplate } from '@/components/dashboard/report-template';
import { RosterManager, loadPeople } from '@/components/dashboard/roster';
import { Competition } from '@/components/dashboard/competition';
import { ScheduleBoard } from '@/components/dashboard/schedule-board';
import { ImportReport } from '@/components/dashboard/import-report';
import { ProfileDrawer } from '@/components/dashboard/profile-drawer';
import { DailyTracker } from '@/components/dashboard/daily-tracker';
import {
  Period, PERIOD_LABELS, aggregateSales, loadSales, saveSales, loadCommission,
  generateDemoSales, Aggregate, PersonStats, loadAttendance, attendanceForDate, todayStr,
} from '@/lib/sales';
import { Editable, parseNum, useLocalState } from '@/components/dashboard/editable-sections';

const VALID_TABS = ['dashboard', 'tracker', 'roster', 'leaderboard', 'meeting', 'schedule', 'competition', 'pnl', 'commission', 'import'];

// Renders overlays inside the fullscreened element when presentation mode is
// active — otherwise drawers opened during Present would be invisible until
// the user exits fullscreen.
function FsPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    setTarget(document.fullscreenElement ?? document.body);
    const onFs = () => setTarget(document.fullscreenElement ?? document.body);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  if (!target) return null;
  return createPortal(children, target);
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function CountUpValue({ value }: { value: string }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const match = value.match(/^([^0-9]*)([0-9,.]+)(.*)$/);
    if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr.replace(/,/g, ''));
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(`${prefix}${(target * eased).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'purple' | 'green' | 'yellow';
  onClick?: () => void;
  className?: string;
}

function StatCard({ label, value, sub, icon: Icon, color, onClick, className }: StatCardProps) {
  const colorClasses = { blue: 'text-accent-blue', purple: 'text-accent-purple', green: 'text-accent-green', yellow: 'text-accent-yellow' };
  const neonClasses = { blue: 'neon-text-blue', purple: 'neon-text-purple', green: 'neon-text-green', yellow: 'neon-text-yellow' };

  return (
    <Card
      className={cn('stat-card pulse-glow', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={onClick ? 'Click to see who did what' : undefined}
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <div className="p-1.5 rounded-lg bg-white/5">
          <Icon className={`w-3 h-3 ${colorClasses[color]}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${neonClasses[color]}`}>
        <CountUpValue value={value} />
      </p>
      <p className="text-[10px] text-text-secondary">{sub}</p>
    </Card>
  );
}

function TabButton({ children, isActive, onClick }: { children: React.ReactNode; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`tab-btn px-3 py-1.5 rounded-lg text-xs font-medium border transition ${isActive ? 'active' : 'inactive'}`}>
      {children}
    </button>
  );
}

function PeriodChips({ period, onChange, options }: { period: Period; onChange: (p: Period) => void; options?: Period[] }) {
  const list = options ?? (['daily', 'weekly', 'monthly', 'all'] as Period[]);
  return (
    <div className="flex gap-1.5">
      {list.map(p => (
        <button key={p} onClick={() => onChange(p)} className={cn('tab-btn', period === p ? 'active' : 'inactive')}>
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

// Multi-select store dropdown: one store, several, or all
function StoreSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const label = selected.length === 0 ? 'All Stores' : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="tab-btn inactive flex items-center gap-1.5">
        <MapPin className="w-3 h-3" /> {label} <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-48 max-h-72 overflow-y-auto p-2 rounded-xl bg-bg-secondary border border-border-strong shadow-glass space-y-0.5">
          <button
            onClick={() => onChange([])}
            className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors', selected.length === 0 ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-white/5 hover:text-white')}
          >
            All Stores
          </button>
          {options.map(store => {
            const active = selected.includes(store);
            return (
              <button
                key={store}
                onClick={() => onChange(active ? selected.filter(s => s !== store) : [...selected, store])}
                className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between', active ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-white/5 hover:text-white')}
              >
                {store} {active && '✓'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// "Who did what" — opens from any KPI tile
function ProductionDrawer({ agg, period, onClose, onOpenProfile }: { agg: Aggregate; period: Period; onClose: () => void; onOpenProfile: (name: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Production breakdown">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{PERIOD_LABELS[period]} Production — who did what</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>
        {agg.perPerson.length === 0 ? (
          <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5">No sales in this period yet — log them in the Daily Tracker.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                <th className="pb-2">Rep</th><th className="pb-2 text-right">Lines</th><th className="pb-2 text-right">Internet</th>
                <th className="pb-2 text-right">Next Up</th><th className="pb-2 text-right">Generated</th><th className="pb-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {agg.perPerson.map(p => (
                <tr key={p.person} className="hover:bg-white/5 transition-colors">
                  <td className="py-2">
                    <button onClick={() => onOpenProfile(p.person)} className="font-medium hover:text-accent-blue transition-colors">{p.person}</button>
                  </td>
                  <td className="py-2 text-right">{p.lines}</td>
                  <td className="py-2 text-right text-accent-cyan">{p.internet}</td>
                  <td className="py-2 text-right text-accent-red">{p.nextUps}</td>
                  <td className="py-2 text-right text-accent-green font-bold">{formatCurrency(p.revenue)}</td>
                  <td className="py-2 text-right text-accent-blue font-semibold">{formatCurrency(p.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Two-level product mix: top slices are the business categories (New Lines /
// Upgrades / Internet); clicking one breaks it down into its plans
// (Premium / Extra / Value…), each with its Next Up attach rate.
interface MixCategory {
  key: string;
  label: string;
  color: string;
  plans: string[];
  qty: number;
  revenue: number;
  nextUps: number;
  commission: number;
}

function buildMixCategories(agg: Aggregate, commission: ReturnType<typeof loadCommission>): MixCategory[] {
  const linePlans = commission.phonePlans.filter(p => !p.name.toLowerCase().includes('upgrade')).map(p => p.name);
  const upgradePlans = commission.phonePlans.filter(p => p.name.toLowerCase().includes('upgrade')).map(p => p.name);
  const internetPlans = commission.internet.map(p => p.name);
  const defs = [
    { key: 'lines', label: 'New Lines', color: '#3B82F6', plans: linePlans },
    { key: 'upgrades', label: 'Upgrades', color: '#D97706', plans: upgradePlans },
    { key: 'internet', label: 'Internet', color: '#0891B2', plans: internetPlans },
  ];
  return defs
    .map(def => {
      const sums = def.plans.reduce(
        (acc, plan) => {
          const s = agg.perPlan.get(plan);
          if (s) { acc.qty += s.qty; acc.revenue += s.revenue; acc.nextUps += s.nextUps; acc.commission += s.commission; }
          return acc;
        },
        { qty: 0, revenue: 0, nextUps: 0, commission: 0 }
      );
      return { ...def, ...sums };
    })
    .filter(c => c.qty > 0);
}

function SliceDrawer({ category, agg, onClose }: { category: MixCategory; agg: Aggregate; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const planRows = category.plans
    .map(plan => ({ plan, stats: agg.perPlan.get(plan) }))
    .filter(r => r.stats && r.stats.qty > 0) as Array<{ plan: string; stats: { qty: number; revenue: number; nextUps: number } }>;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${category.label} details`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: category.color }} />
            {category.label}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Sold</p>
            <p className="text-xl font-bold" style={{ color: category.color }}>{category.qty}</p>
          </div>
          {category.key === 'lines' ? (
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Next Ups</p>
              <p className="text-xl font-bold text-accent-red">{category.nextUps}</p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-white/5 text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Rep Commission</p>
              <p className="text-xl font-bold text-accent-blue">{formatCurrency(category.commission)}</p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Generated</p>
            <p className="text-xl font-bold text-accent-green">{formatCurrency(category.revenue)}</p>
          </div>
        </div>

        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Breakdown by plan</p>
        <div className="space-y-1.5">
          {planRows.map(({ plan, stats }) => (
            <div key={plan} className="p-2.5 rounded-lg bg-white/5">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">{plan}</span>
                <span>
                  <span className="text-white font-semibold">{stats.qty}</span>
                  <span className="text-text-muted"> sold · </span>
                  <span className="text-accent-green font-semibold">{formatCurrency(stats.revenue)}</span>
                </span>
              </div>
              {category.key === 'lines' && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-bg-tertiary">
                    <div className="h-full rounded-full bg-accent-red" style={{ width: `${stats.qty > 0 ? (stats.nextUps / stats.qty) * 100 : 0}%` }} />
                  </div>
                  <span className="text-[9px] text-text-muted whitespace-nowrap">{stats.nextUps} Next Up ({stats.qty > 0 ? Math.round((stats.nextUps / stats.qty) * 100) : 0}%)</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-3">
          Office totals at current tier &amp; store multipliers — edit payouts in the Commission tab.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'dashboard');

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) setActiveTab(tabParam);
    else if (!tabParam) setActiveTab('dashboard');
  }, [tabParam]);

  const [pendingPresent, setPendingPresent] = useState(false);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'meeting') setPendingPresent(true);
    router.replace(tab === 'dashboard' ? '/dashboard' : `/dashboard?tab=${tab}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Derived data core: sales entries → everything -----------------------
  const [dataVersion, setDataVersion] = useState(0);
  const bump = useCallback(() => setDataVersion(v => v + 1), []);

  // Re-read on tab return too (edits on other tabs change commission/roster)
  useEffect(() => { bump(); }, [activeTab, bump]);

  // Live reactivity: any edit anywhere (stores, sales, teams, goals) fires
  // 'se:data' → recompute every derived view. Deferred + debounced so it can
  // never run during another component's render (which caused a crash loop).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onData = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => bump(), 120);
    };
    window.addEventListener('se:data', onData);
    window.addEventListener('storage', onData);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('se:data', onData);
      window.removeEventListener('storage', onData);
    };
  }, [bump]);

  const [period, setPeriod] = useState<Period>('weekly');
  const [storeSel, setStoreSel] = useState<string[]>([]);
  const [pickDate, setPickDate] = useState(''); // specific day report, e.g. last Monday

  const commission = useMemo(loadCommission, [dataVersion]);
  const people = useMemo(loadPeople, [dataVersion]);
  const sales = useMemo(loadSales, [dataVersion]);

  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    commission.stores.forEach(s => set.add(s.name));
    people.forEach(p => (p.stores ?? []).forEach(s => set.add(s)));
    sales.forEach(s => s.store && set.add(s.store));
    return Array.from(set);
  }, [commission, people, sales]);

  const agg = useMemo(
    () => aggregateSales(sales, commission, { period, stores: storeSel, date: pickDate || undefined }),
    [sales, commission, period, storeSel, pickDate]
  );
  const aggDaily = useMemo(
    () => aggregateSales(sales, commission, { period: 'daily', stores: storeSel }),
    [sales, commission, storeSel]
  );
  const aggWeekly = useMemo(
    () => aggregateSales(sales, commission, { period: 'weekly', stores: storeSel }),
    [sales, commission, storeSel]
  );
  const aggMonthly = useMemo(
    () => aggregateSales(sales, commission, { period: 'monthly', stores: storeSel }),
    [sales, commission, storeSel]
  );
  const aggYearly = useMemo(
    () => aggregateSales(sales, commission, { period: 'yearly', stores: storeSel }),
    [sales, commission, storeSel]
  );
  const pnlDerived = useMemo(() => ({
    daily: { revenue: aggDaily.revenue, chargebacks: aggDaily.chargebacks },
    weekly: { revenue: aggWeekly.revenue, chargebacks: aggWeekly.chargebacks },
    monthly: { revenue: aggMonthly.revenue, chargebacks: aggMonthly.chargebacks },
    yearly: { revenue: aggYearly.revenue, chargebacks: aggYearly.chargebacks },
  }), [aggDaily, aggWeekly, aggMonthly, aggYearly]);

  const hasData = sales.length > 0;
  const premiumMix = agg.lines > 0 ? ((agg.premium / agg.lines) * 100).toFixed(1) : '0.0';

  const generateDemo = () => {
    saveSales(generateDemoSales(people, commission));
    bump();
  };

  // Trend: switchable range — 7 days / 8 weeks / 12 months (respects stores)
  const [trendRange, setTrendRange] = useState<'days' | 'weeks' | 'months'>('days');
  const trendData = useMemo(() => {
    // aggYearly.perDay is already store-filtered office revenue per date
    const labels: string[] = [];
    const data: number[] = [];
    const now = new Date();
    if (trendRange === 'days') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        data.push(aggYearly.perDay.get(key) ?? 0);
      }
    } else if (trendRange === 'weeks') {
      for (let w = 7; w >= 0; w--) {
        const start = new Date(); start.setDate(now.getDate() - (w + 1) * 7 + 1);
        let sum = 0;
        for (let d = 0; d < 7; d++) {
          const day = new Date(start); day.setDate(start.getDate() + d);
          sum += aggYearly.perDay.get(day.toISOString().slice(0, 10)) ?? 0;
        }
        labels.push(start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        data.push(sum);
      }
    } else {
      for (let m = 11; m >= 0; m--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const prefix = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        let sum = 0;
        aggYearly.perDay.forEach((v, k) => { if (k.startsWith(prefix)) sum += v; });
        labels.push(monthStart.toLocaleDateString('en-US', { month: 'short' }));
        data.push(sum);
      }
    }
    return {
      labels,
      datasets: [{
        label: 'Revenue',
        data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#3B82F6',
      }],
    };
  }, [trendRange, aggYearly]);

  // Pie: business categories (New Lines / Upgrades / Internet) — click for plans
  const mixCategories = useMemo(() => buildMixCategories(agg, commission), [agg, commission]);
  const pie = useMemo(() => ({
    labels: mixCategories.map(c => c.label),
    values: mixCategories.map(c => c.qty),
    colors: mixCategories.map(c => c.color),
  }), [mixCategories]);

  const [drillCat, setDrillCat] = useState<MixCategory | null>(null);
  const [showProduction, setShowProduction] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [teamDrawerName, setTeamDrawerName] = useState<string | null>(null);
  const [expandChart, setExpandChart] = useState<'trend' | 'mix' | null>(null);

  // Leaderboard rows: roster people + their derived period stats
  const leaderboardRows = useMemo(() => {
    const statsByName = new Map(agg.perPerson.map(p => [p.person.toLowerCase(), p]));
    const rows = people.map(person => {
      const s = statsByName.get(person.name.toLowerCase());
      return {
        person,
        stats: s ?? { person: person.name, store: person.stores?.[0] ?? '', lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0 } as PersonStats,
      };
    });
    return rows.sort((a, b) => b.stats.revenue - a.stats.revenue);
  }, [people, agg]);

  // Meeting mode: its own period + live team stats from members' sales
  const [meetingPeriod, setMeetingPeriod] = useState<Period>('daily');
  const meetingAgg = useMemo(
    () => aggregateSales(sales, commission, { period: meetingPeriod, stores: storeSel }),
    [sales, commission, meetingPeriod, storeSel]
  );
  const meetingTeams = useMemo(() => {
    let teams: TeamData[] = [];
    try { teams = JSON.parse(localStorage.getItem('se-teams-v2') || '[]'); } catch { /* none */ }
    const statsByName = new Map(meetingAgg.perPerson.map(p => [p.person.toLowerCase(), p]));
    return teams.map(team => {
      const memberNames = people
        .filter(p => p.team === team.name)
        .map(p => p.name)
        .concat([team.lead, team.asm].filter(n => people.some(p => p.name.toLowerCase() === n.toLowerCase())));
      const unique = Array.from(new Set(memberNames.map(n => n.toLowerCase())));
      const sum = unique.reduce(
        (acc, n) => {
          const s = statsByName.get(n);
          if (s) { acc.lines += s.lines; acc.nextUps += s.nextUps; acc.internet += s.internet; acc.revenue += s.revenue; }
          return acc;
        },
        { lines: 0, nextUps: 0, internet: 0, revenue: 0 }
      );
      return { ...team, derived: sum };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingAgg, people, dataVersion]);

  const avgAttendance = people.length
    ? Math.round(people.reduce((a, p) => a + p.attendance, 0) / people.length * 10) / 10
    : 0;

  // Attendance card prefers marked records (yesterday, else today) from the tracker
  const attToday = useMemo(() => {
    const book = loadAttendance();
    const yesterday = attendanceForDate(book, todayStr(-1));
    if (yesterday.marked > 0) return { ...yesterday, date: 'yesterday' };
    const today = attendanceForDate(book, todayStr());
    if (today.marked > 0) return { ...today, date: 'today' };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  // Goals: set at the morning meeting — targets are editable and persist
  const { state: goalTargets, setState: setGoalTargets } = useLocalState(
    'se-goals-v1',
    { lines: 200, premium: 80 }
  );

  // Weekly commitments: each rep calls their number at the morning meeting —
  // accountability, not a quota
  const { state: commits, setState: setCommits } = useLocalState<Record<string, number>>('se-commit-v1', {});

  const goals = [
    { key: 'lines' as const, label: 'Total Lines', current: aggWeekly.lines, target: goalTargets.lines, color: 'blue' },
    { key: 'premium' as const, label: 'Premium', current: aggWeekly.premium, target: goalTargets.premium, color: 'purple' },
  ];

  // Presentation mode — button flips between Present and Exit
  const meetingRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const togglePresentation = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else meetingRef.current?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeTab !== 'meeting') return;
      if ((document.activeElement as HTMLElement | null)?.isContentEditable) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') togglePresentation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'meeting' && pendingPresent) {
      setPendingPresent(false);
      meetingRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, [activeTab, pendingPresent]);

  // PDF: crisp print-based export (vector text, browser Save as PDF)
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!exporting) return;
    const prevTitle = document.title;
    document.title = `Sales_Engine_Report_${new Date().toISOString().slice(0, 10)}`;
    const done = () => { document.title = prevTitle; setExporting(false); };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [exporting]);

  const reportRows = useMemo(
    () => leaderboardRows
      .filter(r => r.stats.revenue > 0 || r.stats.lines > 0 || r.stats.internet > 0)
      .map(r => ({
        name: r.person.name, store: (r.person.stores ?? []).join(', '),
        lines: r.stats.lines, premium: r.stats.premium, fiber: r.stats.internet,
        commission: r.stats.revenue, role: r.person.role.toLowerCase(),
      })),
    [leaderboardRows]
  );

  return (
    <DashboardLayout>
      {/* Header — raised stacking context so its dropdowns paint over the cards below */}
      <div className="slide-in relative z-40 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold neon-brand">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">AT&T campaign · white-label ready</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodChips period={period} onChange={(p) => { setPeriod(p); setPickDate(''); }} />
          <span className="flex items-center gap-1">
            <input
              type="date"
              value={pickDate}
              onChange={e => setPickDate(e.target.value)}
              className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent-blue/50 cursor-pointer"
              aria-label="Report a specific date"
              title="Pull one specific day (e.g. last Monday)"
            />
            {pickDate && (
              <button onClick={() => setPickDate('')} className="p-1 rounded text-text-muted hover:text-accent-red transition-colors" aria-label="Clear date">✕</button>
            )}
          </span>
          <StoreSelect options={storeOptions} selected={storeSel} onChange={setStoreSel} />
          <Button onClick={() => setExporting(true)} size="sm">
            <FileText className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Campaign badges */}
      <div className="slide-in mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="green" className="text-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /> Live
        </Badge>
        <Badge variant="gray" className="text-xs flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> AT&T Retailer
        </Badge>
        <Badge variant="gray" className="text-xs flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> {storeOptions.length} Stores
        </Badge>
        <Badge variant="blue" className="text-xs">
          {pickDate ? `Date: ${pickDate}` : `${PERIOD_LABELS[period]} view`}{storeSel.length ? ` · ${storeSel.join(', ')}` : ' · all stores'}
        </Badge>
      </div>

      {/* Tabs — moved above content so switching changes the view immediately */}
      <div className="slide-in mb-4 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
        <TabButton isActive={activeTab === 'dashboard'} onClick={() => switchTab('dashboard')}>Dashboard</TabButton>
        <TabButton isActive={activeTab === 'tracker'} onClick={() => switchTab('tracker')}>Daily Tracker</TabButton>
        <TabButton isActive={activeTab === 'roster'} onClick={() => switchTab('roster')}>Roster</TabButton>
        <TabButton isActive={activeTab === 'leaderboard'} onClick={() => switchTab('leaderboard')}>Leaderboard</TabButton>
        <TabButton isActive={activeTab === 'meeting'} onClick={() => switchTab('meeting')}>Meeting Mode</TabButton>
        <TabButton isActive={activeTab === 'schedule'} onClick={() => switchTab('schedule')}>Schedule</TabButton>
        <TabButton isActive={activeTab === 'competition'} onClick={() => switchTab('competition')}>Competition</TabButton>
        <TabButton isActive={activeTab === 'pnl'} onClick={() => switchTab('pnl')}>P&L</TabButton>
        <TabButton isActive={activeTab === 'commission'} onClick={() => switchTab('commission')}>Commission</TabButton>
        <TabButton isActive={activeTab === 'import'} onClick={() => switchTab('import')}>Import</TabButton>
      </div>

      {activeTab === 'dashboard' && (
        <div id="tab-dashboard" className="tab-panel">
          {!hasData && (
            <Card className="mb-4 p-5 border-accent-blue/30">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">No sales logged yet — the whole dashboard derives from the Daily Tracker.</p>
                  <p className="text-xs text-text-secondary mt-0.5">Log real sales, or fill everything with realistic sample data for a demo.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => switchTab('tracker')}><ClipboardList className="w-3.5 h-3.5" /> Open Tracker</Button>
                  <Button variant="secondary" size="sm" onClick={generateDemo}><Sparkles className="w-3.5 h-3.5" /> Generate Demo Data</Button>
                </div>
              </div>
            </Card>
          )}

          {/* KPIs — derived; click for the who-did-what breakdown */}
          <div className="slide-in grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
            <StatCard label={pickDate ? `Lines · ${pickDate}` : `${PERIOD_LABELS[period]} Lines`} value={String(agg.lines)} sub={`${agg.nextUps} next ups attached`} icon={TrendingUp} color="blue" onClick={() => setShowProduction(true)} className="stagger-1" />
            <StatCard label="Internet" value={String(agg.internet)} sub={`${aggDaily.internet} in daily window`} icon={Zap} color="purple" onClick={() => setShowProduction(true)} className="stagger-2" />
            <StatCard label="Office Generated" value={formatCurrency(agg.revenue)} sub={`${formatCurrency(agg.commission)} rep commissions`} icon={DollarSign} color="green" onClick={() => setShowProduction(true)} className="stagger-3" />
            <StatCard label="Premium Mix" value={`${premiumMix}%`} sub={`${agg.premium} premium lines`} icon={Star} color="yellow" onClick={() => setShowProduction(true)} className="stagger-4" />
          </div>

          {/* Charts */}
          <div className="slide-in grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent-blue" /> Revenue Trend
                  </span>
                  <span className="flex items-center gap-1">
                    {([['days', '7D'], ['weeks', '8W'], ['months', '12M']] as const).map(([r, label]) => (
                      <button key={r} onClick={() => setTrendRange(r)} className={cn('tab-btn !px-2 !py-0.5 text-[10px]', trendRange === r ? 'active' : 'inactive')}>
                        {label}
                      </button>
                    ))}
                    <button onClick={() => setExpandChart('trend')} className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Expand revenue trend" title="Enlarge">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ position: 'relative', height: '180px', width: '100%' }}>
                  <LineChart data={trendData} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-accent-purple" /> Product Mix
                    <span className="text-[10px] text-text-muted font-normal uppercase tracking-wider">3D · click a slice for the breakdown</span>
                  </span>
                  <button onClick={() => setExpandChart('mix')} className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Expand product mix" title="Enlarge">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pie.values.length > 0 ? (
                  <>
                    <PieChart3D data={pie.values} labels={pie.labels} colors={pie.colors} height={220} onSliceClick={(i) => setDrillCat(mixCategories[i])} />
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                      {mixCategories.map(cat => (
                        <button key={cat.key} onClick={() => setDrillCat(cat)} className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-white transition-colors">
                          <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                          {cat.label} ({cat.qty})
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-muted text-center py-14">No product mix yet — log sales in the Daily Tracker.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top performers + attendance + goals */}
          <div className="slide-in grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent-yellow" /> Top Performers · {PERIOD_LABELS[period]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agg.perPerson.slice(0, 3).map((p, i) => (
                    <button key={p.person} onClick={() => setProfileName(p.person)} className="w-full flex items-center gap-3 p-3 rounded-xl glass border border-border-subtle hover:border-border-strong transition-all text-left">
                      <span className={cn('text-xl font-bold', i === 0 && 'text-accent-yellow', i === 1 && 'text-text-secondary', i === 2 && 'text-accent-orange')}>#{i + 1}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{p.person}</p>
                        <p className="text-xs text-text-secondary">{p.store}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-accent-green text-sm">{formatCurrency(p.revenue)}</p>
                        <p className="text-xs text-text-secondary">{p.lines} lines · {p.internet} internet</p>
                      </div>
                    </button>
                  ))}
                  {agg.perPerson.length === 0 && <p className="text-xs text-text-muted p-3">No production in this period yet.</p>}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2"><CalendarCheck className="w-4 h-4" /> Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  {attToday ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-center"><p className="text-xl font-bold text-accent-green">{attToday.present}</p><p className="text-[10px] text-text-muted">Present</p></div>
                        <div className="text-center"><p className="text-xl font-bold text-accent-yellow">{attToday.late}</p><p className="text-[10px] text-text-muted">Late</p></div>
                        <div className="text-center"><p className="text-xl font-bold text-accent-red">{attToday.absent}</p><p className="text-[10px] text-text-muted">Absent</p></div>
                      </div>
                      <p className="text-[10px] text-text-muted text-center">marked {attToday.date} in the Daily Tracker</p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl font-bold neon-text-green text-center">{avgAttendance}%</p>
                      <p className="text-[10px] text-text-muted text-center mt-1">roster average — mark today in the Daily Tracker</p>
                      <div className="w-full h-1.5 rounded-full bg-bg-tertiary mt-2">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-blue" style={{ width: `${avgAttendance}%` }} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2"><Target className="w-4 h-4 text-accent-green" /> Weekly Goals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {goals.map(goal => (
                      <div key={goal.label}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-text-secondary">{goal.label}</span>
                          <span className={cn('font-medium', goal.color === 'blue' ? 'text-accent-blue' : 'text-accent-purple')}>
                            {formatNumber(goal.current)} /{' '}
                            <Editable
                              value={String(goal.target)}
                              onCommit={(v) => setGoalTargets(prev => ({ ...prev, [goal.key]: Math.max(1, parseNum(v)) }))}
                            />
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%`, background: goal.color === 'blue' ? 'linear-gradient(to right, #3B82F6, #60A5FA)' : 'linear-gradient(to right, #A855F7, #C084FC)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tracker' && (
        <div id="tab-tracker" className="tab-panel">
          <Card className="p-5">
            <DailyTracker onDataChange={bump} />
          </Card>
        </div>
      )}

      {activeTab === 'roster' && (
        <div id="tab-roster" className="tab-panel">
          <Card className="p-5">
            <RosterManager onOpenProfile={(name) => setProfileName(name)} />
          </Card>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div id="tab-leaderboard" className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold neon-brand">
                Team Leaderboard
                <span className="text-xs text-text-muted font-normal ml-2">{PERIOD_LABELS[period]} · derived from the Daily Tracker</span>
              </h2>
              <div className="flex items-center gap-2">
                <PeriodChips period={period} onChange={setPeriod} />
                <Button size="sm" onClick={() => switchTab('roster')}>+ Add Rep (Roster)</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                    <th className="pb-2">Rank</th><th className="pb-2">Rep</th><th className="pb-2">Store</th><th className="pb-2">Team</th>
                    <th className="pb-2 text-right">Lines</th><th className="pb-2 text-right">Premium</th>
                    <th className="pb-2 text-right">Internet</th><th className="pb-2 text-right">Next Up</th>
                    <th className="pb-2 text-right" title="Total office payout this rep generated">Generated</th>
                    <th className="pb-2 text-right" title="Their commission at your rates">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {leaderboardRows
                    .filter(r => storeSel.length === 0 || storeSel.some(s => (r.person.stores ?? []).some(ps => ps.toLowerCase() === s.toLowerCase())))
                    .map((row, i) => (
                      <tr key={row.person.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2"><span className={cn('font-bold', i === 0 && 'text-yellow-400', i === 1 && 'text-gray-400', i === 2 && 'text-orange-400', i > 2 && 'text-gray-500')}>#{i + 1}</span></td>
                        <td className="py-2">
                          <button onClick={() => setProfileName(row.person.name)} className="font-medium hover:text-accent-blue transition-colors">{row.person.name}</button>
                        </td>
                        <td className="py-2 text-text-secondary">{(row.person.stores ?? []).join(', ')}</td>
                        <td className="py-2">
                          {row.person.team
                            ? <span className="px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 text-[10px]">{row.person.team}</span>
                            : <span className="text-text-muted text-[10px]">—</span>}
                        </td>
                        <td className="py-2 text-right font-semibold">{row.stats.lines}</td>
                        <td className="py-2 text-right text-accent-purple">{row.stats.premium}</td>
                        <td className="py-2 text-right text-accent-cyan">{row.stats.internet}</td>
                        <td className="py-2 text-right text-accent-red">{row.stats.nextUps}</td>
                        <td className="py-2 text-right text-accent-green font-bold">{formatCurrency(row.stats.revenue)}</td>
                        <td className="py-2 text-right text-accent-blue font-semibold">{formatCurrency(row.stats.commission)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Click a name for profile &amp; roadmap · numbers come from the Daily Tracker priced at your Commission settings
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'meeting' && (
        <div id="tab-meeting" ref={meetingRef} className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold neon-brand">Meeting Mode</h2>
              <div className="flex items-center gap-2">
                <PeriodChips period={meetingPeriod} onChange={setMeetingPeriod} options={['daily', 'weekly', 'all']} />
                <Button size="sm" onClick={togglePresentation}>
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullscreen ? 'Exit' : 'Present'}
                </Button>
              </div>
            </div>

            {/* Every tracker follows the selected meeting period */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <MeetingTracker label={`${PERIOD_LABELS[meetingPeriod]} Lines`} value={String(meetingAgg.lines)} color="blue" size="2xl" />
              <MeetingTracker label={`Top Rep · ${PERIOD_LABELS[meetingPeriod]}`} value={meetingAgg.perPerson[0]?.person ?? '—'} color="purple" size="lg" />
              <MeetingTracker
                label="Attendance"
                value={attToday
                  ? `${Math.round(((attToday.present + attToday.late * 0.5) / Math.max(1, attToday.marked)) * 100)}%`
                  : `${avgAttendance}%`}
                color="green" size="2xl"
              />
              <MeetingTracker label={`${PERIOD_LABELS[meetingPeriod]} Generated`} value={formatCurrency(meetingAgg.revenue)} color="yellow" size="2xl" />
            </div>

            {/* Weekly goals — set the targets right here in the meeting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {goals.map(goal => (
                <div key={goal.label} className="glass rounded-xl p-3 border border-border-subtle">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-accent-green" /> Weekly Goal · {goal.label}</span>
                    <span className={cn('font-medium', goal.color === 'blue' ? 'text-accent-blue' : 'text-accent-purple')}>
                      {formatNumber(goal.current)} /{' '}
                      <Editable
                        value={String(goal.target)}
                        onCommit={(v) => setGoalTargets(prev => ({ ...prev, [goal.key]: Math.max(1, parseNum(v)) }))}
                      />
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%`, background: goal.color === 'blue' ? 'linear-gradient(to right, #3B82F6, #60A5FA)' : 'linear-gradient(to right, #A855F7, #C084FC)' }} />
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Teams · live from members&apos; sales
              <span className="text-[10px] text-text-muted font-normal">(build teams on the Roster tab)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meetingTeams.map((team, i) => (
                <button
                  key={i}
                  onClick={() => setTeamDrawerName(team.name)}
                  className={cn('glass rounded-xl p-4 border text-left hover:border-border-strong hover:bg-white/[0.04] transition-all', { blue: 'border-accent-blue/10', purple: 'border-accent-purple/10', cyan: 'border-accent-cyan/10', yellow: 'border-accent-yellow/10' }[team.color] ?? 'border-accent-blue/10')}
                  title={`Open ${team.name}'s stats`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{team.name}</span>
                    <span className="text-xs text-accent-green font-semibold">{formatCurrency(team.derived.revenue)}</span>
                  </div>
                  <p className="text-[10px] text-text-muted mb-2">Lead: <span className="text-accent-purple">{team.lead}</span> · ASM: <span className="text-accent-yellow">{team.asm}</span></p>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Lines: <span className="text-white">{team.derived.lines}</span></span>
                    <span>Next Ups: <span className="text-white">{team.derived.nextUps}</span></span>
                    <span>Internet: <span className="text-white">{team.derived.internet}</span></span>
                  </div>
                </button>
              ))}
              {meetingTeams.length === 0 && (
                <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 md:col-span-2">No teams yet — build them with drag &amp; drop on the Roster tab.</p>
              )}
            </div>
            {/* Weekly commitments — reps call their number at the meeting */}
            <h3 className="text-sm font-semibold text-text-secondary mt-5 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-yellow" /> This Week&apos;s Commitments
              <span className="text-[10px] text-text-muted font-normal">(what everyone called — accountability, not a quota)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {people.filter(p => p.role !== 'ASM').map(p => {
                const committed = commits[p.name] ?? 0;
                const actual = aggWeekly.perPerson.find(s => s.person.toLowerCase() === p.name.toLowerCase())?.lines ?? 0;
                const pct = committed > 0 ? Math.min(100, (actual / committed) * 100) : 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03]">
                    <span className="text-xs font-medium w-32 truncate">{p.name}</span>
                    <span className="text-[10px] text-text-muted">
                      called{' '}
                      <Editable
                        value={String(committed)}
                        onCommit={(v) => setCommits(prev => ({ ...prev, [p.name]: Math.max(0, parseNum(v)) }))}
                        className="text-accent-yellow font-semibold"
                      />{' '}
                      lines
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-bg-tertiary">
                      <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-yellow to-accent-green')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={cn('text-[10px] font-semibold w-14 text-right', actual >= committed && committed > 0 ? 'text-accent-green' : 'text-text-secondary')}>
                      {actual}/{committed || '—'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Monthly competition — edit the prize/metric live in the meeting */}
            <div className="mt-5 pt-4 border-t border-border-subtle">
              <Competition sales={sales} commission={commission} storeOptions={storeOptions} compact />
            </div>

            {/* Schedule board — same component as the Schedule tab */}
            <div className="mt-5 pt-4 border-t border-border-subtle">
              <ScheduleBoard people={people} storeOptions={storeOptions} compact />
            </div>

            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Auto-fullscreen on entry · Present button or F toggles · Esc exits
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div id="tab-schedule" className="tab-panel">
          <Card className="p-5">
            <ScheduleBoard people={people} storeOptions={storeOptions} />
          </Card>
        </div>
      )}

      {activeTab === 'competition' && (
        <div id="tab-competition" className="tab-panel">
          <Card className="p-5">
            <Competition sales={sales} commission={commission} storeOptions={storeOptions} />
          </Card>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div id="tab-pnl" className="tab-panel">
          <Card className="p-5">
            <PnlEditor derived={pnlDerived} />
          </Card>
        </div>
      )}

      {activeTab === 'commission' && (
        <div id="tab-commission" className="tab-panel">
          <Card className="p-5"><CommissionEngine /></Card>
        </div>
      )}

      {activeTab === 'import' && (
        <div id="tab-import" className="tab-panel">
          <Card className="p-5"><ImportReport sales={sales} commission={commission} /></Card>
        </div>
      )}

      {teamDrawerName && (() => {
        const team = meetingTeams.find(t => t.name === teamDrawerName);
        if (!team) return null;
        const memberNames = Array.from(new Set(
          people.filter(p => p.team === team.name).map(p => p.name)
            .concat([team.lead, team.asm].filter(n => people.some(p => p.name.toLowerCase() === n.toLowerCase())))
        ));
        const statsByName = new Map(meetingAgg.perPerson.map(p => [p.person.toLowerCase(), p]));
        return (
          <FsPortal>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${team.name} stats`}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setTeamDrawerName(null)} />
            <div className="relative w-full sm:max-w-lg glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-bold">{team.name}</h3>
                <button onClick={() => setTeamDrawerName(null)} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
              </div>
              <p className="text-xs text-text-secondary mb-4">
                Lead <span className="text-accent-purple">{team.lead}</span> · ASM <span className="text-accent-yellow">{team.asm}</span> · {PERIOD_LABELS[meetingPeriod]}
              </p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Lines', value: String(team.derived.lines), color: 'text-accent-blue' },
                  { label: 'Next Ups', value: String(team.derived.nextUps), color: 'text-accent-red' },
                  { label: 'Internet', value: String(team.derived.internet), color: 'text-accent-cyan' },
                  { label: 'Generated', value: formatCurrency(team.derived.revenue), color: 'text-accent-green' },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-white/5 text-center">
                    <p className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</p>
                    <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Members — click for their profile</p>
              <div className="space-y-1">
                {memberNames.map(name => {
                  const s = statsByName.get(name.toLowerCase());
                  return (
                    <button
                      key={name}
                      onClick={() => { setTeamDrawerName(null); setProfileName(name); }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-xs"
                    >
                      <span className="font-medium">{name}</span>
                      <span className="text-text-secondary">
                        {s ? <>{s.lines} lines · {s.internet} internet · <span className="text-accent-green font-semibold">{formatCurrency(s.revenue)}</span></> : 'no sales this period'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </FsPortal>
        );
      })()}

      {expandChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Enlarged chart">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExpandChart(null)} />
          <div className="relative w-full max-w-4xl glass border border-border-strong rounded-2xl p-6 animate-scale-in bg-bg-secondary/95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {expandChart === 'trend'
                  ? <>
                      <TrendingUp className="w-5 h-5 text-accent-blue" /> Revenue Trend
                      <span className="flex items-center gap-1 ml-2">
                        {([['days', '7 Days'], ['weeks', '8 Weeks'], ['months', '12 Months']] as const).map(([r, label]) => (
                          <button key={r} onClick={() => setTrendRange(r)} className={cn('tab-btn', trendRange === r ? 'active' : 'inactive')}>
                            {label}
                          </button>
                        ))}
                      </span>
                    </>
                  : <><PieChart className="w-5 h-5 text-accent-purple" /> Product Mix · {PERIOD_LABELS[period]}</>}
              </h3>
              <button onClick={() => setExpandChart(null)} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
            </div>
            {expandChart === 'trend' ? (
              <div style={{ position: 'relative', height: '440px', width: '100%' }}>
                <LineChart data={trendData} height={440} />
              </div>
            ) : (
              <>
                <PieChart3D data={pie.values} labels={pie.labels} colors={pie.colors} height={420} onSliceClick={(i) => { setExpandChart(null); setDrillCat(mixCategories[i]); }} />
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
                  {mixCategories.map(cat => (
                    <button key={cat.key} onClick={() => { setExpandChart(null); setDrillCat(cat); }} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-white transition-colors">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }} />
                      {cat.label} ({cat.qty})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {drillCat && <FsPortal><SliceDrawer category={drillCat} agg={agg} onClose={() => setDrillCat(null)} /></FsPortal>}
      {showProduction && <FsPortal><ProductionDrawer agg={agg} period={period} onClose={() => setShowProduction(false)} onOpenProfile={(n) => { setShowProduction(false); setProfileName(n); }} /></FsPortal>}
      {profileName && (
        <FsPortal>
          <ProfileDrawer name={profileName} period={activeTab === 'meeting' ? meetingPeriod : period} onClose={() => setProfileName(null)} />
        </FsPortal>
      )}

      {exporting && (
        <div id="print-root">
          <ReportTemplate leaderboard={reportRows} />
        </div>
      )}
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <DashboardContent />
    </Suspense>
  );
}
