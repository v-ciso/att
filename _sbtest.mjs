import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1).replace(/^"|"$/g,'')];}));
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `probe-${Date.now()}@example.test`;
const { data, error } = await sb.auth.admin.createUser({ email, password: 'ProbePass12345', email_confirm: true });
if (error) { console.log('CREATE FAILED:', error.message); process.exit(1); }
console.log('CREATED auth user id:', data.user.id, 'email:', data.user.email);
// verify sign-in works
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY);
const { data: s, error: se } = await anon.auth.signInWithPassword({ email, password: 'ProbePass12345' });
console.log('SIGN-IN:', se ? 'FAILED '+se.message : 'OK, session for '+s.user.email);
// clean up
await sb.auth.admin.deleteUser(data.user.id);
console.log('cleaned up probe user');
