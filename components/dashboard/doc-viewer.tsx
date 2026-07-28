'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, FileWarning, Loader2, Check } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { documentFileUrl, acknowledgeDocumentApi, type DocumentDTO } from '@/lib/docs-client';

// In-app viewer, built for the biweekly promo sheet: open it on the floor,
// page through it, zoom in on a price. Renders PDFs to canvas with pdf.js and
// images with <img>; anything else (xlsx/docx) gets a download button, since
// there is no honest way to render a spreadsheet here.
//
// Bytes come from our own /api/docs/[id]/file route rather than a storage
// signed URL. Reps open these on carrier and corporate-VPN networks that block
// unknown third-party hosts, so a direct-to-storage fetch fails exactly where
// the viewer matters most; it also keeps the storage token out of the browser.
// pdf.js is handed the bytes, not a URL, so paging never re-downloads.

const RENDERABLE_IMAGE = /^image\/(png|jpe?g|webp)$/;

export function DocViewer({
  doc,
  personId,
  personName,
  onClose,
  onAcked,
}: {
  doc: DocumentDTO;
  personId?: string | null;
  personName?: string | null;
  onClose: () => void;
  onAcked?: (docId: string) => void;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [acking, setAcking] = useState(false);
  const [acked, setAcked] = useState(false);

  // Holds the loaded pdf.js document between page/zoom changes so paging does
  // not re-download (and re-sign) the file on every click.
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);
  // Guards against an unmount mid-load writing state into a dead component.
  const aliveRef = useRef(true);

  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = RENDERABLE_IMAGE.test(doc.mimeType);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Load once per document.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage('');

      // Same-origin, so no third-party host has to be reachable and no token
      // is exposed. Built synchronously; the route authorises each read.
      const url = documentFileUrl(doc.id, { personId });
      setDownloadUrl(documentFileUrl(doc.id, { personId, download: true }));

      if (isImage) {
        setImgSrc(url);
        setStatus('ready');
        return;
      }

      if (!isPdf) {
        // Spreadsheets/Word: offer the download rather than pretending to render.
        setStatus('ready');
        return;
      }

      try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        if (res.status === 404 || res.status === 403) {
          throw new Error('unauthorized');
        }
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        if (cancelled || !aliveRef.current) return;

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs')).default;
        const loaded = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled || !aliveRef.current) return;

        pdfRef.current = loaded as unknown as { numPages: number; getPage: (n: number) => Promise<unknown> };
        setPageCount(loaded.numPages);
        setPage(1);
        setStatus('ready');
      } catch (err) {
        if (cancelled || !aliveRef.current) return;
        setStatus('error');
        // Separate "you can't see this" from "this didn't render", so a rep is
        // not told to download a file they have no access to.
        setMessage(
          err instanceof Error && err.message === 'unauthorized'
            ? 'This document could not be opened. It may have been removed, or you may not have access.'
            : 'This PDF could not be displayed. Use Download to open it in your device viewer.'
        );
      }
    })();

    return () => { cancelled = true; };
  }, [doc.id, personId, isPdf, isImage]);

  // Draw the current page whenever it or the zoom changes.
  const render = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || status !== 'ready') return;
    try {
      const p = (await pdf.getPage(page)) as {
        getViewport: (o: { scale: number }) => { width: number; height: number };
        render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      };
      // Render at device pixel ratio so text stays crisp on phones, where reps
      // will actually be reading this.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: zoom * dpr });
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      await p.render({ canvasContext: ctx, viewport }).promise;
    } catch {
      // A cancelled render (fast paging) is normal; leave the last frame up.
    }
  }, [page, zoom, status]);

  useEffect(() => { void render(); }, [render]);

  const ack = async () => {
    if (!personId || !personName || acking || acked) return;
    setAcking(true);
    const ok = await acknowledgeDocumentApi(doc.id, personId, personName);
    setAcking(false);
    if (ok) {
      setAcked(true);
      onAcked?.(doc.id);
    }
  };

  const canPage = isPdf && pageCount > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={doc.title}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-4xl h-[92vh] sm:h-[88vh] flex flex-col glass border border-border-strong rounded-t-2xl sm:rounded-2xl overflow-hidden animate-scale-in bg-bg-secondary/95 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{doc.title}</h3>
            <p className="text-xs text-text-muted">
              {doc.kind.charAt(0) + doc.kind.slice(1).toLowerCase()}
              {doc.version > 1 ? ` · v${doc.version}` : ''}
              {canPage ? ` · ${pageCount} pages` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all shrink-0"
            aria-label="Close document"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-black/30 flex items-start justify-center p-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 text-text-muted my-auto">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              <p className="text-sm">Opening document…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-center my-auto max-w-sm">
              <FileWarning className="w-8 h-8 text-accent-amber" aria-hidden="true" />
              <p className="text-sm text-text-secondary">{message}</p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs px-3 py-2 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download
                </a>
              )}
            </div>
          )}

          {status === 'ready' && isPdf && <canvas ref={canvasRef} className="max-w-full shadow-lg" />}

          {status === 'ready' && isImage && imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image would need a remote pattern per tenant
            <img src={imgSrc} alt={doc.title} className="max-w-full h-auto shadow-lg rounded" />
          )}

          {status === 'ready' && !isPdf && !isImage && (
            <div className="flex flex-col items-center gap-3 text-center my-auto max-w-sm">
              <FileWarning className="w-8 h-8 text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary">
                {'Spreadsheets and Word files can\u2019t be previewed here. Download to open it on your device.'}
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-xs px-3 py-2 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border-subtle shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5">
            {canPage && (
              <>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-xs text-text-muted tabular-nums" aria-live="polite">
                  {page} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            )}
            {isPdf && status === 'ready' && (
              <>
                <button
                  onClick={() => setZoom(z => Math.max(0.6, +(z - 0.2).toFixed(1)))}
                  className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="text-xs text-text-muted tabular-nums w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))}
                  className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {doc.requiresAck && personId && (
              acked ? (
                <span className="text-xs text-accent-green inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" aria-hidden="true" /> Acknowledged
                </span>
              ) : (
                <button
                  onClick={ack}
                  disabled={acking}
                  className="btn-primary text-xs px-3 py-2 inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {acking ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                  {acking ? 'Saving…' : 'I have read this'}
                </button>
              )
            )}
            {downloadUrl && status === 'ready' && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-all inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" /> Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
