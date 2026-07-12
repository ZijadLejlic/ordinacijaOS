"use client";

import { useEffect } from "react";
import { identifyClinicUser } from "@/lib/analytics/posthog";
import { setClinicErrorContext } from "@/lib/observability/sentry";

type Props = {
  userId: string;
  clinicId: string;
  role: string;
};

/** Sets PostHog + Sentry context with clinic_id/role only (D33). */
export function ClinicTelemetry({ userId, clinicId, role }: Props) {
  useEffect(() => {
    setClinicErrorContext({ clinicId, role });
    identifyClinicUser({ userId, clinicId, role });
  }, [userId, clinicId, role]);

  return null;
}
