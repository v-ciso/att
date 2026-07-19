'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/components/white-label/theme-provider';
import { Loader2, Mail, Lock, User, Building2, AlertCircle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [formData, setFormData] = useState({
    companyName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
    slug: '',
    storeCount: '1',
    tier: 'STANDARD',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Your name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.slug.trim()) newErrors.slug = 'Subdomain is required';
    else if (!/^[a-z0-9-]+$/.test(formData.slug)) newErrors.slug = 'Only lowercase letters, numbers, and hyphens';
    if (!formData.storeCount) newErrors.storeCount = 'Store count is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateStep2()) return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          setErrors({ [data.field]: data.error });
        } else {
          setErrors({ form: data.error || 'Registration failed' });
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login?registered=true'), 2000);
    } catch {
      setErrors({ form: 'An error occurred. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="orb w-96 h-96 bg-accent-blue" style={{ top: '-100px', right: '-100px' }} />
      <div className="orb w-64 h-64 bg-accent-purple" style={{ bottom: '20%', left: '-50px' }} />

      <Card className="w-full max-w-lg" variant="elevated">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Building2 className="w-8 h-8 text-accent-blue" />
            <span className="text-2xl font-bold neon-text-blue">Sales Engine</span>
          </div>
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="text-text-secondary text-sm mt-1">Set up your white-label sales dashboard</p>
        </div>

        {success && (
          <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Account created! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.form && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errors.form}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4" data-step="1">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center text-xs font-bold">1</span>
                Company & Owner Info
              </h3>

              <div className="space-y-2">
                <label htmlFor="companyName" className="label-base">Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="e.g., Thompson Wireless"
                    error={errors.companyName}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="ownerName" className="label-base">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => handleInputChange('ownerName', e.target.value)}
                    placeholder="e.g., Alex Thompson"
                    error={errors.ownerName}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="label-base">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="you@company.com"
                    error={errors.email}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="label-base">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="••••••••"
                    error={errors.password}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="label-base">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate_y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="••••••••"
                    error={errors.confirmPassword}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4" data-step="2">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold">2</span>
                White-Label Setup
              </h3>

              <div className="space-y-2">
                <label htmlFor="slug" className="label-base">Subdomain <span className="text-xs text-text-muted">(yourcompany.fieldos.app)</span></label>
                <div className="relative">
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="thompson-wireless"
                    error={errors.slug}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">.fieldos.app</span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="storeCount" className="label-base">Number of Stores</label>
                <select
                  id="storeCount"
                  value={formData.storeCount}
                  onChange={(e) => handleInputChange('storeCount', e.target.value)}
                  className="input-base"
                >
                  <option value="1">1 Store</option>
                  <option value="2">2 Stores</option>
                  <option value="3">3 Stores</option>
                  <option value="4">4 Stores</option>
                  <option value="5">5 Stores</option>
                  <option value="6">6 Stores</option>
                  <option value="7">7 Stores</option>
                  <option value="8">8 Stores</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="label-base">Plan Tier</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`relative cursor-pointer p-3 rounded-xl border-2 transition-all ${formData.tier === 'STANDARD' ? 'border-accent-blue bg-accent-blue/10' : 'border-border-subtle hover:border-accent-blue/50'}`}>
                    <input
                      type="radio"
                      name="tier"
                      value="STANDARD"
                      checked={formData.tier === 'STANDARD'}
                      onChange={(e) => handleInputChange('tier', e.target.value)}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-medium">Standard</p>
                      <p className="text-xs text-text-muted">$297/mo</p>
                      <ul className="text-xs text-text-secondary mt-2 space-y-1 text-left">
                        <li>• Full dashboard</li>
                        <li>• Leaderboard & Meeting Mode</li>
                        <li>• P&L & Commission Engine</li>
                        <li>• Up to 50 users</li>
                      </ul>
                    </div>
                  </label>
                  <label className={`relative cursor-pointer p-3 rounded-xl border-2 transition-all ${formData.tier === 'WHITE_LABEL' ? 'border-accent-purple bg-accent-purple/10' : 'border-border-subtle hover:border-accent-purple/50'}`}>
                    <input
                      type="radio"
                      name="tier"
                      value="WHITE_LABEL"
                      checked={formData.tier === 'WHITE_LABEL'}
                      onChange={(e) => handleInputChange('tier', e.target.value)}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-medium">White-Label</p>
                      <p className="text-xs text-text-muted">$494/mo</p>
                      <ul className="text-xs text-text-secondary mt-2 space-y-1 text-left">
                        <li>• Everything in Standard</li>
                        <li>• Custom branding & domain</li>
                        <li>• Branded PDF exports</li>
                        <li>• Unlimited users</li>
                      </ul>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step === 2 && (
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
            )}
            <Button type="submit" className="flex-1" loading={isLoading}>
              {step === 1 ? 'Continue' : 'Create Account'}
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-accent-blue hover:underline font-medium">
            Sign in
          </a>
        </p>
      </Card>
    </div>
  );
}