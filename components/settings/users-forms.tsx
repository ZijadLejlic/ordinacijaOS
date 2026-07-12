"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createInviteAction,
  deactivateUserAction,
  forceLogoutUserAction,
  resendInviteAction,
  resetUserPasswordAction,
  revokeInviteAction,
  type InviteActionState,
} from "@/lib/invites/actions";
import { staffInviteRoles } from "@/lib/validations/invite";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type InviteStatus = Database["public"]["Enums"]["invite_status"];

export type UsersPageMember = {
  id: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
};

export type UsersPageInvite = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  status: InviteStatus;
  expiresAt: string;
};

function mapInviteError(
  t: ReturnType<typeof useTranslations<"Users">>,
  state: InviteActionState,
) {
  if (!state?.error) return null;
  const known = [
    "invalid",
    "unauthorized",
    "forbidden",
    "userLimit",
    "doctorLimit",
    "emailTaken",
    "inviteExists",
    "inviteFailed",
    "emailFailed",
    "inviteNotFound",
    "inviteExpired",
    "cannotDeactivateSelf",
    "userNotFound",
    "missingAppUrl",
    "resetFailed",
  ] as const;
  if ((known as readonly string[]).includes(state.error)) {
    return t(`errors.${state.error as (typeof known)[number]}`);
  }
  return state.error;
}

export function InviteStaffForm() {
  const t = useTranslations("Users");
  const [state, action, pending] = useActionState(createInviteAction, null);
  const error = mapInviteError(t, state);

  return (
    <form action={action} className="space-y-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="fullName">{t("fullName")}</FieldLabel>
          <Input id="fullName" name="fullName" required minLength={2} />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
          <Input id="email" name="email" type="email" required />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="role">{t("role")}</FieldLabel>
          <select
            id="role"
            name="role"
            required
            defaultValue="doctor"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            {staffInviteRoles.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>

      {error ? <FieldError>{error}</FieldError> : null}
      {state?.message === "inviteSent" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {t("inviteSent")}
          {state.inviteUrl ? (
            <span className="text-muted-foreground mt-1 block break-all text-xs">
              {t("devLink")}: {state.inviteUrl}
            </span>
          ) : null}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("inviteSubmit")}
      </Button>
    </form>
  );
}

function RowActions({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}

export function MembersTable({ members }: { members: UsersPageMember[] }) {
  const t = useTranslations("Users");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(
    action: () => Promise<InviteActionState>,
    successKey: "userDeactivated" | "userLoggedOut" | "resetSent",
  ) {
    setFlash(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(mapInviteError(t, result) ?? result.error);
        return;
      }
      if (result?.message === successKey) {
        setFlash(t(successKey));
      }
    });
  }

  return (
    <div className="space-y-3">
      {flash ? (
        <p className="text-sm text-green-700 dark:text-green-400">{flash}</p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>{member.fullName}</TableCell>
              <TableCell>{t(`roles.${member.role}`)}</TableCell>
              <TableCell>
                {member.isActive ? t("active") : t("inactive")}
              </TableCell>
              <TableCell>
                {member.role === "owner" ? (
                  <span className="text-muted-foreground text-xs">—</span>
                ) : (
                  <RowActions>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || !member.isActive}
                      onClick={() =>
                        run(
                          () => forceLogoutUserAction(member.id),
                          "userLoggedOut",
                        )
                      }
                    >
                      {t("forceLogout")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || !member.isActive}
                      onClick={() =>
                        run(
                          () => resetUserPasswordAction(member.id),
                          "resetSent",
                        )
                      }
                    >
                      {t("resetPassword")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending || !member.isActive}
                      onClick={() =>
                        run(
                          () => deactivateUserAction(member.id),
                          "userDeactivated",
                        )
                      }
                    >
                      {t("deactivate")}
                    </Button>
                  </RowActions>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function InvitesTable({ invites }: { invites: UsersPageInvite[] }) {
  const t = useTranslations("Users");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  function run(
    action: () => Promise<InviteActionState>,
    successKey: "inviteSent" | "inviteRevoked",
  ) {
    setFlash(null);
    setError(null);
    setDevLink(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(mapInviteError(t, result) ?? result.error);
        return;
      }
      if (result?.message === successKey) {
        setFlash(t(successKey));
        if (result.inviteUrl) setDevLink(result.inviteUrl);
      }
    });
  }

  if (invites.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("noInvites")}</p>
    );
  }

  return (
    <div className="space-y-3">
      {flash ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          {flash}
          {devLink ? (
            <span className="text-muted-foreground mt-1 block break-all text-xs">
              {t("devLink")}: {devLink}
            </span>
          ) : null}
        </p>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invites.map((invite) => (
            <TableRow key={invite.id}>
              <TableCell>{invite.fullName}</TableCell>
              <TableCell>{invite.email}</TableCell>
              <TableCell>{t(`roles.${invite.role}`)}</TableCell>
              <TableCell>{t(`inviteStatus.${invite.status}`)}</TableCell>
              <TableCell>
                {invite.status === "pending" ? (
                  <RowActions>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() => resendInviteAction(invite.id), "inviteSent")
                      }
                    >
                      {t("resend")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => revokeInviteAction(invite.id),
                          "inviteRevoked",
                        )
                      }
                    >
                      {t("revoke")}
                    </Button>
                  </RowActions>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
