import { fetchWithSession } from "@/api/client";

/**
 * Use the Vite /media proxy for Django media during local development.
 * This avoids a cross-origin response when the API provides an absolute
 * http://localhost:8000/media/... or http://127.0.0.1:8000/media/... URL.
 * Other URLs remain unchanged (including production URLs).
 */
export function resolveProgressImageDownloadUrl(source: string): string {
  const url = new URL(source, window.location.href);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Unsupported progress image URL.");
  }

  const localHosts = ["localhost", "127.0.0.1"];
  const localFrontend = localHosts.includes(window.location.hostname) &&
    ["5000", "5173", "3000"].includes(window.location.port);
  const localDjangoMedia = localHosts.includes(url.hostname) &&
    url.port === "8000" &&
    url.pathname.startsWith("/media/");

  if (localFrontend && localDjangoMedia) {
    return `${window.location.origin}${url.pathname}${url.search}`;
  }

  return url.href;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/tiff": "tif",
};

/** Download a progress photo using the existing authenticated HTTP client. */
export async function downloadProgressImage(
  source: string,
  imageDate: string,
  imageId: number,
): Promise<void> {
  if (!source) throw new Error("This photo has no image URL.");

  const downloadUrl = resolveProgressImageDownloadUrl(source);
  const response = await fetchWithSession(downloadUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Image request failed (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const mime = blob.type.split(";")[0].toLowerCase();
  if (!blob.size) throw new Error("The image file is empty.");
  if (mime === "text/html" || mime === "application/json" || mime === "text/plain") {
    throw new Error("The server returned a page instead of an image. Check the media URL and proxy.");
  }

  const urlPath = new URL(downloadUrl).pathname;
  const originalExtension = urlPath.match(/\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i)?.[1]?.toLowerCase();
  const extension = MIME_EXTENSIONS[mime] ?? originalExtension?.replace(/^jpeg$/, "jpg") ?? "img";
  const dateLabel = String(imageDate || imageId).replace(/[^0-9a-z_-]/gi, "-") || String(imageId);
  const name = `progress-${dateLabel}.${extension}`;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    // Wait for the browser to begin saving before releasing the Blob URL.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}
