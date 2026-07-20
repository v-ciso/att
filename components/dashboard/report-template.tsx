'use client';

import { LeaderboardEntry } from './dashboard-components';
import { DEFAULT_PNL, PnlState } from './editable-sections';
import { loadPeople, loadPromoRules, promotionStatus, ROSTER_ROLE_LABELS } from './roster';
import { loadCommission } from '@/lib/sales';

// Branded PDF report. Rendered off-screen only during export and captured by
// html2pdf/html2canvas — so everything uses plain inline styles (no glass
// effects, no CSS variables) for reliable canvas rendering on white.

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const ACCENT = '#2563EB';
const INK = '#111827';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';

const th: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 9, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: MUTED, borderBottom: `2px solid ${INK}`,
};
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 11, color: INK, borderBottom: `1px solid ${LINE}` };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 8px' }}>
      <div style={{ width: 4, height: 14, background: ACCENT, borderRadius: 2 }} />
      <h2 style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h2>
    </div>
  );
}

export function ReportTemplate({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const theme = load<{ companyName?: string; primaryColor?: string }>('se-theme-v1', {});
  const commission = loadCommission();
  const pnl = load<PnlState>('se-pnl-v1', DEFAULT_PNL);
  const people = loadPeople();
  const promoRules = loadPromoRules();

  const companyName = theme.companyName || 'Sales Engine';
  const accent = theme.primaryColor || ACCENT;

  const rate = Math.min(100, Math.max(0, pnl.reimburseRate)) / 100;
  const roadtripCost = pnl.roadtrips.reduce((a, b) => a + b.amount, 0);
  const reimbursement = roadtripCost * rate;
  const totalRevenue = pnl.revenue.reduce((a, b) => a + b.amount, 0) + reimbursement;
  const totalExpenses = pnl.expenses.reduce((a, b) => a + b.amount, 0) + roadtripCost;
  const net = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? ((net / totalRevenue) * 100).toFixed(1) : '0.0';

  const totalLines = leaderboard.reduce((a, b) => a + b.lines, 0);
  const totalCommission = leaderboard.reduce((a, b) => a + b.commission, 0);
  const store = commission.stores[commission.storeIndex] ?? commission.stores[0];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const kpis = [
    { label: 'Total Lines', value: String(totalLines) },
    { label: 'Team Commission', value: fmt(totalCommission) },
    { label: 'Net Profit', value: fmt(net) },
    { label: 'Margin', value: `${margin}%` },
  ];

  return (
    <div id="pdf-report" style={{ width: '100%', maxWidth: 780, margin: '0 auto', background: '#E9ECF1', fontFamily: 'Inter, Arial, sans-serif', color: INK }}>
      {/* Header band */}
      <div style={{ background: '#000000', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{companyName}</p>
          <p style={{ color: '#9CA3AF', fontSize: 10, margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Performance Report · AT&amp;T Retail
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#FFFFFF', fontSize: 11, margin: 0 }}>{today}</p>
          <p style={{ color: '#9CA3AF', fontSize: 10, margin: '2px 0 0' }}>
            Tier {commission.tier} · {store?.name ?? '—'}
          </p>
        </div>
      </div>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, #A855F7, #06B6D4)` }} />

      <div style={{ padding: '16px 28px 24px' }}>
        {/* KPI row */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '5px 0', marginTop: 6, tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              {kpis.map(k => (
                <td key={k.label} style={{ background: '#FFFFFF', border: `1px solid ${LINE}`, borderLeft: `3px solid ${accent}`, borderRadius: 6, padding: '10px 12px', verticalAlign: 'top' }}>
                  <p style={{ fontSize: 9, color: MUTED, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{k.label}</p>
                  <p style={{ fontSize: 17, fontWeight: 800, margin: '3px 0 0', color: INK, whiteSpace: 'nowrap' }}>{k.value}</p>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Leaderboard */}
        <SectionTitle>Team Leaderboard</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '6%' }} /><col style={{ width: '28%' }} /><col style={{ width: '16%' }} />
            <col style={{ width: '11%' }} /><col style={{ width: '13%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>#</th><th style={th}>Rep / Team</th><th style={th}>Store</th>
              <th style={{ ...th, textAlign: 'right' }}>Lines</th>
              <th style={{ ...th, textAlign: 'right' }}>Premium</th>
              <th style={{ ...th, textAlign: 'right' }}>Fiber</th>
              <th style={{ ...th, textAlign: 'right' }}>Commission</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((e, i) => (
              <tr key={i} style={{ background: i % 2 ? '#F9FAFB' : '#FFFFFF' }}>
                <td style={{ ...td, fontWeight: 700, color: i < 3 ? accent : MUTED }}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                <td style={{ ...td, color: MUTED }}>{e.store}</td>
                <td style={{ ...td, textAlign: 'right' }}>{e.lines}</td>
                <td style={{ ...td, textAlign: 'right' }}>{e.premium}</td>
                <td style={{ ...td, textAlign: 'right' }}>{e.fiber}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#047857' }}>{fmt(e.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* P&L */}
        <SectionTitle>Profit &amp; Loss</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px 0', tableLayout: 'fixed' }}><tbody><tr>
          <td style={{ verticalAlign: 'top' }}>
            {pnl.revenue.map(r => (
              <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: `1px solid ${LINE}` }}>
                <span>{r.name}</span><span style={{ color: '#047857', fontWeight: 600 }}>{fmt(r.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: `1px solid ${LINE}` }}>
              <span>Roadtrip reimbursement ({pnl.reimburseRate}%)</span>
              <span style={{ color: '#047857', fontWeight: 600 }}>{fmt(reimbursement)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 800 }}>
              <span>Total Revenue</span><span style={{ color: '#047857' }}>{fmt(totalRevenue)}</span>
            </div>
          </td>
          <td style={{ verticalAlign: 'top' }}>
            {pnl.expenses.map(x => (
              <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: `1px solid ${LINE}` }}>
                <span>{x.name}</span><span style={{ color: '#B91C1C', fontWeight: 600 }}>{fmt(x.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: `1px solid ${LINE}` }}>
              <span>Roadtrips</span><span style={{ color: '#B91C1C', fontWeight: 600 }}>{fmt(roadtripCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, fontWeight: 800 }}>
              <span>Total Expenses</span><span style={{ color: '#B91C1C' }}>{fmt(totalExpenses)}</span>
            </div>
          </td>
        </tr></tbody></table>
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 6, background: net >= 0 ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${net >= 0 ? '#A7F3D0' : '#FECACA'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Net Profit</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: net >= 0 ? '#047857' : '#B91C1C' }}>{fmt(net)} <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>({margin}% margin)</span></span>
        </div>

        {/* Commission structure */}
        <SectionTitle>Payout Structure — Tier {commission.tier} · {store?.name}</SectionTitle>
        <div style={{ display: 'flex', gap: 16 }}>
          {([['Phone Lines', commission.phonePlans], ['Internet', commission.internet], ['Add-Ons', commission.addOns]] as const).map(([title, items]) => (
            <div key={title} style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>{title}</p>
              {items.map(p => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10.5, borderBottom: `1px solid ${LINE}` }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 700 }}>
                    {fmt(p.payout)} <span style={{ fontWeight: 500, color: MUTED }}>· rep {fmt(p.rep ?? 0)}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Roster & leadership roadmap */}
        <SectionTitle>Roster &amp; Leadership Roadmap</SectionTitle>
        <p style={{ fontSize: 9, color: MUTED, margin: '0 0 6px' }}>
          Promotion rule: {fmt(promoRules.profitPerWeek)}/week profit for {promoRules.weeks} week(s) with ≥{promoRules.minAttendance}% attendance.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '22%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} />
            <col style={{ width: '15%' }} /><col style={{ width: '12%' }} /><col style={{ width: '9%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th}>Employee</th><th style={th}>Role</th><th style={th}>Store</th><th style={th}>Team</th>
              <th style={{ ...th, textAlign: 'right' }}>Wk Profit</th>
              <th style={{ ...th, textAlign: 'right' }}>Attend.</th>
              <th style={th}>Roadmap</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => {
              const status = promotionStatus(p, promoRules);
              return (
                <tr key={p.id} style={{ background: i % 2 ? '#F9FAFB' : '#FFFFFF' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={td}>{ROSTER_ROLE_LABELS[p.role]}</td>
                  <td style={{ ...td, color: MUTED }}>{(p.stores ?? []).join(', ')}</td>
                  <td style={{ ...td, color: MUTED }}>{p.team || '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fmt(p.weeklyProfit[p.weeklyProfit.length - 1] ?? 0)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{p.attendance}%</td>
                  <td style={{ ...td, fontWeight: 600, color: status.ready ? '#047857' : MUTED }}>{status.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 22, paddingTop: 10, borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, color: MUTED }}>Generated {new Date().toLocaleString('en-US')}</span>
          <span style={{ fontSize: 9, color: MUTED }}>{companyName} · Powered by Sales Engine</span>
        </div>
      </div>
    </div>
  );
}
