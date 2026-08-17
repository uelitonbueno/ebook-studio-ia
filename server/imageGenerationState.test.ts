import { describe, expect, it } from "vitest";
import { IMAGE_GENERATION_COOLDOWN_MS, getImageGenerationRetryAfter, isImageGenerationBlocked, isImageGenerationUnavailable, restorePageStatusAfterImageFailure } from "./imageGenerationState";

describe("regras de recuperação da geração de imagens", () => {
  it("identifica a indisponibilidade temporária informada pelo serviço de imagens", () => {
    expect(isImageGenerationUnavailable(new Error("Image generation request failed: usage exhausted"))).toBe(true);
    expect(isImageGenerationUnavailable("failed_precondition")).toBe(true);
    expect(isImageGenerationUnavailable(new Error("timeout de rede"))).toBe(false);
  });

  it("restaura o estado revisado quando a regeneração falha", () => {
    expect(restorePageStatusAfterImageFailure("reviewed")).toBe("reviewed");
    expect(restorePageStatusAfterImageFailure("draft")).toBe("draft");
    expect(restorePageStatusAfterImageFailure("ready")).toBe("draft");
  });

  it("mantém o bloqueio de tentativas ativo até o término do intervalo persistido", () => {
    const now = new Date("2026-08-17T19:45:00.000Z").getTime();
    const retryAfter = getImageGenerationRetryAfter(now);

    expect(retryAfter.getTime()).toBe(now + IMAGE_GENERATION_COOLDOWN_MS);
    expect(isImageGenerationBlocked(retryAfter, now)).toBe(true);
    expect(isImageGenerationBlocked(retryAfter, retryAfter.getTime())).toBe(false);
  });
});
