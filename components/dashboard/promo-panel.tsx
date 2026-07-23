'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone, Plus, Trash2, Upload, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Editable, useLocalState } from './editable-sections';
import { isoToday } from '@/lib/roadtrips';

// Promotions to walk the floor through during the morning meeting.
//
// Links and notes PERSIST (they are a few hundred bytes). An attached PDF does
// NOT: it is held as an object URL for this meeting only. localStorage caps at
// ~5MB per origin shared across every se-* key, base64 inflates by ~33%, and
// Safari/Firefox count quota in UTF-16 — so one 2MB PDF would blow the whole
// budget and take the sales book down with it. Re-attach each morning instead.
export interface PromoItem {
  id: string;
  title: string;
  note: string;
  url: string;
  added: string;
}

export function PromoPanel() {
  const { state: promos, setState: setPromos } = useLocalState<PromoItem[]>('se-promo-v1', []);
  const [file, setFile] = useState<{ name: string; src: string } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke on replace/unmount so the blob doesn't leak across a long meeting.
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const attach = (f: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const src = URL.createObjectURL(f);
    objectUrlRef.current = src;
    setFile({ name: f.name, src });
  };

  const clearFile = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setFile(null);
  };

  const add = () =>
    setPromos(p => [...p, { id: `p${Date.now()}`, title: 'New promotion', note: '', url: '', added: isoToday() }]);

  const edit = (id: string, field: 'title' | 'note' | 'url', value: string) =>
    setPromos(p => p.map(x => (x.id === id ? { ...x, [field]: value } : x)));

  return (
    <div className="mt-5 pt-4 border-t border-border-subtle">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <Megaphone className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          Promotions &amp; announcements
        </h3>
        <button
          onClick={add}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add promo
        </button>
      </div>

      {promos.length === 0 && !file && (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5">
          Nothing queued. Add a promo, or drop in a PDF to show on screen for this meeting.
        </p>
      )}

      <div className="space-y-2">
        {promos.map(p => (
          <div key={p.id} className="group p-3 rounded-xl glass border border-border-subtle">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Editable
                value={p.title}
                onCommit={v => edit(p.id, 'title', v)}
                className="font-semibold text-sm flex-1 min-w-0"
              />
              <div className="flex items-center gap-1">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all"
                    aria-label={`Open ${p.title}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setPromos(v => v.filter(x => x.id !== p.id))}
                  className="p-1.5 rounded-lg text-text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-accent-red hover:bg-accent-red/10 transition-all"
                  aria-label={`Remove ${p.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <Editable
              value={p.note || 'Add the talk track…'}
              onCommit={v => edit(p.id, 'note', v)}
              className="block text-xs text-text-secondary mt-1"
            />
            <Editable
              value={p.url || 'Paste a link…'}
              onCommit={v => edit(p.id, 'url', v.startsWith('http') || !v.trim() ? v : `https://${v}`)}
              className="block text-[10px] text-text-muted mt-1 font-mono"
            />
          </div>
        ))}
      </div>

      <div className="mt-3">
        {file ? (
          <div className="rounded-xl glass border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-xs truncate">{file.name}</span>
              <button
                onClick={clearFile}
                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all"
                aria-label="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <iframe src={file.src} title={file.name} className="w-full h-[55vh] border-0 bg-black" />
          </div>
        ) : (
          <label className="cursor-pointer p-4 rounded-xl glass border border-dashed border-border-strong flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all">
            <Upload className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            <span className="text-xs font-medium">Attach a PDF or image for this meeting</span>
            <span className="text-[10px] text-text-muted">Shown on screen now — not saved after you reload</span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) attach(f); }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
