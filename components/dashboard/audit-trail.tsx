'use client';

import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

type AuditRow = {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  targetType: string | null;
  ip: string | null;
  createdAt: string;
};

const fetcher = async (url: string): Promise<{ rows: AuditRow[] }> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the audit trail');
  return response.json();
};

export function AuditTrail() {
  const { data, error, isLoading } = useSWR('/api/audit', fetcher, {
    revalidateOnFocus: false,
  });

  return (
    <Card className="slide-in mt-4 max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck aria-hidden="true" /> Security audit trail
        </CardTitle>
        <CardDescription>
          Recent sign-ins and administrative changes. Company owners see only their company; platform administrators see all companies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-text-muted">Loading audit events…</p>}
        {error && <p role="alert" className="text-sm text-accent-red">The audit trail could not be loaded.</p>}
        {!isLoading && !error && data?.rows.length === 0 && (
          <p className="text-sm text-text-muted">No security events have been recorded yet.</p>
        )}
        {!!data?.rows.length && (
          <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-bg-tertiary text-text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Target</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-primary">{row.action}</td>
                    <td className="px-3 py-2">
                      <span className="block text-text-primary">{row.actorEmail}</span>
                      <span className="text-text-muted">{row.actorRole}</span>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{row.targetType ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-text-muted">{row.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
