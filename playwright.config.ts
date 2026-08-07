import { defineConfig, devices } from "@playwright/test";

// NOTA: a porta 3000 está ocupada por um container Docker de outro worktree
// (fundacao-tecnica-app-1) servindo código desatualizado sem a rota
// /reservar-mesa. Para evitar colisão, o servidor de dev do Playwright roda
// na porta 3001.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    env: { PORT: "3001" },
  },
});
