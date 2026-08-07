import { defineConfig, devices } from "@playwright/test";

// NOTA: a porta 3000 é usada pelo container "app" do docker-compose.yml deste
// projeto (dev diário). Para evitar colisão, o servidor de dev do Playwright
// roda na porta 3001. NEXTAUTH_URL precisa ser sobrescrita para a mesma
// porta: o Auth.js usa o valor de NEXTAUTH_URL (não o Host da requisição)
// para montar a URL de redirecionamento de sessões não autenticadas — sem
// essa sobrescrita, o middleware redirecionaria para a porta 3000 (valor de
// NEXTAUTH_URL em .env/.env.example) mesmo com o app rodando na 3001.
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
    env: { PORT: "3001", NEXTAUTH_URL: "http://localhost:3001" },
  },
});
