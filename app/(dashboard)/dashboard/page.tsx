'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Building2, MapPin, PieChart, Maximize2, ChevronDown, Sparkles, ClipboardList,
} from 'lucide-react';
import { MeetingTracker } from '@/components/dashboard/dashboard-components';
import { CommissionEngine, PnlEditor, TeamData } from '@/components/dashboard/editable-sections';
import { ReportTemplate } from '@/components/dashboard/report-template';
import { RosterManager, loadPeople } from '@/components/dashboard/roster';
import { ProfileDrawer } from '@/components/dashboard/profile-drawer';
import { DailyTracker } from '@/components/dashboard/daily-tracker';
import {
  Period, PERIOD_LABELS, aggregateSales, loadSales, saveSales, loadCommission,
  generateDemoSales, planPayout, Aggregate, PersonStats,
} from '@/lib/sales';

// Categorical palette — validated colorblind-safe on black (dataviz six-checks).
// Color follows the plan (fixed order), never the rank.
const PIE_PALETTE = ['#3B82F6', '#D97706', '#0891B2', '#A855F7', '#059669', '#EF4444', '#7C3AED', '#DB2777'];

const VALID_TABS = ['dashboard', 'tracker', 'roster', 'leaderboard', 'meeting', 'pnl', 'commission'];

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
        <div className="absolute right-0 top-full mt-1.5 z-40 w-48 p-2 rounded-xl bg-bg-secondary border border-border-strong shadow-glass space-y-0.5">
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
                <th className="pb-2 text-right">Next Up</th><th className="pb-2 text-right">Payout</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Pie slice drill-down with the line/Next-Up attach breakdown
