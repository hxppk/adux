import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── hoisted state (vi.mock factories are hoisted above all code) ───

const {
  capturedOnCommit,
  mockStopped,
  mockInstrument,
  mockTraverse,
  mockGetNearestHostFibers,
  mockGetDisplayName,
  mockHasDebugSource,
  resetState,
} = vi.hoisted(() => {
  let captured: ((_rendererID: number, root: unknown) => void) | null = null;
  let stopped = false;

  const instrumentFn = vi.fn(
    (opts: { onCommitFiberRoot?: (_rendererID: number, root: unknown) => void }) => {
      captured = opts.onCommitFiberRoot ?? null;
    },
  );

  const traverseFn = vi.fn(
    (_root: unknown, cb: (fiber: unknown, _phase: string) => void) => {
      if (stopped) return;

      const hostFiber = {
        type: "div",
        stateNode: { tagName: "DIV", nodeType: 1 },
        memoizedProps: { className: "ant-btn" },
        child: null,
      };

      const compositeFiber = {
        type: function Button() {},
        memoizedProps: { loading: true },
        child: hostFiber,
      };

      cb(compositeFiber, "mount");
      cb(hostFiber, "mount");
    },
  );

  const getHostFibersFn = vi.fn((fiber: unknown) => {
    const f = fiber as Record<string, unknown>;
    if (f.type === "div") return [f];
    const child = f.child as Record<string, unknown> | null;
    if (child && child.type === "div") return [child];
    return [];
  });

  const getDisplayNameFn = vi.fn((type: unknown) => {
    if (typeof type === "function") return type.name || null;
    if (typeof type === "string") return type;
    return null;
  });

  const hasDebugSourceFn = vi.fn(
    (
      fiber: unknown,
    ): fiber is Record<string, unknown> & { _debugSource: Record<string, unknown> } => {
      const f = fiber as Record<string, unknown>;
      if (typeof f.type === "function") {
        if (!f._debugSource) {
          f._debugSource = { fileName: "/src/App.tsx", lineNumber: 42 };
        }
        return true;
      }
      return false;
    },
  );

  function reset() {
    captured = null;
    stopped = false;
    vi.clearAllMocks();
  }

  return {
    capturedOnCommit: {
      get: () => captured,
      set: (v: typeof captured) => {
        captured = v;
      },
    },
    mockStopped: {
      get: () => stopped,
      set: (v: boolean) => {
        stopped = v;
      },
    },
    mockInstrument: instrumentFn,
    mockTraverse: traverseFn,
    mockGetNearestHostFibers: getHostFibersFn,
    mockGetDisplayName: getDisplayNameFn,
    mockHasDebugSource: hasDebugSourceFn,
    resetState: reset,
  };
});

// ── mocks (hoisted) ────────────────────────────────────────────────

vi.mock("bippy", () => ({
  instrument: mockInstrument,
  traverseRenderedFibers: mockTraverse,
  getNearestHostFibers: mockGetNearestHostFibers,
  getDisplayName: mockGetDisplayName,
}));

vi.mock("bippy/source", () => ({
  hasDebugSource: mockHasDebugSource,
}));

// ── imports (after mocks) ──────────────────────────────────────────

import { startInstrument } from "../src/instrument/index.js";
import type { RuntimeRule, RuntimeRuleContext } from "../src/instrument/types.js";
import type { RuntimeViolation } from "../src/types.js";

// ── helpers ────────────────────────────────────────────────────────

function makeRule(
  id: string,
  check: (ctx: RuntimeRuleContext) => RuntimeViolation[] | void,
  severity: "error" | "warn" = "error",
): RuntimeRule {
  return { id, description: `Rule ${id}`, severity, check };
}

function simulateCommit(root?: unknown) {
  const captured = capturedOnCommit.get();
  captured?.(0, root ?? { current: {} });
}

/** Flush pending audit by advancing past the debounce window. */
function flushAudit(ms = 200) {
  vi.advanceTimersByTime(ms);
}

// ── tests ──────────────────────────────────────────────────────────

describe("startInstrument API shape", () => {
  afterEach(resetState);

  it("returns handle with stop and auditNow", () => {
    const handle = startInstrument([], () => {}, {});
    expect(handle).toBeDefined();
    expect(typeof handle.stop).toBe("function");
    expect(typeof handle.auditNow).toBe("function");
  });

  it("calls Bippy instrument() on start", () => {
    startInstrument([], () => {}, {});
    expect(mockInstrument).toHaveBeenCalled();
    expect(mockInstrument.mock.calls[0]?.[0]).toMatchObject({ name: "adux" });
  });

  it("captured onCommitFiberRoot is a function", () => {
    startInstrument([], () => {}, {});
    expect(capturedOnCommit.get()).toBeTypeOf("function");
  });
});

