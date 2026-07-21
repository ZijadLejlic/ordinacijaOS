"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { MenuIcon, XIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { clearOperatorSessionAction } from "@/lib/operators/actions";
import { canAccessCalendar } from "@/lib/calendar/rbac";
import { canAccessCrm } from "@/lib/crm/rbac";
import { canReadEmailTemplates } from "@/lib/email/rbac";
import { canReadConsentForms } from "@/lib/consent/rbac";
import { canAccessExpenses } from "@/lib/expenses/rbac";
import { canAccessImport } from "@/lib/import/rbac";
import { canAccessInventory } from "@/lib/inventory/rbac";
import { canAccessInvoices } from "@/lib/invoices/rbac";
import { canAccessPatients, canReadServices } from "@/lib/patients/rbac";
import { PRODUCT_NAME, BRAND_LOGO } from "@/lib/brand/constants";
import { cn } from "@/lib/utils";
import type { BrandingColors } from "@/lib/branding/parse";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

type NavItem = {
  href:
    | "/dashboard"
    | "/calendar"
    | "/patients"
    | "/services"
    | "/invoices"
    | "/expenses"
    | "/inventory"
    | "/crm"
    | "/settings/users"
    | "/settings/locations"
    | "/settings/branding"
    | "/settings/email"
    | "/settings/consent"
    | "/settings/import"
    | "/settings/audit"
    | "/settings/privacy";
  labelKey:
    | "dashboard"
    | "calendar"
    | "patients"
    | "services"
    | "invoices"
    | "expenses"
    | "inventory"
    | "crm"
    | "settings"
    | "users"
    | "locations"
    | "branding"
    | "email"
    | "consent"
    | "import"
    | "audit"
    | "privacy";
  badge?: number;
};

export type AppShellBranding = {
  logoUrl: string | null;
  colors: BrandingColors;
};

type AppShellProps = {
  clinicName: string;
  role: AppRole;
  fullName: string;
  operatorName?: string | null;
  isOwner: boolean;
  showExpenses?: boolean;
  showInventory?: boolean;
  inventoryLowCount?: number;
  showCrm?: boolean;
  crmOpenCount?: number;
  showConsent?: boolean;
  branding?: AppShellBranding | null;
  children: React.ReactNode;
};

