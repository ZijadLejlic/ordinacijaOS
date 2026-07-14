import { PRODUCT_NAME } from "@/lib/brand/constants";

/** Path for dynamic OG image (1200×630) — Website-DentOrd §6.1. */
export function marketingOgImagePath(title: string) {
  const params = new URLSearchParams({ title });
  return `/api/og?${params.toString()}`;
}

export function defaultOgTitle(pageTitle?: string) {
  return pageTitle?.trim() || PRODUCT_NAME;
}
