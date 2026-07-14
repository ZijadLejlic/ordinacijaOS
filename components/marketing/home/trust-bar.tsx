import {
  DatabaseBackupIcon,
  LifeBuoyIcon,
  ServerIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

const ITEMS = [
  { key: "eu", Icon: ServerIcon },
  { key: "gdpr", Icon: ShieldCheckIcon },
  { key: "backup", Icon: DatabaseBackupIcon },
  { key: "support", Icon: LifeBuoyIcon },
] as const;

export async function TrustBar() {
  const t = await getTranslations("Marketing.home.trust");

  return (
    <section className="border-y border-[var(--marketing-mist)] bg-[var(--marketing-surface)]">
      <ul className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5 md:justify-between md:gap-x-4 md:px-8">
        {ITEMS.map(({ key, Icon }) => (
          <li
            key={key}
            className="flex items-center gap-2 text-sm text-[color-mix(in_oklab,var(--marketing-ink)_62%,transparent)]"
          >
            <Icon className="size-4 shrink-0 text-[var(--marketing-accent)]" />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
