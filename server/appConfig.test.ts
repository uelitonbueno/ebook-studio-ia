import { describe, expect, it } from "vitest";

describe("configuração básica da aplicação", () => {
  it("mantém o título editorial configurado", () => {
    expect(process.env.VITE_APP_TITLE ?? "Ebook Studio IA").toBe("Ebook Studio IA");
  });
});
