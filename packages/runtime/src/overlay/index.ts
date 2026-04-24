export * from "./types.js";

import { createCanvasController } from "./canvas.js";
import { createHost } from "./host.js";
import { createPanelController } from "./panel.js";
import type { CreateOverlay, OverlayHandle, OverlayOptions } from "./types.js";
import type { RuntimeViolation } from "../types.js";

/**
 * W3.3 real implementation — Shadow DOM host + Canvas outlines + Preact panel.
 */
export const createOverlay: CreateOverlay = (
  options: OverlayOptions,
): OverlayHandle => {
  const {
    openEditorEndpoint,
    showPanel = true,
    showOutlines = true,
    severities = ["error", "warn"],
  } = options;

  const host = createHost();
  const canvas = showOutlines ? createCanvasController(host.canvas) : null;

  const openEditor = (file: string, line: number, column?: number) => {
    fetch(openEditorEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, line, column }),
    }).catch(() => {
      /* editor not running — ignore */
    });
  };

  const panel = showPanel
    ? createPanelController(host.panelMount, openEditor)
    : null;

  function filter(v: RuntimeViolation[]): RuntimeViolation[] {
    return v.filter((entry) => severities.includes(entry.severity));
  }

  return {
    setViolations(violations) {
      const filtered = filter(violations);
      canvas?.setViolations(filtered);
      panel?.setViolations(filtered);
    },
    destroy() {
      panel?.destroy();
      canvas?.destroy();
      host.destroy();
    },
  };
};
