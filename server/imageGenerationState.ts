export type PageImageStatus = "draft" | "generating" | "ready" | "reviewed";
export const IMAGE_GENERATION_COOLDOWN_MS = 15 * 60 * 1000;

export function isImageGenerationUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("usage exhausted") || message.includes("failed_precondition");
}

export function restorePageStatusAfterImageFailure(previousStatus: PageImageStatus) {
  return previousStatus === "reviewed" ? "reviewed" : "draft";
}

export function getImageGenerationRetryAfter(now = Date.now()) {
  return new Date(now + IMAGE_GENERATION_COOLDOWN_MS);
}

export function isImageGenerationBlocked(retryAfter: Date | null | undefined, now = Date.now()) {
  return Boolean(retryAfter && retryAfter.getTime() > now);
}
