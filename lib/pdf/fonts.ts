import path from "node:path";
import { Font } from "@react-pdf/renderer";

/** Embedded family — Latin Extended (č ć š ž đ) for BS/HR/SR. */
export const PDF_FONT_FAMILY = "DentOrdSans";

let registered = false;

/**
 * Register PDF fonts once per process. Standard Helvetica lacks
 * Central European glyphs used in Bosnian/Croatian/Serbian Latin.
 */
export function ensurePdfFonts() {
  if (registered) return;

  const dir = path.join(process.cwd(), "assets/fonts");
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      {
        src: path.join(dir, "Roboto-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: path.join(dir, "Roboto-Bold.ttf"),
        fontWeight: 700,
      },
    ],
  });

  // Avoid hyphenation splitting diacritic-heavy words incorrectly.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}
