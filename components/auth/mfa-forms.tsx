"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
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
import { PRODUCT_NAME } from "@/lib/brand/constants";
import { safeMfaNextPath } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/client";
import { totpCodeSchema } from "@/lib/validations/auth";
import { logoutAction } from "@/lib/auth/actions";

const STORE_LINKS = {
  google: {
    android:
      "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
    ios: "https://apps.apple.com/app/google-authenticator/id388497605",
  },
  microsoft: {
    android:
      "https://play.google.com/store/apps/details?id=com.azure.authenticator",
    ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
  },
} as const;

function StoreLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function MfaEnrollGuide() {
  const t = useTranslations("Mfa");

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h2 className="text-foreground text-sm font-medium">{t("whyTitle")}</h2>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 leading-relaxed">
          <li>{t("whyProtect")}</li>
          <li>{t("whyCode")}</li>
          <li>{t("whyOwnerOnly")}</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-foreground text-sm font-medium">
          {t("stepsTitle")}
        </h2>
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4 leading-relaxed">
          <li>{t("stepInstall")}</li>
          <li>{t("stepScan")}</li>
          <li>{t("stepEnter")}</li>
        </ol>
      </section>

      <section className="bg-muted/50 space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <h2 className="text-foreground text-sm font-medium">
            {t("appsTitle")}
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("appsHint")}
          </p>
        </div>
        <ul className="space-y-2.5">
          <li>
            <p className="text-foreground font-medium">{t("googleAuth")}</p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <StoreLink href={STORE_LINKS.google.android}>
                {t("android")}
              </StoreLink>
              <StoreLink href={STORE_LINKS.google.ios}>{t("iphone")}</StoreLink>
            </p>
          </li>
          <li>
            <p className="text-foreground font-medium">
              {t("microsoftAuth")}{" "}
              <span className="text-muted-foreground font-normal">
                ({t("microsoftOptional")})
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <StoreLink href={STORE_LINKS.microsoft.android}>
                {t("android")}
              </StoreLink>
              <StoreLink href={STORE_LINKS.microsoft.ios}>
                {t("iphone")}
              </StoreLink>
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}

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
        friendlyName: PRODUCT_NAME,
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
    return (
      <div className="space-y-6">
        <MfaEnrollGuide />
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MfaEnrollGuide />

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-foreground text-sm font-medium">
            {t("scanSectionTitle")}
          </h2>
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
                <code className="text-foreground break-all text-xs">
                  {secret}
                </code>
              </FieldDescription>
            </div>
          ) : null}
        </div>

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
  const searchParams = useSearchParams();
  const nextPath = safeMfaNextPath(searchParams.get("next")) ?? "/dashboard";
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

      // Allowlisted in safeMfaNextPath (typed next-intl pathnames).
      router.replace(nextPath as "/reset-password");
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
