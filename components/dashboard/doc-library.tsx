'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { can, type Actor, type Role } from '@/lib/permissions';
import {
  fetchDocuments,
  uploadDocument,
  deleteDocumentApi,
  formatBytes,
  type DocumentDTO,
} from '@/lib/docs-client';
import { DocViewer } from './doc-viewer';

const KINDS = [
  { value: 'PROMO', label: 'Promo' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'ADASM', label: 'AD/ASM Course' },
  { value: 'OTHER', label: 'Other' },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map(k => [k.value, k.label]));

// Roles that can be targeted as an audience. OWNER is omitted: an owner already
// sees everything, so offering it as a filter would imply documents can be
// hidden from them.
const AUDIENCE_ROLES: Role[] = ['MANAGER', 'ASM', 'LEAD', 'REP', 'INTERN', 'VIEWER'];

// Labels for the auth *seat* roles. Deliberately separate from ROLE_LABELS in
// lib/utils, which names the five roster job titles and has no MANAGER/VIEWER —
// the two Role types look alike but mean different things, and indexing one with
// the other is how you end up shipping "undefined" into a permissions chip.
const SEAT_ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Market Owner',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
  ASM: 'ASM / AD',
  LEAD: 'Team Lead',
  REP: 'Sales Rep',
  INTERN: 'Intern',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** True when a promo's effective window has passed. */
function isExpired(doc: DocumentDTO): boolean {
  if (!doc.effectiveTo) return false;
  const end = new Date(doc.effectiveTo);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < Date.now();
}

