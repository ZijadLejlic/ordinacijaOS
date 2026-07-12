"use client";

import { useEffect } from "react";
import { initPosthog } from "@/lib/analytics/posthog";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);

  return children;
}
