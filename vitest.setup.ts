import "@testing-library/jest-dom/vitest";

// A suíte nunca fala com gateway real: qualquer PAYMENT_PROVIDER vindo do .env
// (carregado por vitest.config.ts) é neutralizado aqui. getPaymentProvider.test.ts
// já captura/restaura o valor original por conta própria, então isso não conflita.
process.env.PAYMENT_PROVIDER = "mock";
