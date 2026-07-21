'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/components/white-label/theme-provider';
import { cn } from '@/lib/utils';
import { Palette, Globe, CheckCircle } from 'lucide-react';
import type { ThemePreset } from '@/lib/theme';

const PRESETS: { id: ThemePreset; name: string; swatch: string; note: string }[] = [
  { id: 'command-blue', name: 'Command Blue', swatch: 'linear-gradient(135deg,#60a5fa,#2563eb)', note: 'The default — electric blue on black' },
  { id: 'obsidian-gold', name: 'Obsidian & Gold', swatch: 'linear-gradient(135deg,#f9e9a4,#b8860b)', note: 'Black + shiny gold, premium feel' },
  { id: 'emerald', name: 'Emerald', swatch: 'linear-gradient(135deg,#6ee7b7,#059669)', note: 'Deep green accent on black' },
];

// White-label settings — fully client-side: changes apply instantly through the
// ThemeProvider (CSS variables + localStorage) and flow into the PDF header.

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState({
    companyName: theme.companyName,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    logoUrl: theme.logoUrl ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'domain'>('branding');

  const save = () => {
    setTheme({
      companyName: draft.companyName.trim() || 'Sales Engine',
      primaryColor: draft.primaryColor,
      secondaryColor: draft.secondaryColor,
      logoUrl: draft.logoUrl.trim() || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const colorField = (label: string, key: 'primaryColor' | 'secondaryColor') => (
    <div>
      <label className="label-base">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          className="w-10 h-10 rounded-lg border border-border-subtle bg-transparent cursor-pointer"
          aria-label={label}
        />
        <Input
          value={draft[key]}
          onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
          className="w-32 font-mono text-xs"
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="slide-in mb-6">
        <h1 className="text-2xl lg:text-4xl font-bold neon-text-blue">Settings</h1>
        <p className="text-text-secondary text-sm mt-0.5">White-label your Sales Engine — changes apply instantly, everywhere</p>
      </div>

      <div className="slide-in mb-4 flex gap-1.5">
        <button onClick={() => setActiveTab('branding')} className={cn('tab-btn', activeTab === 'branding' ? 'active' : 'inactive')}>
          <Palette className="w-3 h-3 inline mr-1" /> Branding
        </button>
        <button onClick={() => setActiveTab('domain')} className={cn('tab-btn', activeTab === 'domain' ? 'active' : 'inactive')}>
          <Globe className="w-3 h-3 inline mr-1" /> Domain
        </button>
      </div>

      {activeTab === 'branding' && (
        <Card className="slide-in p-6 max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle>Brand Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="label-base">Company Name</label>
              <Input
                value={draft.companyName}
                onChange={e => setDraft(d => ({ ...d, companyName: e.target.value }))}
                placeholder="Sales Engine"
                className="max-w-sm"
              />
              <p className="text-[10px] text-text-muted mt-1">Shows in the sidebar, browser tab, login page, and PDF reports.</p>
            </div>
            <div className="flex flex-wrap gap-6">
              {colorField('Primary Color', 'primaryColor')}
              {colorField('Secondary Color', 'secondaryColor')}
            </div>
            <div>
              <label className="label-base">Logo URL <span className="normal-case text-text-muted">(optional — replaces the text logo)</span></label>
              <Input
                value={draft.logoUrl}
                onChange={e => setDraft(d => ({ ...d, logoUrl: e.target.value }))}
                placeholder="https://…/logo.svg"
              />
              <p className="text-[10px] text-text-muted mt-1">SVG or PNG that reads well on a black background.</p>
            </div>

            {/* Theme presets — applies instantly, no save needed */}
            <div>
              <label className="label-base">Theme <span className="normal-case text-text-muted">(applies instantly)</span></label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESETS.map(p => {
                  const active = (theme.preset ?? 'command-blue') === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setTheme({ preset: p.id })}
                      className={cn(
                        'text-left p-3 rounded-xl border transition-all',
                        active ? 'border-border-strong bg-white/5 ring-1 ring-border-strong' : 'border-border-subtle hover:bg-white/5'
                      )}
                    >
                      <span className="block h-8 rounded-lg mb-2" style={{ background: p.swatch }} />
                      <span className="text-xs font-semibold flex items-center gap-1">{p.name}{active && <CheckCircle className="w-3 h-3 text-accent-green" />}</span>
                      <span className="text-[10px] text-text-muted">{p.note}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-text-muted mt-1">Data colors (green = profit, red = loss, blue = phone…) stay fixed for meaning; the theme changes the brand chrome.</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={save}>Save changes</Button>
              {saved && (
                <span className="text-xs text-accent-green flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved — applied everywhere
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'domain' && (
        <Card className="slide-in p-6 max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle>Custom Domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <p>To serve this app on your own subdomain (e.g. <span className="text-white font-mono text-xs">sales.yourdomain.com</span>):</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs">
              <li>Vercel → your project → <span className="text-white">Settings → Domains</span> → add the subdomain</li>
              <li>Copy the CNAME record Vercel shows you</li>
              <li>Add that CNAME at your domain registrar</li>
              <li>SSL is issued automatically within minutes</li>
            </ol>
            <p className="text-[10px] text-text-muted">Per-customer domains for white-label resale come with the multi-tenant database phase.</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
