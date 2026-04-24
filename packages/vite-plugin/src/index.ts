import type { Plugin, ViteDevServer } from "vite";
import type { RuntimeOptions } from "@adux/runtime";

export interface AduxPluginOptions {
  /** Disable the plugin entirely. Useful for production guards. */
  disabled?: boolean;
  /** Runtime options passed to init(). */
  runtime?: RuntimeOptions;
  /** Override the editor open endpoint path. Default: "/__adux/open-editor". */
  editorEndpoint?: string;
}

// The injected script uses a virtual id that Vite routes to our load hook.
// Browser-visible path must encode `\0` as `__x00__` per Vite conventions;
// internal resolved id keeps the raw `\0` prefix so Vite doesn't re-process it.
const VIRTUAL_REQUEST_PATH = "/@id/__x00__adux-runtime";
const RESOLVED_ID = "\0adux-runtime";

// Retained for test compatibility.
const LEGACY_VIRTUAL_ID = "/@id/adux-runtime";
const LEGACY_RESOLVED_ID = "\0adux-runtime";

function safeRuntimeOpts(options: RuntimeOptions | undefined): string {
  const { ruleFilter: _, ...serializable } = options ?? {};
  return JSON.stringify(serializable);
}

export default function adux(options: AduxPluginOptions = {}): Plugin {
  if (options.disabled) {
    return { name: "adux" };
  }

  const editorEndpoint = options.editorEndpoint ?? "/__adux/open-editor";
  const runtimeJson = safeRuntimeOpts(options.runtime);

  // Captured in configResolved so transformIndexHtml can prefix the virtual
  // module URL with the user's `base` config (e.g. "/ai-task-console/").
  // Without this, projects with a non-"/" base see the injected
  // `<script src="/@id/__x00__adux-runtime">` 404 because the absolute path
  // bypasses the base prefix.
  let resolvedBase = "/";

  return {
    name: "adux",
    apply: "serve",
    enforce: "pre",

    // Ensure @adux/runtime is pre-bundled by Vite so the virtual module's
    // re-export `from "@adux/runtime"` can resolve when the host app does not
    // list @adux/runtime as a direct dependency.
    config() {
      return {
        optimizeDeps: {
          include: ["@adux/runtime"],
        },
      };
    },

    configResolved(config) {
      resolvedBase = config.base ?? "/";
    },

    transformIndexHtml(html) {
      const baseNoTrail = resolvedBase.replace(/\/$/, "");
      const requestPath = `${baseNoTrail}${VIRTUAL_REQUEST_PATH}`;
      return html.replace(
        "</head>",
        `<script type="module">
import { init } from "${requestPath}";
init(${runtimeJson});
</script>
</head>`,
      );
    },

    resolveId(id) {
      if (id === LEGACY_VIRTUAL_ID || id === RESOLVED_ID) return RESOLVED_ID;
      return undefined;
    },

    load(id) {
      if (id === RESOLVED_ID || id === LEGACY_RESOLVED_ID) {
        return 'export { init } from "@adux/runtime";';
      }
      return undefined;
    },

    async configureServer(server: ViteDevServer) {
      server.middlewares.use(editorEndpoint, (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        let body = "";
        req.on("data", (chunk: string) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const { file, line, column } = JSON.parse(body) as {
              file: string;
              line: number;
              column?: number;
            };
            const launchEditor = (await import("launch-editor")).default as (
              spec: string,
            ) => void;
            const columnSuffix = column != null ? `:${column}` : ":1";
            launchEditor(`${file}:${line}${columnSuffix}`);
            res.statusCode = 200;
            res.end("ok");
          } catch (err) {
            res.statusCode = 400;
            res.end(String(err));
          }
        });
      });
    },
  };
}
