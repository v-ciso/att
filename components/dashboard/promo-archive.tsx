'use client';

import { useState } from 'react';
import { Megaphone, ExternalLink, Trash2 } from 'lucide-react';
import { useLocalState } from './editable-sections';
import type { PromoItem } from './promo-panel';
import { can, type Actor } from '@/lib/permissions';

// Append-only history of promotions & announcements. Meeting Mode's promo
// panel is a working surface — promos get deleted there once the morning
// meeting moves on — so every add/edit is ALSO mirrored here (see
// upsertPromoArchive, called by PromoPanel). Deleting a promo from the meeting
// panel leaves its archive row intact: "what did we run in March" stays
// answerable. Each row carries the date it was first added, automatically.

export const PROMO_ARCHIVE_KEY = 'se-promo-archive-v1';

/**
 * Mirrors the meeting panel's current promos into the archive: new ids are
 * appended (keeping their original `added` date), existing ids are updated in
 * place, and nothing is ever removed. Called on every promo add/edit rather
 * than on a schedule so the archive can't miss a promo that was added and
 * deleted between snapshots.
 */
export function upsertPromoArchive(promos: PromoItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PROMO_ARCHIVE_KEY);
    const existing: PromoItem[] = raw ? JSON.parse(raw) : [];
    const byId = new Map(existing.map(p => [p.id, p]));
    for (const p of promos) {
      const prev = byId.get(p.id);
      // Original added date wins — the archive answers "when did this start".
      byId.set(p.id, { ...p, added: prev?.added ?? p.added });
    }
    window.localStorage.setItem(PROMO_ARCHIVE_KEY, JSON.stringify([...byId.values()]));
  } catch {
    // Quota or parse failure — the live meeting panel still works; the
    // archive just misses this write.
  }
}

export function PromoArchive({ actor }: { actor: Actor | null | undefined }) {
  const { state: items, setState: setItems } = useLocalState<PromoItem[]>(PROMO_ARCHIVE_KEY, []);
  const manage = can(actor, 'docs.manage');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => (b.added || '').localeCompare(a.added || ''));

  return (
    <section aria-label="Promotions and announcements history" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted flex items-center gap-2">
        <Megaphone className="w-4 h-4" aria-hidden="true" /> Promotions &amp; Announcements
        {sorted.length > 0 && <span className="normal-case tracking-normal">({sorted.length})</span>}
      </h2>
      <p className="text-xs text-text-muted -mt-1">
        Every promo added in Meeting Mode lands here automatically, dated the day it was added — even after it&apos;s cleared from the meeting screen.
      </p>

      {sorted.length === 0 ? (
        <p className="text-xs text-text-muted bg-white/5 rounded-xl p-4">
          Nothing yet. Add a promotion in Meeting Mode and it will appear here with its date.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map(p => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary truncate">{p.title}</span>
                  <span className="text-[10px] text-text-muted">
                    added {p.added ? new Date(p.added + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </div>
                {p.note && <p className="text-[11px] text-text-muted mt-0.5">{p.note}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all"
                    aria-label={`Open ${p.title}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                {manage && (
                  confirmId === p.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg bg-accent-red/15 text-accent-red hover:bg-accent-red/25"
                        onClick={() => { setItems(v => v.filter(x => x.id !== p.id)); setConfirmId(null); }}
                      >
                        Delete forever
                      </button>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:bg-white/10"
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
                      aria-label={`Delete ${p.title} from history`}
                      onClick={() => setConfirmId(p.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
