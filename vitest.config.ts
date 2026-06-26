import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests cover the pure kernel (lib/**) and the disposable shell (components/**,
// app/**). Node env is enough — no test renders a React component (the route
// handlers use web-standard Request/Response). The `@/` alias mirrors tsconfig.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
  },
});
