/** Raw upload ceiling before client rasterize / server WebP convert. */
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * `image/*` is required for Android camera/gallery. HEIC listed so iOS
 * Photos is not filtered out of the picker.
 */
export const PATIENT_IMAGE_ACCEPT =
  "image/*,image/heic,image/heif,image/jpeg,image/png,image/webp";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/tiff",
  "image/tif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/x-jpeg",
  "image/jfif",
]);

const ALLOWED_EXT = /\.(jpe?g|png|webp|hei[cf]|gif|tiff?|bmp)$/i;

function mimeOf(file: { type: string }): string {
  return file.type.trim().toLowerCase();
}

function isSvgMime(mime: string): boolean {
  return mime === "image/svg+xml" || mime === "image/svg";
}

/**
 * Server gate. Android file managers often send `application/octet-stream`
 * or empty MIME with a `.jpg` name — still allowed. SVG / PDF / exe are not.
 */
export function isAllowedPatientImageFile(file: {
  type: string;
  name?: string;
}): boolean {
  const mime = mimeOf(file);
  if (isSvgMime(mime)) return false;
  if (mime && ALLOWED_MIME.has(mime)) return true;
  if (mime.startsWith("image/") && mime !== "image/*") return true;
  const unlabeled = !mime || mime === "application/octet-stream";
  if (unlabeled && file.name && ALLOWED_EXT.test(file.name)) return true;
  return false;
}

/**
 * Client gate: try to decode. Android gallery frequently omits MIME and
 * extension (`image`, `blob`). Canvas success/fail is the real format check.
 */
export function canAttemptPatientImageDecode(file: {
  type: string;
  name?: string;
}): boolean {
  if (isAllowedPatientImageFile(file)) return true;
  const mime = mimeOf(file);
  if (isSvgMime(mime)) return false;
  if (
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime.includes("officedocument")
  ) {
    return false;
  }
  if (!mime || mime === "application/octet-stream" || mime === "image/*") {
    return true;
  }
  return false;
}

export function isHeicLikeFile(file: { type: string; name?: string }): boolean {
  const mime = mimeOf(file);
  if (mime.includes("heic") || mime.includes("heif")) return true;
  return Boolean(file.name && /\.hei[cf]$/i.test(file.name));
}
