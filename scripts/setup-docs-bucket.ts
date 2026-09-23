/**
 * Creates the private `tenant-docs` Storage bucket used by the document
 * library. Idempotent: re-running it is a no-op rather than an error, so it is
 * safe to run on every deploy.
 *
 * The bucket is PRIVATE on purpose. Nothing in the app ever hands out a public
 * URL: reads go through /api/docs/[id]/url, which re-checks the caller's
 * company + role and then mints a signed URL that expires in seconds.
 *
 * Run: npx tsx scripts/setup-docs-bucket.ts
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'tenant-docs';

// Only the formats we can actually render or parse. Anything else is rejected
// at upload time too, so this is defence in depth rather than the only gate.
const ALLOWED = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;

  if (existing?.some(b => b.name === BUCKET)) {
    // Still push the limits, in case they were widened by hand in the dashboard.
    const { error } = await supabase.storage.updateBucket(BUCKET, {
      public: false,
      allowedMimeTypes: ALLOWED,
      fileSizeLimit: MAX_BYTES,
    });
    if (error) throw error;
    console.log(`[setup] bucket "${BUCKET}" already existed - limits re-applied, still private`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ALLOWED,
    fileSizeLimit: MAX_BYTES,
  });
  if (error) throw error;
  console.log(`[setup] created private bucket "${BUCKET}" (limit ${MAX_BYTES / 1024 / 1024}MB)`);
}

main().catch(err => {
  console.error('[setup] failed:', err.message ?? err);
  process.exit(1);
});
