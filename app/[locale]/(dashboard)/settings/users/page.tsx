import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InviteStaffForm,
  InvitesTable,
  MembersTable,
} from "@/components/settings/users-forms";
import {
  CreateOperatorForm,
  OperatorsTable,
} from "@/components/operators/operators-forms";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsUsersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Users");
  const supabase = await createClient();

  const user = await getAuthUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || profile.role !== "owner") {
    redirect({ href: "/dashboard", locale });
  }

  const clinicId = profile!.clinic_id;

  await supabase.rpc("expire_stale_clinic_invites", {
    p_clinic_id: clinicId,
  });

  const [{ data: members }, { data: invites }, { data: operators }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: true }),
      supabase
        .from("clinic_invites")
        .select("id, email, full_name, role, status, expires_at")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false }),
      supabase
        .from("clinic_operators")
        .select("id, profile_id, display_name, is_active")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: true }),
    ]);

  const deskMembers = (members ?? []).filter(
    (m) =>
      m.is_active && (m.role === "reception" || m.role === "assistant"),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("inviteTitle")}</CardTitle>
          <CardDescription>{t("inviteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <InviteStaffForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("membersTitle")}</CardTitle>
          <CardDescription>{t("membersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable
            members={(members ?? []).map((m) => ({
              id: m.id,
              fullName: m.full_name,
              role: m.role,
              isActive: m.is_active,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("invitesTitle")}</CardTitle>
          <CardDescription>{t("invitesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <InvitesTable
            invites={(invites ?? []).map((i) => ({
              id: i.id,
              email: i.email,
              fullName: i.full_name,
              role: i.role,
              status: i.status,
              expiresAt: i.expires_at,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("operatorsTitle")}</CardTitle>
          <CardDescription>{t("operatorsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <CreateOperatorForm
            desks={deskMembers.map((m) => ({
              id: m.id,
              fullName: m.full_name,
              role: m.role,
            }))}
          />
          <OperatorsTable
            operators={(operators ?? []).map((o) => ({
              id: o.id,
              profileId: o.profile_id,
              displayName: o.display_name,
              isActive: o.is_active,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
