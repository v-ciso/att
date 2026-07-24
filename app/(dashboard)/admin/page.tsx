import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/admin';
import { AdminConsole } from '@/components/admin/admin-console';

// Vendor-only. A customer OWNER runs their own company; only KGV Inc staff
// reach this page, so it is checked super-admin server-side (and again in the
// API). A non-admin who guesses the URL is bounced to their dashboard.
export default async function AdminPage() {
  const admin = await requireSuperAdmin();
  if (!admin) redirect('/dashboard');
  return <AdminConsole adminEmail={admin} />;
}
