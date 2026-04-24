import type {
  RuntimeRule,
  RuntimeRuleContext,
  RuntimeViolation,
} from "../types.js";

// Re-export so W3.2 implementation and callers keep importing from here.
export type { RuntimeRule, RuntimeRuleContext };

/**
 * Instrumentation contract — W3.2 (deepseek) satisfied.
 *
 * Wraps Bippy's `instrument()` + `onCommitFiberRoot` to audit React fiber
 * commits against runtime rules and surface violations to the overlay.
 */

export interface InstrumentOptions {
  debug?: boolean;
  /** Debounce window for audit passes. Default: 100ms. */
  auditDebounceMs?: number;
}

export interface InstrumentHandle {
  /** Force an immediate audit pass (skip debounce). */
  auditNow(): void;
  /** Stop the instrumentation and release Bippy hooks. */
  stop(): void;
}

export type StartInstrument = (
  rules: RuntimeRule[],
  onViolations: (violations: RuntimeViolation[]) => void,
  options?: InstrumentOptions,
) => InstrumentHandle;
