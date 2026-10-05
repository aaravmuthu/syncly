import { fileURLToPath } from "node:url";
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Live policy checks require psql and an explicitly configured database.
    // Unit tests must run independently of those external prerequisites.
    exclude: [
      ...configDefaults.exclude,
      ...(process.env.RUN_RLS_TESTS === "1" ? [] : ["src/tests/rls-policies.test.ts"]),
    ],
  },
});
