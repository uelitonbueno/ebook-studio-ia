export const LIBRARY_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_LIBRARY_IMAGE_BYTES = 12 * 1024 * 1024;

export type LibraryImageMimeType = (typeof LIBRARY_IMAGE_MIME_TYPES)[number];

export function decodeLibraryImageDataUrl(dataUrl: string, mimeType: LibraryImageMimeType): Buffer {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) throw new Error("O arquivo de imagem enviado é inválido.");
  const buffer = Buffer.from(dataUrl.slice(prefix.length), "base64");
  if (!buffer.length || buffer.length > MAX_LIBRARY_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 12 MB.");
  return buffer;
}

export function imageExtension(mimeType: LibraryImageMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
}
