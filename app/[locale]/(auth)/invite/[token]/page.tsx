import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcceptInviteForm } from "@/components/invites/accept-invite-form";
import { peekInvite } from "@/lib/invites/actions";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function AcceptInvitePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invite");
  const tRoles = await getTranslations("Users.roles");
  const invite = await peekInvite(token);

  if (!invite || invite.status !== "pending") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("invalidTitle")}</CardTitle>
            <CardDescription>{t("invalidDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm underline-offset-4 hover:underline">
              {t("loginLink")}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>
            {t("description", {
              clinic: invite.clinicName,
              role: tRoles(invite.role),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invite.email} />
        </CardContent>
      </Card>
    </main>
  );
}
