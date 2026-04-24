export * from "./types.js";

import type {
  InstrumentHandle,
  InstrumentOptions,
  RuntimeRule,
  StartInstrument,
} from "./types.js";
import type { RuntimeViolation } from "../types.js";
import type { RuntimeRuleContext } from "./types.js";

// Bippy imports — these resolve at build time. At runtime, if React isn't on
// the page (no __REACT_DEVTOOLS_GLOBAL_HOOK__), Bippy's instrument() will
// throw and we fall back to the safe no-op path.
import {
  instrument,
  traverseRenderedFibers,
  getNearestHostFibers,
  getDisplayName,
} from "bippy";
import { hasDebugSource } from "bippy/source";

export const startInstrument: StartInstrument = (
  rules: RuntimeRule[],
  onViolations: (violations: RuntimeViolation[]) => void,
  options: InstrumentOptions = {},
): InstrumentHandle => {
  const { debug = false, auditDebounceMs = 100 } = options;

  let stopped = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let idleHandle: number | null = null;
  let lastRoot: unknown = null;

  // ── helpers ──────────────────────────────────────────────────────

  function clearDebounce(): void {
    if (idleHandle != null) {
      if (typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      idleHandle = null;
    }
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  function audit(root: unknown): void {
    if (stopped || rules.length === 0) return;

    const violations: RuntimeViolation[] = [];
    let cancelled = false;

    try {
      traverseRenderedFibers(root as Parameters<typeof traverseRenderedFibers>[0], (fiber) => {
        if (stopped) {
          cancelled = true;
          return;
        }

        try {
          const hostFibers = getNearestHostFibers(fiber as Parameters<typeof getNearestHostFibers>[0]);
          const elements: Element[] = [];
          for (let i = 0; i < hostFibers.length; i++) {
            const node = (hostFibers[i] as Record<string, unknown>).stateNode;
            // Cross-env check: supports both browser (Element) and Node (plain object)
            if (
              node != null &&
              typeof node === "object" &&
              ((node as Record<string, unknown>).nodeType as number) === 1
            ) {
              elements.push(node as unknown as Element);
            }
          }

          const displayName = getDisplayName(
            (fiber as Record<string, unknown>).type,
          ) ?? undefined;

          let source: RuntimeRuleContext["source"];
          if (hasDebugSource(fiber as Parameters<typeof hasDebugSource>[0])) {
            const ds = (
              fiber as unknown as { _debugSource: { fileName: string; lineNumber: number; columnNumber?: number } }
            )._debugSource;
            source = {
              fileName: ds.fileName,
              lineNumber: ds.lineNumber,
              columnNumber: ds.columnNumber,
            };
          }

          const props =
            ((fiber as Record<string, unknown>).memoizedProps as Record<string, unknown> | undefined) ??
            undefined;

          const ctx: RuntimeRuleContext = {
            fiber,
            elements,
            displayName,
            props,
            source,
          };

          for (const rule of rules) {
            if (stopped) {
              cancelled = true;
              return;
            }
            try {
              const result = rule.check(ctx);
              if (result && result.length > 0) {
                // Ensure element can be null per contract (unmount case)
                for (const v of result) {
                  violations.push({
                    ...v,
                    element: v.element ?? null,
                  });
                }
              }
            } catch (err) {
              if (debug) {
                // eslint-disable-next-line no-console
                console.warn(`[adux] rule "${rule.id}" threw:`, err);
              }
            }
          }
        } catch (_err) {
          // individual fiber errors are non-fatal
        }
      });
    } catch (err) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[adux] traverseRenderedFibers threw:", err);
      }
      return;
    }

    if (!cancelled && !stopped && violations.length > 0) {
      try {
        onViolations(violations);
      } catch (err) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.warn("[adux] onViolations threw:", err);
        }
      }
    }
  }

  function scheduleAudit(root: unknown): void {
    if (stopped) return;
    clearDebounce();
    lastRoot = root;

    if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(
        () => {
          idleHandle = null;
          audit(root);
        },
        { timeout: auditDebounceMs + 50 },
      );
    } else {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        audit(root);
      }, auditDebounceMs);
    }
  }

  // ── wire Bippy ───────────────────────────────────────────────────

  try {
    instrument({
      name: "adux",
      onCommitFiberRoot(_rendererID, root) {
        if (stopped) return;
        scheduleAudit(root);
      },
    });
  } catch (err) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.warn("[adux] Bippy instrument() failed (React not available?):", err);
    }
    // Safe mode: return no-op handle, don't throw
  }

  // ── public handle ────────────────────────────────────────────────

  return {
    auditNow(): void {
      if (stopped) return;
      clearDebounce();
      if (lastRoot != null) {
        audit(lastRoot);
      }
    },
    stop(): void {
      stopped = true;
      clearDebounce();
      lastRoot = null;
    },
  };
};