export function AppShell({
  clinicName,
  role,
  fullName,
  operatorName,
  isOwner,
  showExpenses = false,
  showInventory = false,
  inventoryLowCount = 0,
  showCrm = false,
  crmOpenCount = 0,
  showConsent = false,
  branding = null,
  children,
}: AppShellProps) {
  const showImport = canAccessImport(role);
  const showEmail = canReadEmailTemplates(role);
  const showConsentNav = showConsent && canReadConsentForms(role);
  const inventoryNav = showInventory && canAccessInventory(role);
  const crmNav = showCrm && canAccessCrm(role);
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { href: "/dashboard", labelKey: "dashboard" },
    ...(canAccessCalendar(role)
      ? ([{ href: "/calendar", labelKey: "calendar" }] as const)
      : []),
    ...(canAccessPatients(role)
      ? ([{ href: "/patients", labelKey: "patients" }] as const)
      : []),
    ...(canReadServices(role)
      ? ([{ href: "/services", labelKey: "services" }] as const)
      : []),
    ...(canAccessInvoices(role)
      ? ([{ href: "/invoices", labelKey: "invoices" }] as const)
      : []),
    ...(showExpenses && canAccessExpenses(role)
      ? ([{ href: "/expenses", labelKey: "expenses" }] as const)
      : []),
    ...(inventoryNav
      ? ([
          {
            href: "/inventory",
            labelKey: "inventory",
            badge: inventoryLowCount > 0 ? inventoryLowCount : undefined,
          },
        ] as const)
      : []),
    ...(crmNav
      ? ([
          {
            href: "/crm",
            labelKey: "crm",
            badge: crmOpenCount > 0 ? crmOpenCount : undefined,
          },
        ] as const)
      : []),
    ...(isOwner
      ? ([
          { href: "/settings/locations", labelKey: "locations" },
          { href: "/settings/branding", labelKey: "branding" },
          { href: "/settings/users", labelKey: "users" },
          { href: "/settings/audit", labelKey: "audit" },
          { href: "/settings/privacy", labelKey: "privacy" },
        ] as const)
      : []),
    ...(showEmail
      ? ([{ href: "/settings/email", labelKey: "email" }] as const)
      : []),
    ...(showConsentNav
      ? ([{ href: "/settings/consent", labelKey: "consent" }] as const)
      : []),
    ...(showImport
      ? ([{ href: "/settings/import", labelKey: "import" }] as const)
      : []),
  ];

  function isActive(href: NavItem["href"]) {
    return href === "/dashboard"
      ? pathname === href
      : pathname.startsWith(href);
  }

  const brandStyle = shellBrandStyle(branding?.colors ?? null);
  const logoUrl = branding?.logoUrl ?? null;

  return (
    <div
      className="flex min-h-full flex-1 flex-col md:flex-row"
      style={brandStyle}
    >
      <header className="bg-background sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden">
        <BrandMark clinicName={clinicName} logoUrl={logoUrl} compact />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={mobileOpen ? t("closeMenu") : t("menu")}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <XIcon /> : <MenuIcon />}
        </Button>
      </header>

      <aside
        className={cn(
          "flex w-full flex-col gap-6 border-b p-4 md:w-64 md:shrink-0 md:border-b-0 md:border-r md:p-6",
          brandStyle
            ? "bg-[var(--clinic-brand-bg)] text-[var(--clinic-brand-text)]"
            : "bg-muted/30",
          mobileOpen ? "flex" : "hidden md:flex",
        )}
      >
        <div className="hidden md:block">
          <BrandMark clinicName={clinicName} logoUrl={logoUrl} />
        </div>

        <div className="text-sm">
          <p className="font-medium">{clinicName}</p>
          <p
            className={cn(
              brandStyle ? "opacity-70" : "text-muted-foreground",
            )}
          >
            {fullName} · {t(`roles.${role}`)}
            {operatorName ? ` · ${operatorName}` : null}
          </p>
        </div>

        <nav className="flex flex-col gap-1" aria-label={t("menu")}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? brandStyle
                    ? "bg-[var(--clinic-brand-accent)] text-white"
                    : "bg-primary text-primary-foreground"
                  : brandStyle
                    ? "hover:bg-black/5"
                    : "hover:bg-muted",
              )}
            >
              <span>{t(item.labelKey)}</span>
              {item.badge ? (
                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-md px-1.5 text-xs font-semibold",
                    isActive(item.href)
                      ? "bg-white/20 text-inherit"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          {operatorName ? (
            <form action={clearOperatorSessionAction}>
              <Button type="submit" variant="ghost" size="sm" className="w-full">
                {t("switchOperator")}
              </Button>
            </form>
          ) : null}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              {t("logout")}
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function BrandMark({
  clinicName,
  logoUrl,
  compact = false,
}: {
  clinicName: string;
  logoUrl: string | null;
  compact?: boolean;
}) {
  if (logoUrl) {
    return (
      <Link href="/dashboard" className="inline-flex min-w-0 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket */}
        <img
          src={logoUrl}
          alt={clinicName}
          className="h-8 w-8 shrink-0 rounded object-contain"
        />
        <span
          className={cn(
            "font-semibold tracking-tight",
            compact && "max-w-[11rem] truncate",
          )}
        >
          {clinicName}
        </span>
      </Link>
    );
  }

  return (
    <Link href="/dashboard" className="inline-flex min-w-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
      <img
        src={BRAND_LOGO.mark}
        alt=""
        className="h-8 w-8 shrink-0 object-contain"
      />
      <span
        className={cn(
          "font-semibold tracking-tight",
          compact && "max-w-[11rem] truncate",
        )}
      >
        {PRODUCT_NAME}
      </span>
    </Link>
  );
}

function shellBrandStyle(
  colors: BrandingColors | null,
): CSSProperties | undefined {
  if (!colors) return undefined;
  const style: CSSProperties = {};
  if (colors.background) {
    (style as Record<string, string>)["--clinic-brand-bg"] = colors.background;
  }
  if (colors.text) {
    (style as Record<string, string>)["--clinic-brand-text"] = colors.text;
  }
  if (colors.accent) {
    (style as Record<string, string>)["--clinic-brand-accent"] = colors.accent;
  }
  if (!colors.background && !colors.text && !colors.accent) {
    return undefined;
  }
  // Fallbacks so partial branding still paints consistently.
  if (!colors.background) {
    (style as Record<string, string>)["--clinic-brand-bg"] =
      "color-mix(in oklab, var(--muted) 30%, transparent)";
  }
  if (!colors.text) {
    (style as Record<string, string>)["--clinic-brand-text"] =
      "var(--foreground)";
  }
  if (!colors.accent) {
    (style as Record<string, string>)["--clinic-brand-accent"] =
      "var(--primary)";
  }
  return style;
}
