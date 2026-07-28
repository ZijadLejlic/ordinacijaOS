import sharp from "sharp";

/** Private bucket — signed URLs only (D21). Path: clinic_id/patient_id/... */
export const PATIENT_FILES_BUCKET = "patient-files";
export const SIGNED_URL_TTL_SECONDS = 120;

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
/** Same ceiling as documents — raw upload before WebP convert. */
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const WEBP_QUALITY = 82;
const WEBP_MAX_WIDTH = 2400;

export function documentPath(
  clinicId: string,
  patientId: string,
  fileId: string,
) {
  return `${clinicId}/${patientId}/documents/${fileId}.pdf`;
}

export function imagePath(clinicId: string, patientId: string, fileId: string) {
  return `${clinicId}/${patientId}/images/${fileId}.webp`;
}

/** Signed consent PDF (D20). */
export function consentPdfPath(
  clinicId: string,
  patientId: string,
  fileId: string,
) {
  return `${clinicId}/${patientId}/consents/${fileId}.pdf`;
}

/** Draw-signature PNG paired with consent PDF (D20). */
export function consentSignaturePath(
  clinicId: string,
  patientId: string,
  fileId: string,
) {
  return `${clinicId}/${patientId}/consents/${fileId}.sig.png`;
}

/** Compress and re-encode any raster image to WebP (D21 — quality-preserving). */
export async function convertImageToWebp(buffer: Buffer): Promise<Buffer> {
  // Flatten alpha → lossy VP8 (not VP8X) for broader Safari/iOS inline display.
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: WEBP_MAX_WIDTH, withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  if (
    out.byteLength < 12 ||
    out.subarray(0, 4).toString("ascii") !== "RIFF" ||
    out.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    throw new Error("webp_magic_invalid");
  }
  return out;
}

/**
 * Supabase Storage upload body. Passing a Node `Buffer` through `fetch` in
 * Server Actions has UTF-8-mangled patient WebPs on prod (U+FFFD / ef bf bd).
 * `Blob` uses multipart FormData and keeps bytes intact.
 */
export function asUploadBlob(bytes: Buffer, contentType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: contentType });
}
