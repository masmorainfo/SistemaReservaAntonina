import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Os testes de integração compartilham o banco de dev; execução sequencial
    // evita colisões entre arquivos de teste que gravam nas mesmas tabelas.
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
