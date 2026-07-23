'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeyRound, CheckCircle } from 'lucide-react';

// Accounts are created by the vendor, which means the first password is one
// somebody else has seen. This is how a customer takes sole ownership of it.
export function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (next !== confirm) return setStatus({ ok: false, msg: 'New passwords do not match.' });
    if (next.length < 12) return setStatus({ ok: false, msg: 'Use at least 12 characters.' });

    setBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? 'Could not change password.' });
      } else {
        setStatus({ ok: true, msg: 'Password changed. Use it next time you sign in.' });
        setCurrent(''); setNext(''); setConfirm('');
      }
    } catch {
      setStatus({ ok: false, msg: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="slide-in p-6 max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[11px] text-text-muted mb-4">
          Your account was set up for you, so change this to something only you know.
        </p>
        <form onSubmit={submit} className="space-y-3">
          {status && (
            <div
              className={`p-3 rounded-lg text-sm flex items-center gap-2 border ${
                status.ok
                  ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {status.ok && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
              {status.msg}
            </div>
          )}
          <div>
            <label htmlFor="current-password" className="label-base">Current password</label>
            <Input
              id="current-password" type="password" value={current} autoComplete="current-password"
              onChange={e => setCurrent(e.target.value)} className="max-w-sm" required
            />
          </div>
          <div>
            <label htmlFor="new-password" className="label-base">New password</label>
            <Input
              id="new-password" type="password" value={next} autoComplete="new-password"
              onChange={e => setNext(e.target.value)} className="max-w-sm" required
              placeholder="At least 12 characters"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label-base">Confirm new password</label>
            <Input
              id="confirm-password" type="password" value={confirm} autoComplete="new-password"
              onChange={e => setConfirm(e.target.value)} className="max-w-sm" required
            />
          </div>
          <Button type="submit" loading={busy} disabled={busy}>Change password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
