import {
  canAttemptPatientImageDecode,
  isHeicLikeFile,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/patients/image-type";

/** Match server `convertImageToWebp` max width. */
const MAX_WIDTH = 2400;
const JPEG_QUALITY = 0.85;

/**
 * Decode in the browser (Safari HEIC, Chrome Android gallery JPEGs) and
 * re-encode JPEG so the Server Action gets a small, typed body.
 */
export async function preparePatientImageForUpload(file: File): Promise<File> {
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("imageTooLarge");
  }
  if (!canAttemptPatientImageDecode(file)) {
    throw new Error("imageMustBeImage");
  }

  try {
    return await rasterizeToJpeg(file);
  } catch (err) {
    if (err instanceof Error && err.message === "imageTooLarge") throw err;
    // TIFF/BMP: canvas often cannot decode; sharp on the server can.
    if (!isHeicLikeFile(file)) {
      const mime = file.type.toLowerCase();
      if (
        mime.includes("tiff") ||
        mime.includes("bmp") ||
        /\.(tiff?|bmp)$/i.test(file.name)
      ) {
        return file;
      }
    }
    throw new Error("imageMustBeImage");
  }
}

async function rasterizeToJpeg(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  try {
    const scale = bitmap.width > MAX_WIDTH ? MAX_WIDTH / bitmap.width : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("imageMustBeImage");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob || blob.size === 0) throw new Error("imageMustBeImage");
    if (blob.size > MAX_IMAGE_SIZE_BYTES) throw new Error("imageTooLarge");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
