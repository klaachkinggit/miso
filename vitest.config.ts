import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig sets jsx:"preserve" for Next, which Vite's default transform
  // refuses to parse. plugin-react transforms the react-email .tsx templates
  // imported (transitively) by the email unit tests.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(
        __dirname,
        "tests/unit/__mocks__/server-only.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    globals: true,
  },
});
