"use client";

import { useLayoutEffect } from "react";

/** Root layout stays static (`lang` defaults to BS). Sync the real locale. */
export function HtmlLang({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
