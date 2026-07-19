'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Save, Loader2, Globe, Palette, Shield, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

// Extend the session user type
interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
  marketOwnerId: string;
  employeeId?: string;
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const DEFAULT_THEME = {
  companyName: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#A855F7',
  accentColor: '#06B6D4',
  logo: '',
  customDomain: '',
  featureFlags: {
    hidePnL: false,
    hideCommissionEngine: false,
    hideTeamManagement: false,
    hideGoalsAttendance: false,
  },
};

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const extendedUser = session?.user as ExtendedUser | undefined;
  
  interface ThemeType {
    companyName: string;
    logo: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    customDomain: string;
    featureFlags: {
      hidePnL: boolean;
      hideCommissionEngine: boolean;
      hideTeamManagement: boolean;
      hideGoalsAttendance: boolean;
    };
  }
  
  const [theme, setTheme] = useState<ThemeType>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'branding' | 'billing' | 'features' | 'domain'>('branding');

  useEffect(() => {
    async function fetchTheme() {
      if (!extendedUser?.marketOwnerId) return;
      try {
        const res = await fetch('/api/whitelabel');
        if (res.ok) {
          const data = await res.json();
          setTheme({ ...DEFAULT_THEME, ...data.theme, customDomain: data.customDomain || '' });
        }
      } catch (e) {
        console.error('Failed to fetch theme:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchTheme();
  }, [session]);

  const handleInputChange = (field: string, value: any) => {
    setTheme((prev) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        const parentKey = parent as keyof typeof prev;
        return { ...prev, [parentKey]: { ...(prev[parentKey] as any), [child]: value } };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!extendedUser?.marketOwnerId) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/whitelabel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCheckout = async (priceId: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create checkout session' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to open billing portal' });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
        </div>
      </DashboardLayout>
    );
  }

  if (!extendedUser?.marketOwnerId || extendedUser.role !== 'OWNER') {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-accent-blue mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-text-secondary">Only Market Owners can access settings.</p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold neon-text-blue">Settings</h1>
          <p className="text-text-secondary mt-1">Manage your FieldOS configuration</p>
        </div>

        {message && (
          <div className={cn('mb-6 p-4 rounded-xl flex items-center gap-3', message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400')}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('branding')}
            className={cn('tab-btn px-4 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap', activeTab === 'branding' ? 'active' : 'inactive')}
          >
            <Palette className="w-4 h-4 mr-2" /> Branding
          </button>
          <button
            onClick={() => setActiveTab('domain')}
            className={cn('tab-btn px-4 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap', activeTab === 'domain' ? 'active' : 'inactive')}
          >
            <Globe className="w-4 h-4 mr-2" /> Domain
          </button>
          <button
            onClick={() => setActiveTab('features')}
            className={cn('tab-btn px-4 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap', activeTab === 'features' ? 'active' : 'inactive')}
          >
            <Shield className="w-4 h-4 mr-2" /> Features
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={cn('tab-btn px-4 py-2 rounded-lg text-sm font-medium border transition whitespace-nowrap', activeTab === 'billing' ? 'active' : 'inactive')}
          >
            <CreditCard className="w-4 h-4 mr-2" /> Billing
          </button>
        </div>

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <Card className="p-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent-purple" />
                Brand Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="label-base">Company Name</label>
                <Input
                  value={theme.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="FieldOS"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label-base">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={theme.primaryColor}
                      onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border border-border-subtle"
                    />
                    <Input
                      value={theme.primaryColor}
                      onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-base">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={theme.secondaryColor}
                      onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border border-border-subtle"
                    />
                    <Input
                      value={theme.secondaryColor}
                      onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-base">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={theme.accentColor}
                      onChange={(e) => handleInputChange('accentColor', e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border border-border-subtle"
                    />
                    <Input
                      value={theme.accentColor}
                      onChange={(e) => handleInputChange('accentColor', e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label-base">Logo URL</label>
                <Input
                  value={theme.logo}
                  onChange={(e) => handleInputChange('logo', e.target.value)}
                  placeholder="https://example.com/logo.svg"
                />
                <p className="text-xs text-text-muted mt-1">Recommended: SVG format, works on dark backgrounds</p>
              </div>

              <div className="flex justify-end pt-4 border-t border-border-subtle">
                <Button onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4" />
                  Save Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Domain Tab */}
        {activeTab === 'domain' && (
          <Card className="p-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent-cyan" />
                Custom Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="label-base">Custom Domain</label>
                <div className="flex items-center gap-3">
                  <Input
                    value={theme.customDomain}
                    onChange={(e) => handleInputChange('customDomain', e.target.value)}
                    placeholder="app.yourcompany.com"
                  />
                  <span className="text-text-muted">.yourcompany.com</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Configure a CNAME record pointing to <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">cname.vercel-dns.com</code>
                </p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-border-subtle">
                <h4 className="font-medium mb-3">DNS Configuration</h4>
                <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
                  <li>Go to your domain provider (GoDaddy, Cloudflare, Namecheap, etc.)</li>
                  <li>Add a CNAME record: <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">app</code> → <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded">cname.vercel-dns.com</code></li>
                  <li>Wait for DNS propagation (up to 48 hours)</li>
                  <li>Enter your subdomain above and save</li>
                </ol>
              </div>

              <div className="flex justify-end pt-4 border-t border-border-subtle">
                <Button onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4" />
                  Save Domain
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <Card className="p-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent-yellow" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'hidePnL', label: 'Hide P&L / Expenses', description: 'Remove financial reporting from navigation' },
                { key: 'hideCommissionEngine', label: 'Hide Commission Engine', description: 'Remove commission rules and payout calculator' },
                { key: 'hideTeamManagement', label: 'Hide Team Management', description: 'Remove team creation and member assignment' },
                { key: 'hideGoalsAttendance', label: 'Hide Goals & Attendance', description: 'Remove goal tracking and daily check-ins' },
              ].map((feature) => (
                <div key={feature.key} className="flex items-center justify-between p-4 glass rounded-xl">
                  <div>
                    <p className="font-medium">{feature.label}</p>
                    <p className="text-xs text-text-muted">{feature.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={theme.featureFlags[feature.key as keyof typeof theme.featureFlags]}
                      onChange={(e) => handleInputChange(`featureFlags.${feature.key}`, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
                  </label>
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t border-border-subtle">
                <Button onClick={handleSave} loading={saving}>
                  <Save className="w-4 h-4" />
                  Save Features
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <Card className="p-6">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-accent-green" />
                Billing & Subscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card variant="bordered" className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Current Plan</h4>
                    <Badge variant={extendedUser?.subscriptionTier === 'WHITE_LABEL' ? 'purple' : 'blue'}>
                      {extendedUser?.subscriptionTier === 'WHITE_LABEL' ? 'White-Label' : 'Standard'}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {extendedUser?.subscriptionTier === 'WHITE_LABEL' ? '$494' : '$297'}<span className="text-text-secondary text-base">/mo</span>
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {extendedUser?.subscriptionTier === 'WHITE_LABEL' 
                      ? 'Includes white-label branding, custom domain, unlimited users' 
                      : 'Full dashboard, leaderboard, meeting mode, P&L, commission engine'}
                  </p>
                </Card>

                <Card variant="bordered" className="p-4">
                  <h4 className="font-medium mb-2">Payment Method</h4>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className="w-10 h-6 rounded bg-gradient-to-r from-blue-500 to-indigo-600" />
                    <div>
                      <p className="text-sm font-medium">Visa ending in 4242</p>
                      <p className="text-xs text-text-muted">Expires 12/2026</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={handlePortal}>
                    Manage in Stripe Portal
                  </Button>
                </Card>
              </div>

              {extendedUser?.subscriptionTier === 'STANDARD' && (
                <div className="p-4 glass rounded-xl border border-accent-purple/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-accent-purple">Upgrade to White-Label</h4>
                      <p className="text-sm text-text-secondary mt-1">Custom branding, custom domain, branded PDFs, unlimited users</p>
                    </div>
                    <Button 
                      variant="accent-purple" 
                      onClick={() => handleCreateCheckout('price_whitelabel_monthly')}
                      loading={saving}
                    >
                      Upgrade to $494/mo
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-border-subtle">
                <Button variant="secondary" onClick={handlePortal}>
                  Open Billing Portal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}