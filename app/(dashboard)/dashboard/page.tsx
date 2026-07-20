'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Avatar, AvatarGroup } from '@/components/ui/badge-avatar';
import { LineChart } from '@/components/charts/chart-wrapper';
import { PieChart3D } from '@/components/charts/chart-3d';
import { formatCurrency, formatNumber, formatPercent, getInitials, ROLE_LABELS, ROLE_COLORS, STORE_LABELS, cn } from '@/lib/utils';
import { FileText, TrendingUp, Zap, DollarSign, Star, Trophy, CalendarCheck, Target, Users, Building2, MapPin, PieChart, Maximize2 } from 'lucide-react';
import { LeaderboardRow, MeetingTracker, LeaderboardEntry } from '@/components/dashboard/dashboard-components';
import { CommissionEngine, PnlEditor, TeamsEditor } from '@/components/dashboard/editable-sections';
import { ReportTemplate } from '@/components/dashboard/report-template';
import { RosterManager, loadPeople, loadPromoRules, promotionStatus, Person, ROSTER_ROLE_LABELS, ROLE_LADDER } from '@/components/dashboard/roster';

// Stats Data
const stats = [
  { label: 'Daily Prod', value: '127', change: '+12.5%', icon: TrendingUp, color: 'blue', trend: 'up' },
  { label: 'Weekly Prod', value: '843', change: '+8.2%', icon: Zap, color: 'purple', trend: 'up' },
  { label: 'Revenue', value: '$142K', change: '+15.3%', icon: DollarSign, color: 'green', trend: 'up' },
  { label: 'Premium Mix', value: '68.4%', change: '+2.1%', icon: Star, color: 'yellow', trend: 'up' },
] as const;

// Chart Data
const commissionData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{
    label: 'Commission',
    data: [3200, 4100, 3800, 4500, 5200, 4800, 5100],
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.1)',
    fill: true,
    tension: 0.3,
    borderWidth: 2,
    pointRadius: 3,
    pointBackgroundColor: '#3B82F6',
  }],
};

// Slice order + hues validated for colorblind-safe adjacency on black
// (dataviz six-checks: lightness band, CVD ΔE, normal-vision floor, contrast)
const productMix = {
  labels: ['Premium', 'Extra', 'Value', 'Fiber 1G', 'Fiber 500', 'Next Up'],
  values: [45, 20, 15, 25, 12, 18],
  colors: ['#3B82F6', '#D97706', '#0891B2', '#A855F7', '#059669', '#EF4444'],
  // maps each slice to a commission-engine plan name for payout lookup
  planNames: ['Premium 2.0', 'Extra 2.0', 'Value 2.0', 'Fiber 1GIG', 'Fiber 500', 'Next Up Anytime'],
};

// Looks up the current editable payout for a plan from the commission engine's saved state
function lookupPayout(planName: string): number | null {
  if (!planName || typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem('se-commission-v1') || 'null');
    const lists = saved ? [saved.phonePlans, saved.internet, saved.addOns] : [];
    for (const list of lists) {
      const hit = (list ?? []).find((p: { name: string }) => p.name === planName);
      if (hit) return hit.payout;
    }
  } catch { /* fall through */ }
  const defaults: Record<string, number> = {
    'Premium 2.0': 35, 'Extra 2.0': 30, 'Value 2.0': 20, 'Fiber 1GIG': 50, 'Fiber 500': 35,
  };
  return defaults[planName] ?? null;
}

