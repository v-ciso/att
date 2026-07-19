import { redirect } from 'next/navigation';

// PREVIEW MODE: no auth gate — go straight to the dashboard so the Vercel
// preview shows the product immediately. Restore the session check here when
// real auth is enabled (see git history for the original implementation).
export default function Home() {
  redirect('/dashboard');
}
