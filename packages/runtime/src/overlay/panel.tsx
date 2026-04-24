import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { RuntimeViolation } from "../types.js";

export interface PanelController {
  setViolations(violations: RuntimeViolation[]): void;
  destroy(): void;
}

export type OpenEditor = (
  file: string,
  line: number,
  column?: number,
) => void;

interface InternalState {
  setViolations: (v: RuntimeViolation[]) => void;
}

function Panel({
  externalStateRef,
  onOpenEditor,
}: {
  externalStateRef: { current: InternalState | null };
  onOpenEditor: OpenEditor;
}) {
  const [violations, setViolations] = useState<RuntimeViolation[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    externalStateRef.current = { setViolations };
    return () => {
      externalStateRef.current = null;
    };
  }, [externalStateRef]);

  if (violations.length === 0) return null;

  const errors = violations.filter((v) => v.severity === "error").length;
  const warns = violations.length - errors;

  return (
    <div style={S.panel}>
      <div style={S.header} onClick={() => setCollapsed((c) => !c)}>
        <strong style={S.brand}>ADUX</strong>
        <span style={S.countError}>{errors}</span>
        <span style={S.dot}>·</span>
        <span style={S.countWarn}>{warns}</span>
        <span style={S.caret}>{collapsed ? "▲" : "▼"}</span>
      </div>
      {!collapsed && (
        <div style={S.list}>
          {violations.map((v, i) => (
            <div
              key={`${v.ruleId}-${i}`}
              style={S.item}
              onClick={() => handleClick(v, onOpenEditor)}
            >
              <div style={S.itemMeta(v.severity)}>
                {v.severity.toUpperCase()} · {v.ruleId}
              </div>
              <div style={S.itemMessage}>{v.message}</div>
              {v.source && (
                <div style={S.itemSource}>
                  {shortPath(v.source.fileName)}:{v.source.lineNumber}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function handleClick(v: RuntimeViolation, onOpenEditor: OpenEditor): void {
  if (v.element) {
    try {
      v.element.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      /* ignore — element may be detached */
    }
  }
  if (v.source) {
    onOpenEditor(
      v.source.fileName,
      v.source.lineNumber,
      v.source.columnNumber,
    );
  }
}

function shortPath(p: string): string {
  return p.split("/").slice(-2).join("/");
}

export function createPanelController(
  mount: HTMLElement,
  onOpenEditor: OpenEditor,
): PanelController {
  const ref: { current: InternalState | null } = { current: null };
  render(<Panel externalStateRef={ref} onOpenEditor={onOpenEditor} />, mount);

  return {
    setViolations(v) {
      ref.current?.setViolations(v);
    },
    destroy() {
      render(null as unknown as preact.ComponentChild, mount);
    },
  };
}

// ── styles (all inline to keep Shadow DOM self-contained) ───────────
const S = {
  panel: {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    width: "320px",
    maxHeight: "50vh",
    background: "#1f1f1f",
    color: "#fafafa",
    border: "1px solid #434343",
    borderRadius: "8px",
    boxShadow: "0 12px 24px rgba(0,0,0,0.2)",
    pointerEvents: "auto",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  } as const,
  header: {
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    userSelect: "none",
    borderBottom: "1px solid #434343",
  } as const,
  brand: { marginRight: "8px" } as const,
  countError: { color: "#f5222d", fontWeight: 600 } as const,
  countWarn: { color: "#faad14", fontWeight: 600 } as const,
  dot: { margin: "0 6px", color: "#666" } as const,
  caret: { marginLeft: "auto", opacity: 0.6, fontSize: "10px" } as const,
  list: { overflowY: "auto", flex: 1 } as const,
  item: {
    padding: "8px 12px",
    borderBottom: "1px solid #2a2a2a",
    cursor: "pointer",
  } as const,
  itemMeta: (severity: "error" | "warn") =>
    ({
      color: severity === "error" ? "#f5222d" : "#faad14",
      fontSize: "10px",
      fontWeight: 600,
    }) as const,
  itemMessage: { fontSize: "12px", marginTop: "2px" } as const,
  itemSource: {
    fontSize: "10px",
    color: "#888",
    marginTop: "2px",
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  } as const,
};
