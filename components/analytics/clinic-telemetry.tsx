"use client";

import { useEffect } from "react";
import { identifyClinicUser } from "@/lib/analytics/posthog";
import {
  clearSentryAuthContext,
  setSentryAuthContext,
} from "@/lib/observability/sentry";

type Props = {
  userId: string;
  clinicId: string;
  role: string;
  isDemo?: boolean;
};

/** Sets PostHog + Sentry context — user.id + clinic_id/role tags only (D33). */
export function ClinicTelemetry({
  userId,
  clinicId,
  role,
  isDemo = false,
}: Props) {
  useEffect(() => {
    setSentryAuthContext({ userId, clinicId, role });
    identifyClinicUser({
      userId,
      clinicId,
      role,
      skipIdentify: isDemo,
    });
    return () => {
      clearSentryAuthContext();
    };
  }, [userId, clinicId, role, isDemo]);

  return null;
}
