import { prisma } from '@/lib/db';
import type { Actor } from '@/lib/archive';
import {
  listDocuments, createDocument, getDocument, deleteDocument,
  acknowledgeDocument, signedUrlFor, safeFileName, storagePathFor,
  DOC_BUCKET,
} from '@/lib/docs';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Integration test for the document library. Two throwaway tenants prove tenant
// isolation; extra seats prove the audience filter and the manage/view split.
// Uploads real bytes to the private bucket and cleans up objects + rows.

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}

// Minimal valid PDF so the MIME check and the viewer both see something real.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

async function main() {
  const stamp = Date.now();
  const a = await prisma.marketOwner.create({ data: { name: `__docs_A_${stamp}`, slug: `docs-a-${stamp}`, theme: {} } });
  const b = await prisma.marketOwner.create({ data: { name: `__docs_B_${stamp}`, slug: `docs-b-${stamp}`, theme: {} } });

  const ownerA: Actor = { userId: 'ua', email: 'a@t.local', role: 'OWNER', marketOwnerId: a.id, isSuperAdmin: false };
  const ownerB: Actor = { userId: 'ub', email: 'b@t.local', role: 'OWNER', marketOwnerId: b.id, isSuperAdmin: false };
  const repA: Actor = { userId: 'ra', email: 'rep@t.local', role: 'REP', marketOwnerId: a.id, isSuperAdmin: false };
  const leadA: Actor = { userId: 'la', email: 'lead@t.local', role: 'LEAD', marketOwnerId: a.id, isSuperAdmin: false };

  const created: string[] = [];

  try {
    // --- path helpers ---------------------------------------------------
    check('safeFileName strips traversal', safeFileName('../../etc/passwd.pdf') === 'etcpasswd.pdf');
    check('safeFileName never returns empty', safeFileName('') === 'file');
    check('storage path is tenant-prefixed', storagePathFor(a.id, 'doc1', 'x.pdf') === `${a.id}/doc1/x.pdf`);

    // --- upload ---------------------------------------------------------
    const companyWide = await createDocument(ownerA, {
      title: 'Company Handbook', kind: 'COMPLIANCE', bytes: PDF,
      fileName: 'handbook.pdf', mimeType: 'application/pdf', requiresAck: true,
    });
    created.push(companyWide.id);
    check('upload returns a doc', !!companyWide.id && companyWide.version === 1);
    check('upload records real byte size', companyWide.sizeBytes === PDF.byteLength);

    // --- tenant isolation ----------------------------------------------
    check('owner B sees none of owner A docs', (await listDocuments(ownerB)).length === 0);
    check('owner A sees own doc', (await listDocuments(ownerA)).length === 1);
    check('owner B cannot fetch owner A doc by id', (await getDocument(ownerB, companyWide.id)) === null);
    check('owner B gets no signed URL for owner A doc', (await signedUrlFor(ownerB, companyWide.id)) === null);

    // --- signed URL -----------------------------------------------------
    const url = await signedUrlFor(ownerA, companyWide.id);
    check('signed URL is minted for own doc', typeof url === 'string' && url!.includes('token='));
    check('signed URL is not a public URL', !!url && !url.includes('/public/'));

    // --- audience: company-wide is visible to a REP ---------------------
    check('rep sees company-wide doc', (await listDocuments(repA)).some(d => d.id === companyWide.id));

    // --- audience: role-targeted ---------------------------------------
    const leadOnly = await createDocument(ownerA, {
      title: 'Lead Playbook', kind: 'TRAINING', bytes: PDF,
      fileName: 'leads.pdf', mimeType: 'application/pdf', audienceRoles: ['LEAD'],
    });
    created.push(leadOnly.id);
    check('lead sees lead-targeted doc', (await listDocuments(leadA)).some(d => d.id === leadOnly.id));
    check('rep does NOT see lead-targeted doc', !(await listDocuments(repA)).some(d => d.id === leadOnly.id));
    check('rep cannot fetch lead-only doc by id', (await getDocument(repA, leadOnly.id)) === null);
    check('rep gets no signed URL for lead-only doc', (await signedUrlFor(repA, leadOnly.id)) === null);
    check('manager/owner always sees restricted doc', (await listDocuments(ownerA)).some(d => d.id === leadOnly.id));

    // --- audience: person-targeted -------------------------------------
    const personOnly = await createDocument(ownerA, {
      title: 'Your Onboarding', kind: 'TRAINING', bytes: PDF,
      fileName: 'onboard.pdf', mimeType: 'application/pdf', audiencePersonIds: ['EMP-0007'],
    });
    created.push(personOnly.id);
    check('named person sees their doc', (await listDocuments(repA, { personId: 'EMP-0007' })).some(d => d.id === personOnly.id));
    check('other person does not see it', !(await listDocuments(repA, { personId: 'EMP-9999' })).some(d => d.id === personOnly.id));

    // --- promo expiry ---------------------------------------------------
    const expired = await createDocument(ownerA, {
      title: 'Last Cycle Promo', kind: 'PROMO', bytes: PDF,
      fileName: 'old-promo.pdf', mimeType: 'application/pdf',
      effectiveTo: new Date(Date.now() - 86_400_000),
    });
    created.push(expired.id);
    check('expired promo hidden from the floor', !(await listDocuments(repA)).some(d => d.id === expired.id));
    check('expired promo still visible to manager', (await listDocuments(ownerA)).some(d => d.id === expired.id));

    // --- versioning -----------------------------------------------------
    const v2 = await createDocument(ownerA, {
      title: 'This Cycle Promo', kind: 'PROMO', bytes: PDF,
      fileName: 'new-promo.pdf', mimeType: 'application/pdf', supersedesId: expired.id,
    });
    created.push(v2.id);
    check('superseding bumps version', v2.version === 2 && v2.supersedesId === expired.id);
    let crossVersion = false;
    try {
      await createDocument(ownerB, {
        title: 'Hijack', kind: 'PROMO', bytes: PDF,
        fileName: 'h.pdf', mimeType: 'application/pdf', supersedesId: expired.id,
      });
    } catch { crossVersion = true; }
    check('cannot supersede another company doc', crossVersion);

    // --- rejected types / sizes ----------------------------------------
    let badMime = false;
    try {
      await createDocument(ownerA, {
        title: 'Nope', kind: 'OTHER', bytes: PDF,
        fileName: 'x.exe', mimeType: 'application/x-msdownload',
      });
    } catch { badMime = true; }
    check('unsupported MIME is rejected', badMime);

    let emptyFile = false;
    try {
      await createDocument(ownerA, {
        title: 'Empty', kind: 'OTHER', bytes: Buffer.alloc(0),
        fileName: 'e.pdf', mimeType: 'application/pdf',
      });
    } catch { emptyFile = true; }
    check('empty file is rejected', emptyFile);

    // --- acknowledgements ----------------------------------------------
    check('ack is recorded', await acknowledgeDocument(repA, companyWide.id, 'EMP-0007', 'Andre Collins'));
    check('ack is idempotent', await acknowledgeDocument(repA, companyWide.id, 'EMP-0007', 'Andre Collins'));
    const afterAck = await getDocument(ownerA, companyWide.id);
    check('exactly one ack after double-tap', afterAck?.ackCount === 1);
    check('manager sees who acknowledged', afterAck?.acks?.[0]?.personName === 'Andre Collins');
    check('cross-tenant ack refused', !(await acknowledgeDocument(ownerB, companyWide.id, 'EMP-1', 'X')));

    // --- soft delete ----------------------------------------------------
    check('cross-tenant delete refused', !(await deleteDocument(ownerB, companyWide.id)));
    check('own delete succeeds', await deleteDocument(ownerA, companyWide.id));
    check('deleted doc drops out of list', !(await listDocuments(ownerA)).some(d => d.id === companyWide.id));
    const row = await prisma.document.findUnique({ where: { id: companyWide.id } });
    check('soft delete keeps the row (recoverable)', !!row && !!row.deletedAt);
    const stillThere = await supabaseAdmin().storage.from(DOC_BUCKET).download(row!.storagePath);
    check('soft delete keeps the stored file', !stillThere.error);
  } finally {
    // Remove uploaded objects, then the tenants (rows cascade).
    const rows = await prisma.document.findMany({
      where: { id: { in: created } }, select: { storagePath: true },
    });
    const paths = rows.map(r => r.storagePath).filter(Boolean);
    if (paths.length) await supabaseAdmin().storage.from(DOC_BUCKET).remove(paths);
    await prisma.marketOwner.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
