import type { MetadataRoute } from "next";
import { BRAND_COLORS, PRODUCT_NAME } from "@/lib/brand/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: "Cloud softver za stomatološke ordinacije",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.navy,
    theme_color: BRAND_COLORS.blue,
    lang: "bs",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
