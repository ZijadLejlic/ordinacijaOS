import sharp from "sharp";

/** Private bucket — signed URLs only (D21). Path: clinic_id/patient_id/... */
export const PATIENT_FILES_BUCKET = "patient-files";
export const SIGNED_URL_TTL_SECONDS = 120;

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
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
  return sharp(buffer)
    .rotate()
    .resize({ width: WEBP_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
