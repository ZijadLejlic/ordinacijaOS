import sharp from "sharp";

/** Private bucket — signed URLs only (D21). Path: clinic_id/logo.webp */
export const CLINIC_BRANDING_BUCKET = "clinic-branding";
/** Longer TTL than patient files — shell stays mounted across navigations. */
export const BRANDING_SIGNED_URL_TTL_SECONDS = 3600;

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const WEBP_QUALITY = 85;
const LOGO_MAX_EDGE = 512;

export function logoPath(clinicId: string) {
  return `${clinicId}/logo.webp`;
}

/** Compress and re-encode logo raster to WebP square-ish max edge. */
export async function convertLogoToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: LOGO_MAX_EDGE,
      height: LOGO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}