describe("rule evaluation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rule.check is called with RuntimeRuleContext", () => {
    const check = vi.fn(() => []);
    const rule = makeRule("test-rule", check);
    const onViolations = vi.fn();

    startInstrument([rule], onViolations, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();

    expect(check).toHaveBeenCalled();
    const ctx: RuntimeRuleContext = check.mock.calls[0]?.[0] as RuntimeRuleContext;
    expect(ctx).toBeDefined();
    expect(ctx.fiber).toBeDefined();
    expect(Array.isArray(ctx.elements)).toBe(true);
  });

  it("passes displayName when fiber has named function type", () => {
    const check = vi.fn(() => []);
    const rule = makeRule("test-rule", check);
    startInstrument([rule], () => {}, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();

    const names = check.mock.calls.map((c) => (c[0] as RuntimeRuleContext).displayName);
    expect(names.some((n) => n === "Button")).toBe(true);
  });

  it("passes source when hasDebugSource returns true", () => {
    const check = vi.fn(() => []);
    const rule = makeRule("test-rule", check);
    startInstrument([rule], () => {}, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();

    const sources = check.mock.calls.map((c) => (c[0] as RuntimeRuleContext).source);
    expect(sources.some((s) => s?.fileName === "/src/App.tsx" && s?.lineNumber === 42)).toBe(true);
  });
});

describe("onViolations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is called with violations produced by rules", () => {
    const violation: RuntimeViolation = {
      ruleId: "test-rule",
      message: "bad thing",
      severity: "error",
      element: null,
    };
    const rule = makeRule("test-rule", () => [violation]);
    const onViolations = vi.fn();

    startInstrument([rule], onViolations, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();

    expect(onViolations).toHaveBeenCalled();
    const result: RuntimeViolation[] = onViolations.mock.calls[0]?.[0] as RuntimeViolation[];
    expect(result.some((v) => v.ruleId === "test-rule")).toBe(true);
  });

  it("ensures element is null when omitted (unmount case)", () => {
    const rule = makeRule("test-rule", () => [
      {
        ruleId: "test-rule",
        message: "no element",
        severity: "error",
      } as RuntimeViolation,
    ]);
    const onViolations = vi.fn();

    startInstrument([rule], onViolations, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();

    const result: RuntimeViolation[] = onViolations.mock.calls[0]?.[0] as RuntimeViolation[];
    const v = result.find((r) => r.ruleId === "test-rule");
    expect(v?.element).toBeNull();
  });

  it("stops calling onViolations after stop()", () => {
    const rule = makeRule("test-rule", () => [
      { ruleId: "test-rule", message: "x", severity: "error", element: null },
    ]);
    const onViolations = vi.fn();
    const handle = startInstrument([rule], onViolations, { auditDebounceMs: 50 });

    // First commit — should trigger violations
    simulateCommit();
    flushAudit();
    expect(onViolations).toHaveBeenCalledTimes(1);

    // Stop then commit again
    handle.stop();
    mockStopped.set(true);
    simulateCommit();
    flushAudit();

    // Should still have been called exactly once
    expect(onViolations).toHaveBeenCalledTimes(1);
  });

  it("is not called when no violations produced", () => {
    const rule = makeRule("test-rule", () => undefined);
    const onViolations = vi.fn();
    startInstrument([rule], onViolations, { auditDebounceMs: 50 });
    simulateCommit();
    flushAudit();
    expect(onViolations).not.toHaveBeenCalled();
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetState();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces multiple commits within auditDebounceMs window", () => {
    const check = vi.fn(() => []);
    const rule = makeRule("test-rule", check);
    startInstrument([rule], () => {}, { auditDebounceMs: 100 });

    simulateCommit();
    simulateCommit();
    simulateCommit();

    // Before timers advance, no audit should have run
    expect(mockTraverse).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(mockTraverse).toHaveBeenCalledTimes(1);
  });

  it("auditNow triggers immediate audit and cancels pending debounce", () => {
    const check = vi.fn(() => []);
    const rule = makeRule("test-rule", check);
    const handle = startInstrument([rule], () => {}, { auditDebounceMs: 100 });

    simulateCommit();
    handle.auditNow();

    expect(mockTraverse).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(150);
    expect(mockTraverse).toHaveBeenCalledTimes(1);
  });
});

describe("safe no-op mode", () => {
  it("does not throw when Bippy instrument throws", () => {
    mockInstrument.mockImplementationOnce(() => {
      throw new Error("React not available");
    });

    expect(() => {
      const handle = startInstrument([], () => {}, {});
      expect(handle).toBeDefined();
      expect(typeof handle.stop).toBe("function");
      expect(typeof handle.auditNow).toBe("function");
      expect(() => handle.stop()).not.toThrow();
      expect(() => handle.auditNow()).not.toThrow();
    }).not.toThrow();
  });
});