export function DocLibrary({
  actor,
  personId,
  personName,
  people,
  compact,
}: {
  actor: Actor | null | undefined;
  /** Current viewer's person id, used for audience filtering + acks. */
  personId?: string | null;
  personName?: string | null;
  /** Roster, for targeting individuals on upload. */
  people?: Array<{ id?: string; employeeCode?: string; name: string }>;
  compact?: boolean;
}) {
  const manage = can(actor, 'docs.manage');
  const [docs, setDocs] = useState<DocumentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<string>('');
  const [viewing, setViewing] = useState<DocumentDTO | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const items = await fetchDocuments({ kind: kindFilter || undefined, personId });
    setDocs(items);
    setLoading(false);
  }, [kindFilter, personId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Promos first and newest-first within a kind: the current promo sheet is what
  // people open on a Monday morning, so it should never require scrolling.
  const sorted = useMemo(() => {
    const rank = (d: DocumentDTO) => (d.kind === 'PROMO' ? 0 : 1);
    return [...docs].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [docs]);

  const onDelete = async (doc: DocumentDTO) => {
    const ok = await deleteDocumentApi(doc.id);
    setNotice(ok ? `Moved "${doc.title}" to the recycle bin.` : `Could not remove "${doc.title}".`);
    if (ok) setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  return (
    <section aria-label="Document library" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Library {docs.length > 0 && <span className="normal-case tracking-normal">({docs.length})</span>}
        </h2>

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="doc-kind-filter" className="sr-only">
            Filter by document type
          </label>
          <select
            id="doc-kind-filter"
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="">All types</option>
            {KINDS.map(k => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>

          {manage && (
            <button type="button" className="btn-primary text-xs px-3 py-1.5" onClick={() => setUploadOpen(true)}>
              Upload
            </button>
          )}
        </div>
      </header>

      {notice && (
        <p role="status" className="text-xs text-text-muted bg-white/5 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading documents…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-text-muted bg-white/5 rounded-xl p-4">
          {manage
            ? 'No documents yet. Upload the current promo sheet or a training deck to get started.'
            : 'Nothing has been shared with you yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, compact ? 5 : undefined).map(doc => {
            const mine = doc.acks?.some(a => a.personId === personId);
            const expired = isExpired(doc);
            return (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setViewing(doc)}
                      className="text-sm font-medium text-text-primary hover:underline text-left truncate"
                    >
                      {doc.title}
                    </button>
                    <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-white/10 text-text-muted">
                      {KIND_LABEL[doc.kind] ?? doc.kind}
                    </span>
                    {doc.version > 1 && (
                      <span className="text-[10px] text-text-muted">v{doc.version}</span>
                    )}
                    {expired && (
                      <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-300">
                        Expired
                      </span>
                    )}
                    {doc.requiresAck && (
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
                          mine ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-text-muted'
                        }`}
                      >
                        {mine ? 'Read' : 'Needs read'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">
                    {formatBytes(doc.sizeBytes)}
                    {doc.effectiveFrom && ` · from ${fmtDate(doc.effectiveFrom)}`}
                    {doc.effectiveTo && ` to ${fmtDate(doc.effectiveTo)}`}
                    {!doc.effectiveFrom && ` · ${fmtDate(doc.createdAt)}`}
                    {doc.audienceRoles.length > 0 &&
                      ` · ${doc.audienceRoles.map(r => SEAT_ROLE_LABELS[r as Role] ?? r).join(', ')}`}
                    {doc.requiresAck && manage && ` · ${doc.ackCount} read`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2.5 py-1"
                    onClick={() => setViewing(doc)}
                  >
                    Open
                  </button>
                  {manage && (
                    <button
                      type="button"
                      aria-label={`Remove ${doc.title}`}
                      className="btn-ghost text-xs px-2 py-1 text-text-muted"
                      onClick={() => void onDelete(doc)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {viewing && (
        <DocViewer
          doc={viewing}
          personId={personId}
          personName={personName}
          onAcked={() => void reload()}
          onClose={() => setViewing(null)}
        />
      )}

      {uploadOpen && (
        <UploadModal
          people={people ?? []}
          existingPromos={docs.filter(d => d.kind === 'PROMO')}
          onClose={() => setUploadOpen(false)}
          onDone={msg => {
            setUploadOpen(false);
            setNotice(msg);
            void reload();
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function UploadModal({
  people,
  existingPromos,
  onClose,
  onDone,
}: {
  people: Array<{ id?: string; employeeCode?: string; name: string }>;
  existingPromos: DocumentDTO[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(onClose);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('PROMO');
  const [roles, setRoles] = useState<Role[]>([]);
  const [requiresAck, setRequiresAck] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [supersedes, setSupersedes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    // Falling back to the filename means a hurried upload still gets a sensible
    // label instead of an empty row in the library.
    const finalTitle = title.trim() || file.name.replace(/\.[^.]+$/, '');
    setBusy(true);
    setError(null);
    const res = await uploadDocument({
      file,
      title: finalTitle,
      kind,
      audienceRoles: roles,
      requiresAck,
      effectiveFrom: from || null,
      effectiveTo: to || null,
      supersedesId: supersedes || null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onDone(`Uploaded "${finalTitle}".`);
  };

  // Portalled to document.body like every other modal here. The Library renders
  // inside a `glass` Card whose backdrop-filter creates a containing block, so
  // a fixed overlay left in place gets trapped in that stacking context and the
  // dashboard toolbar paints over the form no matter how high its z-index is.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* The panel is fully opaque on purpose: `glass` plus an alpha background
          let the dashboard toolbar behind bleed through, which made the form
          labels hard to read. A data-entry dialog has to be solid. */}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Upload document"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border-strong bg-bg-secondary p-5 flex flex-col gap-3 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-text-primary">Upload document</h3>

        <div>
          <label htmlFor="doc-file" className="label-base">
            File
          </label>
          <input
            id="doc-file"
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.docx"
            className="w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-text-primary"
          />
          <p className="text-[10px] text-text-muted mt-1">PDF, spreadsheet, image, or Word. Max 25 MB.</p>
        </div>

        <div>
          <label htmlFor="doc-title" className="label-base">
            Title
          </label>
          <input
            id="doc-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Defaults to the file name"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary"
          />
        </div>

        <div>
          <label htmlFor="doc-kind" className="label-base">
            Type
          </label>
          <select
            id="doc-kind"
            value={kind}
            onChange={e => setKind(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary"
          >
            {KINDS.map(k => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        {kind === 'PROMO' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="doc-from" className="label-base">
                Effective from
              </label>
              <input
                id="doc-from"
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary"
              />
            </div>
            <div>
              <label htmlFor="doc-to" className="label-base">
                Through
              </label>
              <input
                id="doc-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={e => setTo(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary"
              />
            </div>
            {existingPromos.length > 0 && (
              <div className="col-span-2">
                <label htmlFor="doc-supersedes" className="label-base">
                  Replaces
                </label>
                <select
                  id="doc-supersedes"
                  value={supersedes}
                  onChange={e => setSupersedes(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-text-primary"
                >
                  <option value="">Nothing — this is new</option>
                  {existingPromos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} (v{p.version})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-text-muted mt-1">
                  The old sheet stays readable so past deals can still be checked.
                </p>
              </div>
            )}
          </div>
        )}

        <fieldset>
          <legend className="label-base">Who can see it</legend>
          <p className="text-[10px] text-text-muted mb-1.5">
            Leave all unchecked to share with the whole company.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCE_ROLES.map(r => {
              const on = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoles(prev => (on ? prev.filter(x => x !== r) : [...prev, r]))}
                  className={`text-[11px] rounded-full px-2.5 py-1 border ${
                    on
                      ? 'bg-brand/20 border-brand/40 text-text-primary'
                      : 'bg-white/5 border-white/10 text-text-muted'
                  }`}
                >
                  {SEAT_ROLE_LABELS[r] ?? r}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-xs text-text-primary">
          <input
            type="checkbox"
            checked={requiresAck}
            onChange={e => setRequiresAck(e.target.checked)}
            className="rounded"
          />
          Require everyone to confirm they read it
        </label>

        {error && (
          <p role="alert" className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary text-xs px-3 py-1.5"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
