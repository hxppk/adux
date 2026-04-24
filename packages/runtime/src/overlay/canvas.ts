import type { RuntimeViolation } from "../types.js";

/**
 * Canvas outline layer. Tracks violations and redraws red/yellow outlines
 * around their host elements on every animation frame when dirty. Listens to
 * scroll/resize to stay aligned.
 */

export interface CanvasController {
  setViolations(violations: RuntimeViolation[]): void;
  /** Schedule a redraw (coalesced with RAF). */
  redraw(): void;
  destroy(): void;
}

const COLOR = {
  error: { stroke: "#f5222d", fill: "rgba(245,34,45,0.08)" },
  warn: { stroke: "#faad14", fill: "rgba(250,173,20,0.08)" },
} as const;

export function createCanvasController(
  canvas: HTMLCanvasElement,
): CanvasController {
  let violations: RuntimeViolation[] = [];
  let rafId: number | null = null;

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const v of violations) {
      if (!v.element) continue;
      const rect = v.element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const color = COLOR[v.severity];
      ctx.fillStyle = color.fill;
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  function redraw(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      draw();
    });
  }

  const onResize = () => {
    resize();
    redraw();
  };
  const onScroll = () => redraw();

  resize();
  window.addEventListener("resize", onResize);
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });

  return {
    setViolations(next) {
      violations = next;
      redraw();
    },
    redraw,
    destroy() {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, { capture: true });
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
