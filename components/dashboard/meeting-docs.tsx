'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { DocViewer } from './doc-viewer';
import { fetchDocuments, formatBytes, type DocumentDTO } from '@/lib/docs-client';

// The document picker for Meeting Mode.
//
// Deliberately not the full Library: standing in front of the team you want the
// promo sheet on screen in one tap, not filters and an upload form. So this is a
// flat row of buttons that opens the same DocViewer, and nothing else.
//
// Promos lead because that is the biweekly thing a meeting is actually built
// around; training follows for onboarding sessions. Compliance and everything
// else stay in the Library, since reading a policy aloud is not a meeting.
const MEETING_KINDS = ['PROMO', 'TRAINING'] as const;

const KIND_LABEL: Record<string, string> = { PROMO: 'Promo', TRAINING: 'Training' };

export function MeetingDocs({
  personId,
  personName,
}: {
  personId?: string | null;
  personName?: string | null;
}) {
  const [docs, setDocs] = useState<DocumentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<DocumentDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      // One request per kind, then merged newest-first. The API filters by a
      // single kind and audience is enforced server-side, so a rep presenting
      // only ever sees what they are already allowed to open.
      const lists = await Promise.all(
        MEETING_KINDS.map(kind => fetchDocuments({ kind, personId }))
      );
      const merged = lists
        .flat()
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      setDocs(merged);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mb-5" aria-label="Meeting documents">
      <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />
        Promos &amp; training
        <span className="text-[10px] text-text-muted font-normal">
          (opens without leaving the meeting)
        </span>
      </h3>

      {loading && <p className="text-xs text-text-muted">Loading documents…</p>}

      {failed && !loading && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-text-muted">Could not load documents.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs inline-flex items-center gap-1 text-accent-blue hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {!loading && !failed && docs.length === 0 && (
        <p className="text-xs text-text-muted">
          No promo or training documents yet. Upload one in the Library to pull it up here.
        </p>
      )}

      {!loading && !failed && docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map(doc => (
            <button
              key={doc.id}
              type="button"
              onClick={() => setOpen(doc)}
              className="glass rounded-xl border border-border-subtle px-3 py-2 text-left hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
            >
              <span className="block text-xs font-medium">{doc.title}</span>
              <span className="block text-[10px] text-text-muted">
                {KIND_LABEL[doc.kind] ?? doc.kind} · {formatBytes(doc.sizeBytes)}
                {doc.requiresAck && !doc.ackedByMe ? ' · needs sign-off' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <DocViewer
          doc={open}
          personId={personId}
          personName={personName}
          onClose={() => setOpen(null)}
          // Refresh so a sign-off taken during the meeting is reflected on the
          // button straight away rather than looking unread until a reload.
          onAcked={() => void load()}
        />
      )}
    </section>
  );
}