function SliceDrawer({ index, onClose }: { index: number; onClose: () => void }) {
  const label = productMix.labels[index];
  const value = productMix.values[index];
  const color = productMix.colors[index];
  const total = productMix.values.reduce((a, b) => a + b, 0);
  const share = ((value / total) * 100).toFixed(1);
  const payout = lookupPayout(productMix.planNames[index]);
  // deterministic 7-day sample trend derived from the value (demo data)
  const week = Array.from({ length: 7 }, (_, i) =>
    Math.max(1, Math.round(value / 7 + Math.sin(index * 3 + i * 1.7) * (value / 12)))
  );
  const weekMax = Math.max(...week);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${label} details`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
            {label}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Units</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Mix Share</p>
            <p className="text-xl font-bold text-white">{share}%</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Payout/Unit</p>
            <p className="text-xl font-bold text-accent-green">{payout != null ? formatCurrency(payout) : '—'}</p>
          </div>
        </div>
        {payout != null && (
          <p className="text-xs text-text-secondary mb-4">
            Est. revenue this period:{' '}
            <span className="text-accent-green font-semibold">{formatCurrency(value * payout)}</span>
            <span className="text-text-muted"> · at current payout settings — edit in the Commission tab</span>
          </p>
        )}
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Last 7 days</p>
        <div className="flex items-end gap-1.5 h-16">
          {week.map((v, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${(v / weekMax) * 100}%`, background: color, opacity: 0.35 + (i / 7) * 0.65 }} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-text-muted mt-1">
          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
      </div>
    </div>
  );
}

