"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { totpCodeSchema } from "@/lib/validations/auth";
import { logoutAction } from "@/lib/auth/actions";

export function MfaEnrollForm() {
  const t = useTranslations("Mfa");
  const router = useRouter();
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = (factors?.all ?? []).filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      );
      for (const factor of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "OrdinacijaOS",
      });

      if (cancelled) return;

      if (enrollError || !data) {
        setError(enrollError?.message ?? t("enrollFailed"));
        setLoading(false);
        return;
      }

      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(t("invalidCode"));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: parsed.data,
      });

      if (verify.error) {
        setError(verify.error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    });
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">{t("loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        {qr ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt={t("qrAlt")}
              className="bg-background size-48 rounded-md border p-2"
            />
            <FieldDescription className="text-center">
              {t("secretHint")}:{" "}
              <code className="text-foreground break-all text-xs">{secret}</code>
            </FieldDescription>
          </div>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" className="w-full" disabled={pending || !factorId}>
          {pending ? t("submitting") : t("enrollSubmit")}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}

export function MfaVerifyForm() {
  const t = useTranslations("Mfa");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = totpCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(t("invalidCode"));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) {
        setError(factors.error.message);
        return;
      }

      const totpFactor = factors.data.totp.find((f) => f.status === "verified");
      if (!totpFactor) {
        setError(t("noFactor"));
        return;
      }

      const challenge = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: parsed.data,
      });

      if (verify.error) {
        setError(verify.error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("submitting") : t("verifySubmit")}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="ghost" className="w-full">
          {t("logout")}
        </Button>
      </form>
    </div>
  );
}
