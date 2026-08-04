"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
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

type EnrollStep = "install" | "scan" | "confirm";
type StorePlatform = "android" | "ios" | "both";

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

function detectStorePlatform(): StorePlatform {
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "both";
}

function useStorePlatform(): StorePlatform {
  return useSyncExternalStore(
    () => () => {},
    detectStorePlatform,
    () => "both" as const,
  );
}

function StepDots({ step }: { step: EnrollStep }) {
  const index = step === "install" ? 0 : step === "scan" ? 1 : 2;
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={
            i === index
              ? "bg-foreground h-1.5 w-6 rounded-full"
              : "bg-muted-foreground/30 h-1.5 w-1.5 rounded-full"
          }
        />
      ))}
    </div>
  );
}

export function MfaEnrollForm() {
  const t = useTranslations("Mfa");
  const router = useRouter();
  const platform = useStorePlatform();
  const [step, setStep] = useState<EnrollStep>("install");
  const [showAltApp, setShowAltApp] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const submittingRef = useRef(false);

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

  function submitCode(raw: string) {
    if (submittingRef.current || pending || !factorId) return;

    const parsed = totpCodeSchema.safeParse(raw);
    if (!parsed.success) {
      setError(t("invalidCode"));
      return;
    }

    setError(null);
    submittingRef.current = true;

    startTransition(async () => {
      try {
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
          setError(t("codeWrong"));
          setCode("");
          return;
        }

        router.replace("/dashboard");
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
    if (digits.length === 6) {
      submitCode(digits);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function onConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitCode(code);
  }

  return (
    <div className="space-y-6">
      <StepDots step={step} />

      {step === "install" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-foreground text-sm font-medium">
              {t("stepInstallTitle")}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("stepInstallBody")}
            </p>
          </div>

          <div className="bg-muted/50 space-y-3 rounded-lg border p-3">
            <p className="text-foreground text-sm font-medium">
              {t("googleAuth")}
            </p>
            <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {(platform === "android" || platform === "both") && (
                <StoreLink href={STORE_LINKS.google.android}>
                  {t("android")}
                </StoreLink>
              )}
              {(platform === "ios" || platform === "both") && (
                <StoreLink href={STORE_LINKS.google.ios}>{t("iphone")}</StoreLink>
              )}
            </p>
            <button
              type="button"
              className="text-muted-foreground text-xs underline-offset-4 hover:underline"
              onClick={() => setShowAltApp((v) => !v)}
            >
              {t("otherApp")}
            </button>
            {showAltApp ? (
              <div className="space-y-1 border-t pt-2">
                <p className="text-foreground text-sm font-medium">
                  {t("microsoftAuth")}
                </p>
                <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <StoreLink href={STORE_LINKS.microsoft.android}>
                    {t("android")}
                  </StoreLink>
                  <StoreLink href={STORE_LINKS.microsoft.ios}>
                    {t("iphone")}
                  </StoreLink>
                </p>
              </div>
            ) : null}
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("whyOwnerOnly")}
          </p>

          <Button
            type="button"
            className="w-full"
            onClick={() => setStep("scan")}
          >
            {t("continue")}
          </Button>
        </div>
      ) : null}

      {step === "scan" ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-foreground text-sm font-medium">
              {t("stepScanTitle")}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("stepScanBody")}
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : error && !qr ? (
            <FieldError>{error}</FieldError>
          ) : qr ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt={t("qrAlt")}
                className="bg-background size-48 rounded-md border p-2"
              />
              <FieldDescription className="text-center">
                {t("secretHint")}
              </FieldDescription>
              <div className="flex max-w-full flex-col items-center gap-2">
                <code className="text-foreground break-all text-center text-xs">
                  {secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copySecret}
                >
                  {copied ? t("secretCopied") : t("copySecret")}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setStep("install")}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={loading || !factorId}
              onClick={() => {
                setError(null);
                setStep("confirm");
              }}
            >
              {t("continue")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <form onSubmit={onConfirmSubmit} className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-foreground text-sm font-medium">
              {t("stepConfirmTitle")}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("stepConfirmBody")}
            </p>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">{t("code")}</FieldLabel>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
              />
            </Field>
          </FieldGroup>

          {error ? <FieldError>{error}</FieldError> : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setError(null);
                setCode("");
                setStep("scan");
              }}
            >
              {t("back")}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={pending || !factorId || code.length !== 6}
            >
              {pending ? t("submitting") : t("enrollSubmit")}
            </Button>
          </div>
        </form>
      ) : null}

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
  const submittingRef = useRef(false);

  function submitCode(raw: string) {
    if (submittingRef.current || pending) return;

    const parsed = totpCodeSchema.safeParse(raw);
    if (!parsed.success) {
      setError(t("invalidCode"));
      return;
    }

    setError(null);
    submittingRef.current = true;

    startTransition(async () => {
      try {
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
          setError(t("codeWrong"));
          setCode("");
          return;
        }

        // Allowlisted in safeMfaNextPath (typed next-intl pathnames).
        router.replace(nextPath as "/reset-password");
        router.refresh();
      } finally {
        submittingRef.current = false;
      }
    });
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
    if (digits.length === 6) {
      submitCode(digits);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitCode(code);
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
              autoFocus
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
            />
          </Field>
        </FieldGroup>

        {error ? <FieldError>{error}</FieldError> : null}

        <Button
          type="submit"
          className="w-full"
          disabled={pending || code.length !== 6}
        >
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
