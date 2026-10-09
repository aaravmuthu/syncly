// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import { localSupabaseEnv } from "./src/lib/supabase-dev-env";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "syncly-local-supabase-env",
        apply: "serve",
        configResolved(config) {
          // Vite exposes VITE_* to the browser, but generated server auth
          // reads runtime env. Bridge public local config without editing it.
          const env = loadEnv(config.mode, config.envDir, "");
          const values = localSupabaseEnv(env, process.env);
          // Private local bindings stay in process.env; never alias to VITE_*.
          for (const key of ["SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
            if (!process.env[key] && env[key]) process.env[key] = env[key];
          }
          for (const [key, value] of Object.entries(values)) {
            if (value) process.env[key] = value;
          }
        },
      },
      mcpPlugin(),
    ],
  },
});
