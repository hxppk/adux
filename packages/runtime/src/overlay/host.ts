/**
 * Shadow DOM host — an isolated viewport-wide container that the overlay
 * renders into. Pointer events transparent by default; nested UI (the panel)
 * opts back in with `pointer-events: auto`.
 */

export interface HostRefs {
  root: ShadowRoot;
  /** Mount point for the Preact panel. */
  panelMount: HTMLElement;
  /** Full-screen canvas for outline drawing. */
  canvas: HTMLCanvasElement;
  destroy(): void;
}

const SHADOW_STYLE = `
  :host, * { box-sizing: border-box; }
  .adux-root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
  }
`;

export function createHost(): HostRefs {
  const hostEl = document.createElement("div");
  hostEl.setAttribute("data-adux", "");
  hostEl.style.cssText = [
    "position:fixed",
    "inset:0",
    "pointer-events:none",
    "z-index:2147483647",
    "contain:layout style",
  ].join(";");
  document.documentElement.appendChild(hostEl);

  const root = hostEl.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = SHADOW_STYLE;
  root.appendChild(style);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100vw",
    "height:100vh",
    "pointer-events:none",
  ].join(";");
  root.appendChild(canvas);

  const panelMount = document.createElement("div");
  panelMount.className = "adux-root";
  panelMount.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  root.appendChild(panelMount);

  return {
    root,
    panelMount,
    canvas,
    destroy() {
      hostEl.remove();
    },
  };
}
