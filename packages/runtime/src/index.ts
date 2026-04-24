export * from "./types.js";
export * from "./instrument/index.js";
export * from "./overlay/index.js";
export * from "./rules/index.js";

import { startInstrument } from "./instrument/index.js";
import { createOverlay } from "./overlay/index.js";
import { runtimeBareButton } from "./rules/runtime-bare-button.js";
import { runtimeHardcodedColor } from "./rules/runtime-hardcoded-color.js";
import type {
  Runtime,
  RuntimeOptions,
  RuntimeRule,
  RuntimeViolation,
} from "./types.js";

const DEFAULT_RUNTIME_RULES: RuntimeRule[] = [
  runtimeBareButton,
  runtimeHardcodedColor,
];

/**
 * Entry point. Called once at app startup by @adux/vite-plugin.
 */
export function init(options: RuntimeOptions = {}): Runtime {
  const {
    overlay: showOverlay = true,
    debug = false,
    openEditorEndpoint = "/__adux/open-editor",
    severities = ["error", "warn"],
    rules = DEFAULT_RUNTIME_RULES,
    ruleFilter,
  } = options;

  if (debug) {
    // eslint-disable-next-line no-console
    console.log("[adux] runtime init", {
      overlay: showOverlay,
      ruleCount: rules.length,
      severities,
    });
  }

  let current: RuntimeViolation[] = [];

  const overlay = showOverlay
    ? createOverlay({
        openEditorEndpoint,
        showPanel: true,
        showOutlines: true,
        severities,
      })
    : null;

  const instrument = startInstrument(
    rules,
    (next) => {
      current = ruleFilter ? next.filter((v) => ruleFilter(v.ruleId)) : next;
      overlay?.setViolations(current);
    },
    { debug, auditDebounceMs: 100 },
  );

  return {
    stop() {
      instrument.stop();
      overlay?.destroy();
    },
    audit() {
      instrument.auditNow();
    },
    get violations() {
      return current;
    },
  };
}
