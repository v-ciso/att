'use client';

import { useState } from 'react';
import { Building2, Zap, TrendingUp, Users, Target, DollarSign, ArrowRight, CheckCircle, Star, Shield, Globe, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const features = [
  { icon: Zap, title: 'Real-Time Dashboard', desc: 'Daily production, weekly trends, MTD goals, and 3D charts — all in one command center', color: 'blue' },
  { icon: Users, title: 'Team Leaderboard', desc: 'Editable rankings with inline editing, auto-save, and PDF/CSV export', color: 'purple' },
  { icon: Target, title: 'Meeting Mode', desc: 'Full-screen presentation with daily trackers, team overviews, and keyboard navigation', color: 'cyan' },
  { icon: DollarSign, title: 'Commission Engine', desc: 'Editable phone/fiber plans, store multipliers, and role-based overrides', color: 'green' },
  { icon: TrendingUp, title: 'P&L Management', desc: 'Revenue vs expenses, roadtrip reimbursement (60%), net profit margin tracking', color: 'yellow' },
  { icon: Shield, title: 'Your Branding', desc: 'Drop in your own logo and pick your colors — the dashboard and every PDF report carry your company name', color: 'purple' },
];

// Priced per WEEK against the admin headcount it replaces, not per seat.
const plans = [
  {
    name: 'Single Operator',
    price: '494',
    unit: '/week',
    seats: 'One login',
    desc: 'You run the market from one screen',
    features: [
      'Full dashboard & Daily Tracker',
      'Leaderboard & Meeting Mode',
      'P&L & Commission Engine',
      'Schedule, Goals & Attendance',
      'Your logo & colors on the tool',
      'PDF exports with your name',
    ],
    cta: 'Request Access',
    popular: false,
    color: 'blue' as const,
  },
  {
    name: 'Team',
    price: '766',
    unit: '/week and up',
    seats: 'Up to 5 logins',
    desc: 'Your managers on the same synced dashboard',
    features: [
      'Everything in Single Operator',
      'Multiple logins for your company',
      'One shared set of numbers',
      'Per-person roles & permissions',
      'Priority support',
      'Onboarding session',
    ],
    cta: 'Request Access',
    popular: true,
    color: 'purple' as const,
  },
];

export default function DemoPage() {
  const router = useRouter();
  const [showDashboard, setShowDashboard] = useState(false);

  if (showDashboard) {
    return <DemoDashboard onBack={() => setShowDashboard(false)} />;
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="orb w-96 h-96 bg-accent-blue" style={{ top: '-100px', right: '-100px' }} />
      <div className="orb w-64 h-64 bg-accent-purple" style={{ bottom: '20%', left: '-50px' }} />
      <div className="orb w-80 h-80 bg-accent-cyan" style={{ top: '50%', right: '30%' }} />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border-subtle px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-accent-blue" />
          <span className="text-lg font-bold neon-brand">Sales Engine</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push('/login')}>Sign In</Button>
          <Button onClick={() => setShowDashboard(true)}>Live Demo</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <Badge variant="blue" className="mb-6">AT&T Retail Market Management</Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          <span className="neon-text-blue">Command Your Field.</span><br />
          <span className="neon-text-purple">Own Your Numbers.</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-8">
          The all-in-one sales management platform for AT&T Retail Market Owners.
          Track commissions, run morning meetings, manage teams, and monitor P&L — in one beautiful dashboard.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Button size="lg" onClick={() => setShowDashboard(true)}>
            <Zap className="w-5 h-5" /> Launch Live Demo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => router.push('/login')}>
            Sign In <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-text-muted text-sm mt-4">Accounts are set up for you — no sign-up form, no trial to cancel.</p>
      </section>

      {/* Stats Bar */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Capability claims, not usage stats. The previous numbers ("15,000+
              lines tracked", "$14M+ commission", "99.9% uptime") were invented —
              real prospects ask for references behind figures like that. */}
          {[
            { value: 'Every line', label: 'Priced through your own commission engine' },
            { value: 'Zero typing', label: 'Revenue derives from logged sales' },
            { value: 'Per store', label: 'Multipliers, shifts, and chargebacks' },
            { value: 'One screen', label: 'Run the morning meeting from it' },
          ].map((stat) => (
            <Card key={stat.label} className="text-center p-6">
              <p className="text-2xl font-bold neon-text-blue">{stat.value}</p>
              <p className="text-text-secondary text-sm">{stat.label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to <span className="neon-text-blue">Run Your Market</span></h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <Card key={feature.title} hover className="p-6">
              <feature.icon className={cn('w-8 h-8 mb-4', `text-accent-${feature.color}`)} />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-text-secondary text-sm">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Screenshot Preview */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">See It In Action</h2>
          <p className="text-text-secondary mb-6">Click the button below to launch a fully interactive demo with sample data.</p>
          <Button size="lg" onClick={() => setShowDashboard(true)}>
            <Zap className="w-5 h-5" /> Launch Interactive Demo
          </Button>
        </Card>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 mb-20">
        <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
        <p className="text-text-secondary text-center mb-2">
          Billed weekly through KGV Inc. We set your account up for you — try the live demo first.
        </p>
        <p className="text-text-muted text-center text-sm mb-12">
          This replaces the reporting grunt work five reps and admins do by hand every week.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card key={plan.name} variant={plan.popular ? 'neon-purple' : 'elevated'} className={cn('p-8 relative', plan.popular && 'border-accent-purple/30')}>
              {plan.popular && <Badge variant="purple" className="absolute -top-3 right-6">Most Popular</Badge>}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <p className="text-3xl font-bold mb-1">${plan.price}<span className="text-text-secondary text-lg font-normal">{plan.unit}</span></p>
              <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">{plan.seats}</p>
              <p className="text-text-secondary text-sm mb-6">{plan.desc}</p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-accent-green" />
                    {f}
                  </li>
                ))}
              </ul>
              {/* Accounts are provisioned by hand — /register is invite-only and
                  would 403, so the CTA opens a conversation instead. */}
              <Button
                fullWidth
                variant={plan.popular ? 'primary' : 'secondary'}
                onClick={() => { window.location.href = `mailto:sameer@khatriinc.com?subject=${encodeURIComponent(`Sales Engine — ${plan.name} access`)}`; }}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 pb-20">
        <h2 className="text-3xl font-bold mb-4">Ready to <span className="neon-text-blue">Command Your Field</span>?</h2>
        <p className="text-text-secondary mb-8">Walk through the live demo, then we&apos;ll set your account up.</p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Button size="lg" onClick={() => setShowDashboard(true)}>
            <Zap className="w-5 h-5" /> Try Live Demo
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => { window.location.href = 'mailto:sameer@khatriinc.com?subject=Sales%20Engine%20access'; }}
          >
            Request Access
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8 text-center text-text-muted text-sm">
        Sales Engine · AT&T Retail Sales Management Platform · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// Read-only week grid so a prospect can see that scheduling exists. The real
// Schedule tab is editable per store and drives the Daily Tracker's store lock.
function DemoSchedule() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const shifts: Record<string, string[]> = {
    'Sarah Johnson': ['AM', 'AM', 'SWING', 'OFF', 'PM', 'AM', 'OFF'],
    'Mike Chen': ['PM', 'OFF', 'AM', 'AM', 'SWING', 'PM', 'PM'],
    'Jessica Williams': ['SWING', 'PM', 'OFF', 'PM', 'AM', 'OFF', 'AM'],
    'Alex Thompson': ['AM', 'SWING', 'PM', 'AM', 'OFF', 'AM', 'SWING'],
  };
  const tone: Record<string, string> = {
    AM: 'bg-accent-green/15 text-accent-green border-accent-green/25',
    PM: 'bg-accent-purple/15 text-accent-purple border-accent-purple/25',
    SWING: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/25',
    OFF: 'bg-white/[0.04] text-text-muted border-border-subtle',
  };

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-1">Weekly Schedule</h3>
      <p className="text-xs text-text-secondary mb-4">
        Shift hours follow the retailer — Costco AM is 9–3:30, SWING 11–6, PM 3:30–8:30. A rep&apos;s
        scheduled store locks their sales entry for that day.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border-subtle">
              <th className="text-left pb-2 font-medium">Rep</th>
              {days.map(d => <th key={d} className="pb-2 font-medium">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(shifts).map(([name, week]) => (
              <tr key={name} className="border-b border-border-subtle/50">
                <td className="py-2 pr-3 whitespace-nowrap font-medium">{name}</td>
                {week.map((s, i) => (
                  <td key={i} className="py-2 text-center">
                    <span className={cn('inline-block px-2 py-1 rounded border text-[10px] font-semibold', tone[s])}>
                      {s}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DemoDashboard({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const stats = [
    { label: 'Daily Prod', value: '127', change: '+12.5%', color: 'blue' },
    { label: 'Weekly Prod', value: '843', change: '+8.2%', color: 'purple' },
    { label: 'Revenue', value: '$142K', change: '+15.3%', color: 'green' },
    { label: 'Premium Mix', value: '68.4%', change: '+2.1%', color: 'yellow' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-6 h-6 text-accent-blue" />
              <span className="text-xl font-bold text-text-primary">Sales Engine Demo</span>
            </div>
            <p className="text-text-secondary text-sm">Interactive preview with sample data</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="blue" dot>Live Preview</Badge>
            <Button variant="ghost" size="sm" onClick={onBack}>Back to Home</Button>
            <Button size="sm" onClick={() => { window.location.href = 'mailto:sameer@khatriinc.com?subject=Sales%20Engine%20access'; }}>Get Started</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
              <p className="text-[10px] text-accent-green">{stat.change}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1.5">
          {/* Explicit labels: capitalising the key rendered "pnl" as "Pnl". */}
          {([
            ['dashboard', 'Dashboard'],
            ['leaderboard', 'Leaderboard'],
            ['schedule', 'Schedule'],
            ['commission', 'Commission'],
            ['pnl', 'P&L'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn('tab-btn px-4 py-2 rounded-lg text-sm font-medium border transition', activeTab === tab ? 'active' : 'inactive')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content - Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-accent-yellow" /> Top Performers
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl glass">
                  <span className="text-xl font-bold text-accent-yellow">#1</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Sarah Johnson</p>
                    <p className="text-xs text-text-secondary">Costco · Clearwater</p>
                  </div>
                  <p className="font-bold text-accent-green">$480</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl glass">
                  <span className="text-xl font-bold text-text-secondary">#2</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Mike Chen</p>
                    <p className="text-xs text-text-secondary">Target · Tampa</p>
                  </div>
                  <p className="font-bold text-accent-green">$410</p>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl glass">
                  <span className="text-xl font-bold text-accent-orange">#3</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Jessica Williams</p>
                    <p className="text-xs text-text-secondary">BJ's · Orlando</p>
                  </div>
                  <p className="font-bold text-accent-green">$375</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-green" /> Weekly Goals
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">Total Lines</span>
                    <span className="font-medium text-accent-blue">843 / 1,000</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-bg-tertiary">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-blue to-blue-400" style={{ width: '84.3%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-secondary">Premium</span>
                    <span className="font-medium text-accent-purple">287 / 350</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-bg-tertiary">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-purple to-purple-400" style={{ width: '82%' }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab Content - Leaderboard */}
        {activeTab === 'leaderboard' && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Leaderboard <span className="text-xs text-text-muted font-normal">(click to edit)</span></h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Store</th>
                    <th className="pb-2">Lines</th>
                    <th className="pb-2">Premium</th>
                    <th className="pb-2">Fiber</th>
                    <th className="pb-2">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  <tr className="hover:bg-white/2">
                    <td className="py-2 font-bold">#1</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>Sarah Johnson</td>
                    <td className="py-2 text-text-secondary" contentEditable suppressContentEditableWarning>Costco</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>12</td>
                    <td className="py-2 text-accent-purple" contentEditable suppressContentEditableWarning>8</td>
                    <td className="py-2 text-accent-cyan" contentEditable suppressContentEditableWarning>3</td>
                    <td className="py-2 text-accent-green font-bold">$480</td>
                  </tr>
                  <tr className="hover:bg-white/2">
                    <td className="py-2 font-bold">#2</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>Mike Chen</td>
                    <td className="py-2 text-text-secondary" contentEditable suppressContentEditableWarning>Target</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>10</td>
                    <td className="py-2 text-accent-purple" contentEditable suppressContentEditableWarning>6</td>
                    <td className="py-2 text-accent-cyan" contentEditable suppressContentEditableWarning>4</td>
                    <td className="py-2 text-accent-green font-bold">$410</td>
                  </tr>
                  <tr className="hover:bg-white/2">
                    <td className="py-2 font-bold">#3</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>Jessica Williams</td>
                    <td className="py-2 text-text-secondary" contentEditable suppressContentEditableWarning>BJ's</td>
                    <td className="py-2" contentEditable suppressContentEditableWarning>9</td>
                    <td className="py-2 text-accent-purple" contentEditable suppressContentEditableWarning>5</td>
                    <td className="py-2 text-accent-cyan" contentEditable suppressContentEditableWarning>3</td>
                    <td className="py-2 text-accent-green font-bold">$375</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab Content - Commission */}
        {activeTab === 'commission' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-accent-blue/20">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-accent-blue"><Zap className="w-4 h-4" /> Phone Plans</h4>
              <div className="space-y-1">
                {/* Office payout per line at Tier 5. Next Up adds $15,
                    Insurance another $10 — shown as the combined line. */}
                {[
                  ['Premium 2.0', 144], ['Premium 2.0 + Next Up', 159],
                  ['Extra 2.0', 134], ['Extra 2.0 + Next Up', 149],
                  ['Value 2.0', 124], ['Value 2.0 + Next Up', 139],
                  ['Insurance attach', 10],
                ].map(([name, amt]) => (
                  <div key={name as string} className="flex justify-between text-xs py-1">
                    <span>{name}</span>
                    <span className="text-accent-green">${amt}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4 border-accent-purple/20">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-accent-purple"><TrendingUp className="w-4 h-4" /> Fiber Plans</h4>
              <div className="space-y-1">
                {[
                  ['Fiber 300', 250], ['Fiber 500', 300],
                  ['Fiber 1GIG', 360], ['Fiber 2GIG', 360], ['Fiber 5GIG', 400],
                ].map(([name, amt]) => (
                  <div key={name as string} className="flex justify-between text-xs py-1">
                    <span>{name}</span>
                    <span className="text-accent-green">${amt}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4 border-accent-yellow/20">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-accent-yellow"><Users className="w-4 h-4" /> Overrides</h4>
              <div className="space-y-1">
                {/* The owner is not a fixed cut — they keep what is left of the
                    office payout after the rep, lead, and ASM are paid. */}
                {[
                  ['Sales Rep', '$40/line'],
                  ['Team Lead', '$45/line'],
                  ['ASM / AD', '3% of team'],
                  ['Market Owner', 'remainder'],
                ].map(([name, amt]) => (
                  <div key={name} className="flex justify-between text-xs py-1">
                    <span>{name}</span>
                    <span className="text-accent-green">{amt}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Tab Content - P&L */}
        {activeTab === 'pnl' && (
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Profit & Loss</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm text-accent-green mb-2">Revenue</h4>
                <div className="space-y-1">
                  {[{ cat: 'Commission', amt: 142500 }, { cat: 'Bonus', amt: 12300 }].map((r) => (
                    <div key={r.cat} className="flex justify-between text-sm p-2 rounded-lg glass">
                      <span>{r.cat}</span>
                      <span className="text-accent-green">${r.amt.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm p-2 font-bold mt-2 border-t border-border-subtle">
                    <span>Total Revenue</span>
                    <span className="text-accent-green">$154,800</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm text-accent-red mb-2">Expenses</h4>
                <div className="space-y-1">
                  {[{ cat: 'Payroll', amt: 85000 }, { cat: 'Rent', amt: 18000 }, { cat: 'Travel', amt: 8500 }].map((e) => (
                    <div key={e.cat} className="flex justify-between text-sm p-2 rounded-lg glass">
                      <span>{e.cat}</span>
                      <span className="text-accent-red">${e.amt.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm p-2 font-bold mt-2 border-t border-border-subtle">
                    <span>Total Expenses</span>
                    <span className="text-accent-red">$111,500</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-xl glass border border-accent-green/20 bg-accent-green/5">
              <div className="flex justify-between text-xl">
                <span className="font-bold">Net Profit</span>
                <span className="font-bold text-accent-blue">$43,300</span>
              </div>
              <p className="text-xs text-text-secondary">28.0% Margin</p>
            </div>
          </Card>
        )}

        {activeTab === 'schedule' && <DemoSchedule />}

        {/* Demo Footer */}
        <div className="mt-8 text-center">
          <p className="text-text-muted text-xs mb-4">This is a demo with sample data. <a href="mailto:sameer@khatriinc.com?subject=Sales%20Engine%20access" className="text-accent-blue hover:underline">Ask us for an account</a> to get started.</p>
        </div>
      </div>
    </div>
  );
}