function SliceDrawer({ plan, agg, onClose }: { plan: string; agg: Aggregate; onClose: () => void }) {
  const commission = loadCommission();
  const stats = agg.perPlan.get(plan);
  const totalQty = Array.from(agg.perPlan.values()).reduce((a, b) => a + b.qty, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!stats) return null;
  const share = totalQty > 0 ? ((stats.qty / totalQty) * 100).toFixed(1) : '0';
  const payout = planPayout(commission, plan);
  const nextUpPer = planPayout(commission, 'Next Up Anytime');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${plan} details`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{plan}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Sold</p>
            <p className="text-xl font-bold text-accent-blue">{stats.qty}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Mix Share</p>
            <p className="text-xl font-bold text-white">{share}%</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Revenue</p>
            <p className="text-xl font-bold text-accent-green">{formatCurrency(stats.revenue)}</p>
          </div>
        </div>
        {/* Attach breakdown: how many of these lines carried Next Up */}
        <div className="p-3 rounded-xl bg-white/5 mb-2">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-text-secondary">Next Up attached</span>
            <span className="text-accent-red font-semibold">{stats.nextUps} of {stats.qty} ({stats.qty > 0 ? Math.round((stats.nextUps / stats.qty) * 100) : 0}%)</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent-red" style={{ width: `${stats.qty > 0 ? (stats.nextUps / stats.qty) * 100 : 0}%` }} />
          </div>
          {stats.nextUps > 0 && (
            <p className="text-[10px] text-text-muted mt-1.5">
              +{formatCurrency(stats.nextUps * nextUpPer)} from Next Up attaches (${nextUpPer} each)
            </p>
          )}
        </div>
        <p className="text-xs text-text-secondary">
          Base payout <span className="text-accent-green font-semibold">{formatCurrency(payout)}</span>/unit at Tier {commission.tier} —
          edit in the Commission tab, everything recomputes.
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

  const [period, setPeriod] = useState<Period>('weekly');
  const [storeSel, setStoreSel] = useState<string[]>([]);

  const commission = useMemo(loadCommission, [dataVersion]);
  const people = useMemo(loadPeople, [dataVersion]);
  const sales = useMemo(loadSales, [dataVersion]);

  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    commission.stores.forEach(s => set.add(s.name));
    people.forEach(p => p.store && set.add(p.store));
    sales.forEach(s => s.store && set.add(s.store));
    return Array.from(set);
  }, [commission, people, sales]);

  const agg = useMemo(
    () => aggregateSales(sales, commission, { period, stores: storeSel }),
    [sales, commission, period, storeSel]
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

  const hasData = sales.length > 0;
  const premiumMix = agg.lines > 0 ? ((agg.premium / agg.lines) * 100).toFixed(1) : '0.0';

  const generateDemo = () => {
    saveSales(generateDemoSales(people, commission));
    bump();
  };

  // Trend: last 7 days of revenue (respects store selection)
  const trendData = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return {
      labels: days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })),
      datasets: [{
        label: 'Revenue',
        data: days.map(d => aggWeekly.perDay.get(d) ?? 0),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#3B82F6',
      }],
    };
  }, [aggWeekly]);

  // Pie: per-plan mix for the selected period (fixed plan order = stable colors)
  const pie = useMemo(() => {
    const planOrder = [...commission.phonePlans.map(p => p.name), ...commission.internet.map(p => p.name)];
    const slices = planOrder
      .map((plan, i) => ({ plan, color: PIE_PALETTE[i % PIE_PALETTE.length], stats: agg.perPlan.get(plan) }))
      .filter(s => s.stats && s.stats.qty > 0) as Array<{ plan: string; color: string; stats: { qty: number } }>;
    return {
      labels: slices.map(s => s.plan),
      values: slices.map(s => s.stats.qty),
      colors: slices.map(s => s.color),
    };
  }, [agg, commission]);

  const [drillPlan, setDrillPlan] = useState<string | null>(null);
  const [showProduction, setShowProduction] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  // Leaderboard rows: roster people + their derived period stats
  const leaderboardRows = useMemo(() => {
    const statsByName = new Map(agg.perPerson.map(p => [p.person.toLowerCase(), p]));
    const rows = people.map(person => {
      const s = statsByName.get(person.name.toLowerCase());
      return {
        person,
        stats: s ?? { person: person.name, store: person.store, lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0 } as PersonStats,
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
          if (s) { acc.lines += s.lines; acc.premium += s.premium; acc.internet += s.internet; acc.revenue += s.revenue; }
          return acc;
        },
        { lines: 0, premium: 0, internet: 0, revenue: 0 }
      );
      return { ...team, derived: sum };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingAgg, people, dataVersion]);

  const avgAttendance = people.length
    ? Math.round(people.reduce((a, p) => a + p.attendance, 0) / people.length * 10) / 10
    : 0;
  const topRepDaily = aggDaily.perPerson[0]?.person ?? '—';

  // Weekly goals (targets static for now; progress derived)
  const goals = [
    { label: 'Total Lines', current: aggWeekly.lines, target: 200, color: 'blue' },
    { label: 'Premium', current: aggWeekly.premium, target: 80, color: 'purple' },
  ];

  // Presentation mode
  const meetingRef = useRef<HTMLDivElement>(null);
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
        name: r.person.name, store: r.person.store,
        lines: r.stats.lines, premium: r.stats.premium, fiber: r.stats.internet,
        commission: r.stats.revenue, role: r.person.role.toLowerCase(),
      })),
    [leaderboardRows]
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="slide-in mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold neon-text-blue">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">AT&T campaign · white-label ready</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodChips period={period} onChange={setPeriod} />
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
        <Badge variant="blue" className="text-xs">{PERIOD_LABELS[period]} view{storeSel.length ? ` · ${storeSel.join(', ')}` : ' · all stores'}</Badge>
      </div>

      {/* Tabs — moved above content so switching changes the view immediately */}
      <div className="slide-in mb-4 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
        <TabButton isActive={activeTab === 'dashboard'} onClick={() => switchTab('dashboard')}>Dashboard</TabButton>
        <TabButton isActive={activeTab === 'tracker'} onClick={() => switchTab('tracker')}>Daily Tracker</TabButton>
        <TabButton isActive={activeTab === 'roster'} onClick={() => switchTab('roster')}>Roster</TabButton>
        <TabButton isActive={activeTab === 'leaderboard'} onClick={() => switchTab('leaderboard')}>Leaderboard</TabButton>
        <TabButton isActive={activeTab === 'meeting'} onClick={() => switchTab('meeting')}>Meeting Mode</TabButton>
        <TabButton isActive={activeTab === 'pnl'} onClick={() => switchTab('pnl')}>P&L</TabButton>
        <TabButton isActive={activeTab === 'commission'} onClick={() => switchTab('commission')}>Commission</TabButton>
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
            <StatCard label={`${PERIOD_LABELS[period]} Lines`} value={String(agg.lines)} sub={`${aggDaily.lines} today`} icon={TrendingUp} color="blue" onClick={() => setShowProduction(true)} className="stagger-1" />
            <StatCard label="Internet" value={String(agg.internet)} sub={`${agg.nextUps} next ups`} icon={Zap} color="purple" onClick={() => setShowProduction(true)} className="stagger-2" />
            <StatCard label="Revenue" value={formatCurrency(agg.revenue)} sub={`Tier ${commission.tier} payouts`} icon={DollarSign} color="green" onClick={() => setShowProduction(true)} className="stagger-3" />
            <StatCard label="Premium Mix" value={`${premiumMix}%`} sub={`${agg.premium} premium lines`} icon={Star} color="yellow" onClick={() => setShowProduction(true)} className="stagger-4" />
          </div>

          {/* Charts */}
          <div className="slide-in grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent-blue" /> Revenue Trend
                  <span className="text-[10px] text-text-muted font-normal uppercase tracking-wider">last 7 days</span>
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
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-accent-purple" /> Product Mix
                  <span className="text-[10px] text-text-muted font-normal uppercase tracking-wider">3D · click a slice for the breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pie.values.length > 0 ? (
                  <>
                    <PieChart3D data={pie.values} labels={pie.labels} colors={pie.colors} height={150} onSliceClick={(i) => setDrillPlan(pie.labels[i])} />
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                      {pie.labels.map((label, i) => (
                        <button key={label} onClick={() => setDrillPlan(label)} className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-white transition-colors">
                          <span className="w-2 h-2 rounded-full" style={{ background: pie.colors[i] }} />
                          {label}
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
                  <p className="text-3xl font-bold neon-text-green text-center">{avgAttendance}%</p>
                  <p className="text-[10px] text-text-muted text-center mt-1">team average · per-person on the Roster tab</p>
                  <div className="w-full h-1.5 rounded-full bg-bg-tertiary mt-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-blue" style={{ width: `${avgAttendance}%` }} />
                  </div>
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
                            {formatNumber(goal.current)} / {formatNumber(goal.target)}
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
              <h2 className="text-xl font-bold neon-text-purple">
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
                    <th className="pb-2 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {leaderboardRows
                    .filter(r => storeSel.length === 0 || storeSel.some(s => s.toLowerCase() === r.person.store.toLowerCase()))
                    .map((row, i) => (
                      <tr key={row.person.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2"><span className={cn('font-bold', i === 0 && 'text-yellow-400', i === 1 && 'text-gray-400', i === 2 && 'text-orange-400', i > 2 && 'text-gray-500')}>#{i + 1}</span></td>
                        <td className="py-2">
                          <button onClick={() => setProfileName(row.person.name)} className="font-medium hover:text-accent-blue transition-colors">{row.person.name}</button>
                        </td>
                        <td className="py-2 text-text-secondary">{row.person.store}</td>
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
              <h2 className="text-xl font-bold neon-text-blue">Meeting Mode</h2>
              <div className="flex items-center gap-2">
                <PeriodChips period={meetingPeriod} onChange={setMeetingPeriod} options={['daily', 'weekly', 'all']} />
                <Button size="sm" onClick={togglePresentation}><Maximize2 className="w-3.5 h-3.5" /> Present</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <MeetingTracker label={`${PERIOD_LABELS[meetingPeriod]} Lines`} value={String(meetingAgg.lines)} color="blue" size="2xl" />
              <MeetingTracker label="Top Rep Today" value={topRepDaily} color="purple" size="lg" />
              <MeetingTracker label="Attendance" value={`${avgAttendance}%`} color="green" size="2xl" />
              <MeetingTracker label="Revenue" value={formatCurrency(meetingAgg.revenue)} color="yellow" size="2xl" />
            </div>

            <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Teams · live from members&apos; sales
              <span className="text-[10px] text-text-muted font-normal">(build teams on the Roster tab)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meetingTeams.map((team, i) => (
                <div key={i} className={cn('glass rounded-xl p-4 border', { blue: 'border-accent-blue/10', purple: 'border-accent-purple/10', cyan: 'border-accent-cyan/10', yellow: 'border-accent-yellow/10' }[team.color] ?? 'border-accent-blue/10')}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{team.name}</span>
                    <span className="text-xs text-accent-green font-semibold">{formatCurrency(team.derived.revenue)}</span>
                  </div>
                  <p className="text-[10px] text-text-muted mb-2">Lead: <span className="text-accent-purple">{team.lead}</span> · ASM: <span className="text-accent-yellow">{team.asm}</span></p>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Lines: <span className="text-white">{team.derived.lines}</span></span>
                    <span>Premium: <span className="text-white">{team.derived.premium}</span></span>
                    <span>Internet: <span className="text-white">{team.derived.internet}</span></span>
                  </div>
                </div>
              ))}
              {meetingTeams.length === 0 && (
                <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 md:col-span-2">No teams yet — build them with drag &amp; drop on the Roster tab.</p>
              )}
            </div>
            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Auto-fullscreen on entry · Present button or F toggles · Esc exits
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div id="tab-pnl" className="tab-panel">
          <Card className="p-5">
            <PnlEditor derivedCommission={aggMonthly.revenue} />
          </Card>
        </div>
      )}

      {activeTab === 'commission' && (
        <div id="tab-commission" className="tab-panel">
          <Card className="p-5"><CommissionEngine /></Card>
        </div>
      )}

      {drillPlan && <SliceDrawer plan={drillPlan} agg={agg} onClose={() => setDrillPlan(null)} />}
      {showProduction && <ProductionDrawer agg={agg} period={period} onClose={() => setShowProduction(false)} onOpenProfile={(n) => { setShowProduction(false); setProfileName(n); }} />}
      {profileName && <ProfileDrawer name={profileName} period={period} onClose={() => setProfileName(null)} />}

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
