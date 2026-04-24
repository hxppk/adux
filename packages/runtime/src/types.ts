/**
 * @adux/runtime — public browser API contract.
 *
 * The runtime is injected into a dev-mode Vite app via @adux/vite-plugin.
 * It uses Bippy to hook React fiber commits, evaluates runtime rules against
 * live components, and renders violations as overlays in a Shadow DOM.
 */

export interface RuntimeOptions {
  /** Enable rendering of the overlay UI. Default: true. */
  overlay?: boolean;
  /** Show debug logs in console. Default: false. */
  debug?: boolean;
  /** Which severities to surface. Default: ["error", "warn"]. */
  severities?: Array<"error" | "warn">;
  /**
   * Launch-editor endpoint path relative to origin. Clicking a violation POSTs
   * { file, line } here and the vite-plugin middleware opens the editor.
   * Default: "/__adux/open-editor".
   */
  openEditorEndpoint?: string;
  /** Optional filter: only show violations whose ruleId matches. */
  ruleFilter?: (ruleId: string) => boolean;
  /** Override default runtime rules. */
  rules?: RuntimeRule[];
}

export interface RuntimeViolation {
  ruleId: string;
  message: string;
  severity: "error" | "warn";
  /** DOM element the violation applies to. May be null if the element was unmounted. */
  element: Element | null;
  /** Source location from fiber._debugSource, if available. */
  source?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
}

export interface Runtime {
  /** Stop the runtime, remove overlay, and release hooks. */
  stop(): void;
  /** Force a re-audit pass immediately. */
  audit(): void;
  /** Current violations in memory. */
  readonly violations: readonly RuntimeViolation[];
}

export type RuntimeInit = (options?: RuntimeOptions) => Runtime;

// ── Rules (public) ────────────────────────────────────────────────

export interface RuntimeRule {
  id: string;
  description: string;
  severity: "error" | "warn";
  /**
   * Called once per fiber per audit pass. Must be fast (<0.1ms per fiber).
   * Return 0+ violations. `void` is equivalent to an empty array.
   */
  check(ctx: RuntimeRuleContext): RuntimeViolation[] | void;
}

export interface RuntimeRuleContext {
  /** Opaque fiber reference (from Bippy). */
  fiber: unknown;
  /** Host DOM elements rendered by this fiber (empty for composites with no DOM). */
  elements: Element[];
  /** Component displayName, if known. */
  displayName?: string;
  /** React props at current commit (may be frozen). */
  props?: Record<string, unknown>;
  /** Source location from fiber._debugSource (dev mode only). */
  source?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
}
