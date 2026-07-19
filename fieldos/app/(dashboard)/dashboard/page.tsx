'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs';
import { Avatar, AvatarGroup } from '@/components/ui/badge-avatar';
import { LineChart, DoughnutChart } from '@/components/charts/chart-wrapper';
import { formatCurrency, formatNumber, formatPercent, getInitials, ROLE_LABELS, ROLE_COLORS, STORE_LABELS, cn } from '@/lib/utils';
import { FileText, TrendingUp, Zap, DollarSign, Star, Trophy, CalendarCheck, Target, Users, Building2, MapPin, Zap as ZapIcon, Receipt, PieChart } from 'lucide-react';
import { LeaderboardRow, MeetingTracker, MeetingTeam, PNLCard, CommissionCategory } from '@/components/dashboard/dashboard-components';

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

const productMixData = {
  labels: ['Premium', 'Extra', 'Value', 'Fiber 1G', 'Fiber 500', 'Accessories'],
  datasets: [{
    data: [45, 20, 15, 25, 12, 89],
    backgroundColor: ['#3B82F6', '#A855F7', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'],
    borderColor: '#000',
    borderWidth: 1.5,
  }],
};

// Leaderboard Data
const leaderboardData = [
  { rank: 1, name: 'Sarah Johnson', store: 'Costco', lines: 12, premium: 8, fiber: 3, commission: 480, role: 'rep' },
  { rank: 2, name: 'Mike Chen', store: 'Target', lines: 10, premium: 6, fiber: 4, commission: 410, role: 'rep' },
  { rank: 3, name: "Jessica Williams", store: "BJ's", lines: 9, premium: 5, fiber: 3, commission: 375, role: 'rep' },
  { rank: 4, name: 'Team Alpha', store: 'Orlando', lines: 8, premium: 4, fiber: 2, commission: 320, role: 'team' },
  { rank: 5, name: 'Team Beta', store: 'Tampa', lines: 7, premium: 3, fiber: 2, commission: 290, role: 'team' },
];

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

// Meeting Teams
const meetingTeams = [
  { name: 'Team Alpha', change: '+12%', lines: 34, premium: 18, fiber: 6, progress: 78, color: 'blue' },
  { name: 'Team Beta', change: '+8%', lines: 28, premium: 14, fiber: 5, progress: 64, color: 'purple' },
  { name: 'Team Gamma', change: '+5%', lines: 22, premium: 10, fiber: 4, progress: 52, color: 'cyan' },
  { name: 'Team Delta', change: '+15%', lines: 41, premium: 22, fiber: 9, progress: 92, color: 'yellow' },
];

// P&L Data
const pnlRevenue = [
  { category: 'Commission', amount: 142500 },
  { category: 'Bonus', amount: 12300 },
];
const pnlExpenses = [
  { category: 'Payroll', amount: 85000 },
  { category: 'Rent', amount: 18000 },
  { category: 'Travel', amount: 8500 },
  { category: 'Other', amount: 5100 },
];
const pnlTotalRevenue = pnlRevenue.reduce((a, b) => a + b.amount, 0);
const pnlTotalExpenses = pnlExpenses.reduce((a, b) => a + b.amount, 0);
const pnlNetProfit = pnlTotalRevenue - pnlTotalExpenses;
const pnlMargin = ((pnlNetProfit / pnlTotalRevenue) * 100).toFixed(1);

// Commission Rules
const phonePlans = [
  { name: 'Premium 2.0', payout: 35 },
  { name: 'Premium 2.0 + Next Up', payout: 40 },
  { name: 'Extra 2.0', payout: 30 },
  { name: 'Value 2.0', payout: 20 },
  { name: 'Upgrades', payout: 15 },
];

const fiberPlans = [
  { name: 'Fiber 300', payout: 25 },
  { name: 'Fiber 500', payout: 35 },
  { name: 'Fiber 1GIG', payout: 50 },
  { name: 'Fiber 2GIG', payout: 75 },
  { name: 'Fiber 5GIG', payout: 100 },
];

const overrides = [
  { name: 'Leader', override: '$5/line' },
  { name: 'Asst. Mgr', override: '$3/line' },
  { name: 'Tier (100+)', override: '$2/line' },
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
      <p className={`text-2xl font-bold ${neonClasses[color as keyof typeof neonClasses]}`}>{value}</p>
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

const VALID_TABS = ['dashboard', 'leaderboard', 'meeting', 'pnl', 'commission'];

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

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(tab === 'dashboard' ? '/dashboard' : `/dashboard?tab=${tab}`, { scroll: false });
  };

  const exportPDF = () => {
    const element = document.getElementById('reportContent');
    if (element) {
      import('html2pdf.js').then(({ default: html2pdf }) => {
        html2pdf().set({
          margin: [0.4, 0.4, 0.4, 0.4],
          filename: 'FieldOS_Report.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, letterRendering: true, useCORS: true, logging: false },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        }).from(element).save();
      });
    }
  };

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
        <Badge variant="blue" dot className="text-xs">
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
        <ChartCard title="Product Mix" icon={PieChart} color="purple">
          <DoughnutChart data={productMixData} />
        </ChartCard>
      </div>

      {/* Tabs */}
      <div className="slide-in mt-6 mb-4 flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
        <TabButton isActive={activeTab === 'dashboard'} onClick={() => switchTab('dashboard')}>Dashboard</TabButton>
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

      {activeTab === 'leaderboard' && (
        <div id="tab-leaderboard" className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <h2 className="text-xl font-bold neon-text-purple">
                Team Leaderboard
                <span className="text-xs text-text-muted font-normal ml-2">(click any text to edit)</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => alert('Reset to defaults')}>↻ Reset</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Rep / Team</th>
                    <th className="pb-2">Store</th>
                    <th className="pb-2">Lines</th>
                    <th className="pb-2">Premium</th>
                    <th className="pb-2">Fiber</th>
                    <th className="pb-2">Commission</th>
                  </tr>
                </thead>
                <tbody id="leaderboardBody" className="divide-y divide-border-subtle">
                  {leaderboardData.map((entry, index) => (
                    <LeaderboardRow key={entry.rank} entry={entry} index={index} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Click any cell to edit stats or names
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'meeting' && (
        <div id="tab-meeting" className="tab-panel">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <h2 className="text-xl font-bold neon-text-blue">
                Meeting Mode · Daily Trackers
                <span className="text-xs text-text-muted font-normal ml-2">(click to edit)</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={() => alert('Reset to defaults')}>↻ Reset</Button>
            </div>

            {/* Daily Trackers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {meetingTrackers.map((tracker, i) => (
                <MeetingTracker key={i} {...tracker} />
              ))}
            </div>

            {/* Team View */}
            <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Teams Overview <span className="text-[10px] text-text-muted font-normal">(editable)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meetingTeams.map((team, i) => (
                <MeetingTeam key={i} {...team} />
              ))}
            </div>
            <div className="mt-3 text-xs text-text-secondary flex items-center gap-2">
              <Users className="w-3 h-3" />
              Click any number or name to edit for your daily standup
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div id="tab-pnl" className="tab-panel">
          <Card className="p-5">
            <h2 className="text-xl font-bold neon-text-cyan mb-4">Profit & Loss</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PNLCard title="Revenue" items={pnlRevenue} total={pnlTotalRevenue} color="green" icon={DollarSign} />
              <PNLCard title="Expenses" items={pnlExpenses} total={pnlTotalExpenses} color="red" icon={Receipt} />
            </div>
            <div className="mt-4 p-4 rounded-xl glass border border-accent-green/20 bg-accent-green/5">
              <div className="flex justify-between text-xl">
                <span className="font-bold">Net Profit</span>
                <span className={cn('font-bold', pnlNetProfit >= 0 ? 'text-accent-green' : 'text-accent-red')}>
                  {formatCurrency(pnlNetProfit)}
                </span>
              </div>
              <p className="text-xs text-text-secondary">{pnlMargin}% Margin</p>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'commission' && (
        <div id="tab-commission" className="tab-panel">
          <Card className="p-5">
            <h2 className="text-xl font-bold neon-text-blue mb-4">Commission Rules</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CommissionCategory title="📱 Phone" plans={phonePlans} icon={ZapIcon} color="blue" />
              <CommissionCategory title="🌐 Fiber" plans={fiberPlans} icon={TrendingUp} color="purple" />
              <CommissionCategory title="👥 Overrides" plans={overrides} icon={Users} color="yellow" />
            </div>
          </Card>
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