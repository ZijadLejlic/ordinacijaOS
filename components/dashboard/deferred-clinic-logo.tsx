import { BRAND_LOGO } from "@/lib/brand/constants";
import {
  BRANDING_SIGNED_URL_TTL_SECONDS,
  CLINIC_BRANDING_BUCKET,
} from "@/lib/branding/storage";
import { createClient } from "@/lib/supabase/server";

/** Signed clinic logo — intentionally off the blocking layout path. */
export async function DeferredClinicLogo({
  logoPath,
  alt,
}: {
  logoPath: string;
  alt: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(CLINIC_BRANDING_BUCKET)
    .createSignedUrl(logoPath, BRANDING_SIGNED_URL_TTL_SECONDS);

  if (!data?.signedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static public asset
      <img
        src={BRAND_LOGO.mark}
        alt=""
        className="h-8 w-8 shrink-0 object-contain"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket
    <img
      src={data.signedUrl}
      alt={alt}
      className="h-8 w-8 shrink-0 rounded object-contain"
    />
  );
}
