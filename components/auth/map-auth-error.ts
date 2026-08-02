import type { useTranslations } from "next-intl";
import type { AuthActionState } from "@/lib/auth/actions";

type AuthT = ReturnType<typeof useTranslations<"Auth">>;

export function mapAuthError(t: AuthT, state: AuthActionState) {
  if (!state) return null;
  if (state.message === "confirmEmail") return t("confirmEmail");
  if (state.message === "resetEmailSent") return t("resetEmailSent");
  if (state.error === "invalid") return t("invalid");
  if (state.error === "invalidCredentials") return t("invalidCredentials");
  if (state.error === "locked") return t("locked");
  if (state.error === "missingClinic") return t("missingClinic");
  if (state.error === "emailTaken") return t("emailTaken");
  if (state.error === "missingAppUrl") return t("missingAppUrl");
  if (state.error === "passwordMismatch") return t("passwordMismatch");
  if (state.error === "resetSessionExpired") return t("resetSessionExpired");
  if (state.error === "passwordSameAsOld") return t("passwordSameAsOld");
  if (state.error === "emailSendFailed") return t("emailSendFailed");
  if (state.error === "mfaRequiredForPassword") {
    return t("mfaRequiredForPassword");
  }
  if (state.error) return state.error;
  return null;
}
