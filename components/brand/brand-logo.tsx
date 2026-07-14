import Image from "next/image";
import { BRAND_LOGO, PRODUCT_NAME } from "@/lib/brand/constants";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "full" | "mark";
  className?: string;
  priority?: boolean;
  /** Override accessible name — pass "" when adjacent visible text already labels the logo. */
  alt?: string;
};

export function BrandLogo({
  variant = "full",
  className,
  priority = false,
  alt = PRODUCT_NAME,
}: BrandLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src={BRAND_LOGO.mark}
        alt={alt}
        width={40}
        height={40}
        className={cn("h-8 w-8 object-contain", className)}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={BRAND_LOGO.full}
      alt={alt}
      width={480}
      height={324}
      className={cn("h-auto w-full object-contain", className)}
      priority={priority}
    />
  );
}
