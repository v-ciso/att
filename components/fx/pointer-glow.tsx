'use client';

import { useEffect, useRef } from 'react';

/**
 * A soft brand-tinted spotlight that trails the cursor — makes the flat black
 * canvas react to the user instead of sitting inert.
 *
 * Implementation notes:
 * - Writes CSS vars directly on the node inside requestAnimationFrame; no
 *   React state, so mousemove never triggers a render.
 * - The glow position eases toward the pointer (lerp) rather than snapping,
 *   which is what makes it read as light instead of a cursor decal.
 * - Desktop only: gated on (pointer: fine) — a touch screen has no cursor.
 * - prefers-reduced-motion disables the trailing animation entirely.
 */
export function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const fine = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduced.matches) return;

    let raf = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let running = false;

    const tick = () => {
      // Ease 12% of the remaining distance per frame — settles in ~0.4s.
      x += (targetX - x) * 0.12;
      y += (targetY - y) * 0.12;
      node.style.setProperty('--px', `${x.toFixed(1)}px`);
      node.style.setProperty('--py', `${y.toFixed(1)}px`);
      if (Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!node.classList.contains('is-active')) node.classList.add('is-active');
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const onLeave = () => node.classList.remove('is-active');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <div ref={ref} className="pointer-glow" aria-hidden="true" />;
}