function ProfileDrawer({ name, entry, onClose }: { name: string; entry?: LeaderboardEntry; onClose: () => void }) {
  const person = loadPeople().find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const rules = loadPromoRules();
  const status = person ? promotionStatus(person, rules) : null;
  const roleIndex = person ? ROLE_LADDER.indexOf(person.role) : -1;
  const profitMax = person ? Math.max(...person.weeklyProfit, rules.profitPerWeek) : 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${name} profile`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center font-bold">
              {getInitials(name)}
            </div>
            <div>
              <h3 className="text-lg font-bold">{name}</h3>
              <p className="text-xs text-text-secondary">
                {person
                  ? `${ROSTER_ROLE_LABELS[person.role]} · ${person.store}${person.team ? ` · ${person.team}` : ' · no team'}`
                  : 'Not in roster yet'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>

        {entry && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Lines', value: String(entry.lines), color: 'text-accent-blue' },
              { label: 'Premium', value: String(entry.premium), color: 'text-accent-purple' },
              { label: 'Fiber', value: String(entry.fiber), color: 'text-accent-cyan' },
              { label: 'Commission', value: formatCurrency(entry.commission), color: 'text-accent-green' },
            ].map(s => (
              <div key={s.label} className="p-2.5 rounded-xl bg-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</p>
                <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {person && status ? (
          <>
            {/* Leadership roadmap ladder */}
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Leadership Roadmap</p>
            <div className="flex items-center gap-1 mb-4">
              {ROLE_LADDER.map((role, i) => (
                <div key={role} className="flex-1 flex items-center gap-1">
                  <div className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                    i < roleIndex && 'bg-accent-green/10 text-accent-green border-accent-green/30',
                    i === roleIndex && 'bg-accent-blue/20 text-accent-blue border-accent-blue/40 shadow-neon-blue',
                    i > roleIndex && 'bg-white/5 text-text-muted border-border-subtle'
                  )}>
                    {ROSTER_ROLE_LABELS[role]}
                  </div>
                  {i < ROLE_LADDER.length - 1 && <span className="text-text-muted text-[10px]">→</span>}
                </div>
              ))}
            </div>

            {/* Promotion progress */}
            <div className={cn('p-3 rounded-xl border mb-4', status.ready ? 'bg-accent-green/10 border-accent-green/30' : 'bg-white/5 border-border-subtle')}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{status.ready ? '🎉 ' : ''}{status.label}</span>
                <span className="text-[10px] text-text-muted">
                  needs {formatCurrency(rules.profitPerWeek)}/wk × {rules.weeks} wks + {rules.minAttendance}% attendance
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                <div className={cn('h-full rounded-full', status.ready ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-blue to-accent-green')} style={{ width: `${status.progress}%` }} />
              </div>
            </div>

            {/* Weekly profit + attendance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Weekly Profit</p>
                <div className="flex items-end gap-2 h-14">
                  {person.weeklyProfit.map((w, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-accent-green/80" style={{ height: `${Math.max(6, (w / profitMax) * 100)}%`, opacity: w >= rules.profitPerWeek ? 1 : 0.45 }} />
                      <span className="text-[8px] text-text-muted">{formatCurrency(w)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 flex flex-col items-center justify-center">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Attendance</p>
                <p className={cn('text-2xl font-bold', person.attendance >= rules.minAttendance ? 'text-accent-green' : 'text-accent-yellow')}>
                  {person.attendance}%
                </p>
                <p className="text-[9px] text-text-muted">target {rules.minAttendance}%</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-text-secondary p-3 rounded-xl bg-white/5">
            This rep isn&apos;t in the roster yet. Add them on the <span className="text-accent-blue font-medium">Roster</span> tab
            (same name) to track their store, team, promotions, and leadership roadmap here.
          </p>
        )}
      </div>
    </div>
  );
}

// Leaderboard Data — default roster; user edits persist to localStorage
const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { name: 'Sarah Johnson', store: 'Costco', lines: 12, premium: 8, fiber: 3, commission: 480, role: 'rep' },
  { name: 'Mike Chen', store: 'Target', lines: 10, premium: 6, fiber: 4, commission: 410, role: 'rep' },
  { name: "Jessica Williams", store: "BJ's", lines: 9, premium: 5, fiber: 3, commission: 375, role: 'rep' },
  { name: 'Team Alpha', store: 'Orlando', lines: 8, premium: 4, fiber: 2, commission: 320, role: 'team' },
  { name: 'Team Beta', store: 'Tampa', lines: 7, premium: 3, fiber: 2, commission: 290, role: 'team' },
];

const LEADERBOARD_STORAGE_KEY = 'se-leaderboard-v1';
const NUMERIC_FIELDS: (keyof LeaderboardEntry)[] = ['lines', 'premium', 'fiber', 'commission'];

// Top Performers
const topPerformers = [
  { rank: 1, name: 'Sarah Johnson', store: 'Costco · Clearwater', lines: 12, commission: 480, color: 'yellow' },
  { rank: 2, name: 'Mike Chen', store: 'Target · Tampa', lines: 10, commission: 410, color: 'gray' },
  { rank: 3, name: "Jessica Williams", store: "BJ's · Orlando", lines: 9, commission: 375, color: 'orange' },
];

// Attendance Data
const attendanceData = { present: 22, late: 1, absent: 1 };
const attendancePercent = Math.round((attendanceData.present / (attendanceData.present + attendanceData.late + attendanceData.absent)) * 100 * 10) / 10;

// Goals Data
const goals = [
  { label: 'Total Lines', current: 843, target: 1000, color: 'blue' },
  { label: 'Premium', current: 287, target: 350, color: 'purple' },
];

// Meeting Trackers
const meetingTrackers = [
  { label: "Today's Lines", value: '127', color: 'blue', size: '2xl' },
  { label: 'Top Rep', value: 'Sarah J.', color: 'purple', size: 'lg' },
  { label: 'Attendance', value: '91.7%', color: 'green', size: '2xl' },
  { label: 'Goal Progress', value: '87%', color: 'yellow', size: '2xl' },
];

// Stats Card Component
interface StatCardProps {
  label: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'purple' | 'green' | 'yellow';
  className?: string;
}

// Animates "127", "$142K", "68.4%" from 0 to target on mount (respects reduced motion)
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
      const current = target * eased;
      setDisplay(`${prefix}${current.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
}

function StatCard({ label, value, change, icon: Icon, color, className }: StatCardProps) {
  const colorClasses = {
    blue: 'text-accent-blue',
    purple: 'text-accent-purple',
    green: 'text-accent-green',
    yellow: 'text-accent-yellow',
  };

  const neonClasses = {
    blue: 'neon-text-blue',
    purple: 'neon-text-purple',
    green: 'neon-text-green',
    yellow: 'neon-text-yellow',
  };

  return (
    <Card className={`stat-card pulse-glow ${className || ''}`}>
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
        <div className="p-1.5 rounded-lg bg-white/5">
          <Icon className={`w-3 h-3 ${colorClasses[color as keyof typeof colorClasses]}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold ${neonClasses[color as keyof typeof neonClasses]}`}>
        <CountUpValue value={value} />
      </p>
      <p className="text-[10px] text-accent-green">{change}</p>
    </Card>
  );
}

function ChartCard({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  const colorClasses = {
    cyan: 'text-accent-cyan',
    purple: 'text-accent-purple',
    blue: 'text-accent-blue',
    green: 'text-accent-green',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClasses[color as keyof typeof colorClasses]}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="chart-container" style={{ position: 'relative', height: '180px', width: '100%' }}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({ children, isActive, onClick }: { children: React.ReactNode; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`tab-btn px-3 py-1.5 rounded-lg text-xs font-medium border transition ${isActive ? 'active' : 'inactive'}`}
    >
      {children}
    </button>
  );
}

const VALID_TABS = ['dashboard', 'roster', 'leaderboard', 'meeting', 'pnl', 'commission'];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'dashboard'
  );

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam) {
      setActiveTab('dashboard');
    }
  }, [tabParam]);

  const [pendingPresent, setPendingPresent] = useState(false);
  const [drillIndex, setDrillIndex] = useState<number | null>(null);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    // Meeting Mode auto-presents: entering the tab fullscreens the panel
    if (tab === 'meeting') setPendingPresent(true);
    router.replace(tab === 'dashboard' ? '/dashboard' : `/dashboard?tab=${tab}`, { scroll: false });
  };

  // Leaderboard roster — editable, persisted to localStorage
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(DEFAULT_LEADERBOARD);
  const [rosterLoaded, setRosterLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (saved) setLeaderboard(JSON.parse(saved));
    } catch {
      // corrupted storage — keep defaults
    }
    setRosterLoaded(true);
  }, []);

  useEffect(() => {
    if (rosterLoaded) {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
    }
  }, [leaderboard, rosterLoaded]);

  const addRep = () => {
    setLeaderboard(prev => [
      ...prev,
      { name: 'New Rep', store: 'Store', lines: 0, premium: 0, fiber: 0, commission: 0, role: 'rep' },
    ]);
  };

  const removeRep = (index: number) => {
    setLeaderboard(prev => prev.filter((_, i) => i !== index));
  };

  const editRep = (index: number, field: keyof LeaderboardEntry, value: string) => {
    setLeaderboard(prev =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        if (NUMERIC_FIELDS.includes(field)) {
          const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
          return { ...entry, [field]: Number.isFinite(num) ? num : 0 };
        }
        return { ...entry, [field]: value.trim() || entry[field] };
      })
    );
  };

  const resetRoster = () => {
    setLeaderboard(DEFAULT_LEADERBOARD);
    localStorage.removeItem(LEADERBOARD_STORAGE_KEY);
  };

  // Roster join: team names on leaderboard rows + rep profiles
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    setPeople(loadPeople());
  }, [activeTab]); // refresh after edits made on the Roster tab

  const teamByName = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach(p => { if (p.team) map.set(p.name.toLowerCase(), p.team); });
    return map;
  }, [people]);

  const [profileName, setProfileName] = useState<string | null>(null);

  // Store filter: view one store, several, or all
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const storeOptions = useMemo(
    () => Array.from(new Set(leaderboard.map(e => e.store.trim()).filter(Boolean))),
    [leaderboard]
  );
  const toggleStore = (store: string) =>
    setStoreFilter(prev => prev.includes(store) ? prev.filter(s => s !== store) : [...prev, store]);
  const visibleRows = useMemo(
    () => leaderboard
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => storeFilter.length === 0 || storeFilter.includes(entry.store.trim())),
    [leaderboard, storeFilter]
  );

  // Presentation mode — fullscreen the meeting panel for TV / AirPlay sharing
  const meetingRef = useRef<HTMLDivElement>(null);
  const togglePresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      meetingRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeTab !== 'meeting') return;
      if ((document.activeElement as HTMLElement | null)?.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') togglePresentation();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab]);

  // Auto-present: fires right after the meeting panel mounts, while the
  // click's transient user activation is still valid for the Fullscreen API.
  useEffect(() => {
    if (activeTab === 'meeting' && pendingPresent) {
      setPendingPresent(false);
      meetingRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, [activeTab, pendingPresent]);

  // Branded PDF: renders ReportTemplate off-screen, captures it, then unmounts it
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!exporting) return;
    const timer = setTimeout(() => {
      const element = document.getElementById('pdf-report');
      if (!element) { setExporting(false); return; }
      import('html2pdf.js').then(({ default: html2pdf }) => {
        html2pdf().set({
          margin: [0.35, 0.35, 0.45, 0.35],
          filename: `Sales_Engine_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, letterRendering: true, useCORS: true, logging: false, backgroundColor: '#FFFFFF' },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css'] },
        }).from(element).save().finally(() => setExporting(false));
      }).catch(() => setExporting(false));
    }, 120);
    return () => clearTimeout(timer);
  }, [exporting]);

  const exportPDF = () => setExporting(true);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="slide-in mb-6 flex flex-wrap items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold neon-text-blue">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">AT&T campaign · white-label ready</p>
        </div>
        <Button onClick={exportPDF} className="mt-2 lg:mt-0">
          <FileText className="w-4 h-4" />
          Export PDF
        </Button>
      </div>

      {/* Campaign Badge */}
      <div className="slide-in mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="green" className="text-xs flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /> Live
        </Badge>
        <Badge variant="gray" className="text-xs flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> AT&T Retailer
        </Badge>
        <Badge variant="gray" className="text-xs flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> 8 Stores
        </Badge>
      </div>

      {/* Stats */}
      <div className="slide-in grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} {...stat} className={`stagger-${i + 1}`} />
        ))}
      </div>

      {/* Charts */}
      <div className="slide-in grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Commission Trend" icon={TrendingUp} color="blue">
          <LineChart data={commissionData} />
        </ChartCard>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-accent-purple" />
              Product Mix
              <span className="text-[10px] text-text-muted font-normal uppercase tracking-wider">3D · hover a slice</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart3D
              data={productMix.values}
              labels={productMix.labels}
              colors={productMix.colors}
              height={150}
              onSliceClick={(i) => setDrillIndex(i)}
            />
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
              {productMix.labels.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setDrillIndex(i)}
                  className="flex items-center gap-1.5 text-[10px] text-text-secondary hover:text-white transition-colors"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: productMix.colors[i] }} />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="slide-in mt-6 mb-4 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
        <TabButton isActive={activeTab === 'dashboard'} onClick={() => switchTab('dashboard')}>Dashboard</TabButton>
        <TabButton isActive={activeTab === 'roster'} onClick={() => switchTab('roster')}>Roster</TabButton>
        <TabButton isActive={activeTab === 'leaderboard'} onClick={() => switchTab('leaderboard')}>Leaderboard</TabButton>
        <TabButton isActive={activeTab === 'meeting'} onClick={() => switchTab('meeting')}>Meeting Mode</TabButton>
        <TabButton isActive={activeTab === 'pnl'} onClick={() => switchTab('pnl')}>P&L</TabButton>
        <TabButton isActive={activeTab === 'commission'} onClick={() => switchTab('commission')}>Commission</TabButton>
      </div>

      {/* Tab Panels */}
      {activeTab === 'dashboard' && (
        <div id="tab-dashboard" className="tab-panel">
          <div className="slide-in grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent-yellow" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topPerformers.map((performer) => (
                    <div key={performer.rank} className="flex items-center gap-3 p-3 rounded-xl glass border border-border-subtle">
                      <span className={cn('text-xl font-bold', performer.color === 'yellow' && 'text-accent-yellow', performer.color === 'gray' && 'text-text-secondary', performer.color === 'orange' && 'text-accent-orange')}>
                        #{performer.rank}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{performer.name}</p>
                        <p className="text-xs text-text-secondary">{performer.store}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-accent-green text-sm">{formatCurrency(performer.commission)}</p>
                        <p className="text-xs text-text-secondary">{performer.lines} lines</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="p-5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4" />
                    Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-center">
                      <p className="text-xl font-bold text-accent-green">{attendanceData.present}</p>
                      <p className="text-[10px] text-text-muted">Present</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-accent-yellow">{attendanceData.late}</p>
                      <p className="text-[10px] text-text-muted">Late</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-accent-red">{attendanceData.absent}</p>
                      <p className="text-[10px] text-text-muted">Absent</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-blue" style={{ width: `${attendancePercent}%` }} />
                  </div>
                  <p className="text-xs text-text-secondary mt-1">{attendancePercent}% Attendance</p>
                </CardContent>
              </Card>

              <Card className="p-5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-accent-green" />
                    Weekly Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {goals.map((goal) => (
                      <div key={goal.label}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-text-secondary">{goal.label}</span>
                          <span className={cn('font-medium', goal.color === 'blue' && 'text-accent-blue', goal.color === 'purple' && 'text-accent-purple')}>
                            {formatNumber(goal.current)} / {formatNumber(goal.target)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                          <div className="h-full rounded-full" style={{ width: `${(goal.current / goal.target) * 100}%` }}>
                            <div className="h-full rounded-full" style={{ background: goal.color === 'blue' ? 'linear-gradient(to right, #3B82F6, #60A5FA)' : 'linear-gradient(to right, #A855F7, #C084FC)' }} />
                          </div>
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

      {activeTab === 'roster' && (
        <div id="tab-roster" className="tab-panel">
          <Card className="p-5">
            <RosterManager />
          </Card>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div id="tab-leaderboard" className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold neon-text-purple">
                Team Leaderboard
                <span className="text-xs text-text-muted font-normal ml-2">(click any text to edit)</span>
              </h2>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={addRep}>+ Add Rep</Button>
                <Button variant="ghost" size="sm" onClick={resetRoster}>↻ Reset</Button>
              </div>
            </div>
            {/* Store filter — one store, several, or all */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">Stores:</span>
              <button
                onClick={() => setStoreFilter([])}
                className={cn('tab-btn', storeFilter.length === 0 ? 'active' : 'inactive')}
              >
                All
              </button>
              {storeOptions.map(store => (
                <button
                  key={store}
                  onClick={() => toggleStore(store)}
                  className={cn('tab-btn', storeFilter.includes(store) ? 'active' : 'inactive')}
                >
                  {store}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Rep / Team</th>
                    <th className="pb-2">Store</th>
                    <th className="pb-2">Team</th>
                    <th className="pb-2">Lines</th>
                    <th className="pb-2">Premium</th>
                    <th className="pb-2">Fiber</th>
                    <th className="pb-2">Commission</th>
                    <th className="pb-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody id="leaderboardBody" className="divide-y divide-border-subtle">
                  {visibleRows.map(({ entry, index }, vi) => (
                    <LeaderboardRow
                      key={index}
                      entry={{ ...entry, rank: vi + 1 }}
                      teamName={teamByName.get(entry.name.trim().toLowerCase())}
                      onEdit={(field, value) => editRep(index, field, value)}
                      onRemove={() => removeRep(index)}
                      onOpenProfile={() => setProfileName(entry.name)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Click any cell to edit · hover a row: person icon = profile &amp; roadmap, trash = remove · changes save automatically
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'meeting' && (
        <div id="tab-meeting" ref={meetingRef} className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold neon-text-blue">
                Meeting Mode · Daily Trackers
                <span className="text-xs text-text-muted font-normal ml-2">(click to edit)</span>
              </h2>
              <Button size="sm" onClick={togglePresentation}>
                <Maximize2 className="w-3.5 h-3.5" />
                Present
              </Button>
            </div>

            {/* Daily Trackers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {meetingTrackers.map((tracker, i) => (
                <MeetingTracker key={i} {...tracker} />
              ))}
            </div>

            <TeamsEditor />

            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Click any number or name to edit for your daily standup · Present = fullscreen for the TV · Esc exits
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div id="tab-pnl" className="tab-panel">
          <Card className="p-5">
            <PnlEditor />
          </Card>
        </div>
      )}

      {activeTab === 'commission' && (
        <div id="tab-commission" className="tab-panel">
          <Card className="p-5">
            <CommissionEngine />
          </Card>
        </div>
      )}

      {drillIndex !== null && <SliceDrawer index={drillIndex} onClose={() => setDrillIndex(null)} />}

      {profileName && (
        <ProfileDrawer
          name={profileName}
          entry={leaderboard.find(e => e.name === profileName)}
          onClose={() => setProfileName(null)}
        />
      )}

      {exporting && (
        <div style={{ position: 'absolute', left: -10000, top: 0 }} aria-hidden="true">
          <ReportTemplate leaderboard={leaderboard} />
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