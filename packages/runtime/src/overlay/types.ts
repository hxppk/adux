import type { RuntimeViolation } from "../types.js";

/**
 * Overlay UI contract — W3.3 (Opus).
 *
 * Renders a Shadow-DOM-hosted overlay on the page with:
 *   - Canvas layer drawing red/yellow boxes around violating elements
 *   - Floating panel listing all current violations
 *   - Click → POST to openEditorEndpoint to launch editor
 */

export interface OverlayOptions {
  /** Endpoint that opens the IDE. POSTed JSON: {file, line, column?}. */
  openEditorEndpoint: string;
  /** Show the floating panel UI. Default: true. */
  showPanel?: boolean;
  /** Show canvas outlines. Default: true. */
  showOutlines?: boolean;
  /** Severities to render. Default: ["error", "warn"]. */
  severities?: Array<"error" | "warn">;
}

export interface OverlayHandle {
  /** Replace the full set of violations displayed. */
  setViolations(violations: RuntimeViolation[]): void;
  /** Tear down the overlay and remove its Shadow DOM host. */
  destroy(): void;
}

export type CreateOverlay = (options: OverlayOptions) => OverlayHandle;
