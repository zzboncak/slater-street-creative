import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // src/lib/prisma.ts throws at import if DATABASE_URL is unset (SSC-8), and
    // auth.ts imports it transitively. JWT_SECRET is resolved at auth.ts load.
    // These are dummy values: the unit tests are pure and never open a DB
    // connection or depend on a real secret.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret-for-vitest",
    },
  },
});
