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
  CreateInventoryItemForm,
  InventorySearchForm,
  InventoryTable,
  type InventoryRow,
} from "@/components/inventory/inventory-forms";
import { clinicHasFeature } from "@/lib/entitlements";
import {
  canAccessInventory,
  canWriteInventory,
} from "@/lib/inventory/rbac";
import { isLowStock } from "@/lib/inventory/stock";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; stock?: string }>;
};

export default async function InventoryPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, status: statusParam, stock: stockParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Inventory");
  const supabase = await createClient();

  const user = await getAuthUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessInventory(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const featureOk = await clinicHasFeature(
    supabase,
    profile!.clinic_id,
    "inventory_basic",
  );
  if (!featureOk) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWriteInventory(profile!.role);
  const query = q?.trim() ?? "";
  const status =
    statusParam === "active" || statusParam === "inactive"
      ? statusParam
      : "all";
  const stock = stockParam === "low" ? "low" : "all";

  let itemsQuery = supabase
    .from("inventory_items")
    .select(
      "id, name, unit, quantity, low_stock_threshold, notes, is_active",
    )
    .eq("clinic_id", profile!.clinic_id)
    .order("name", { ascending: true });

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    itemsQuery = itemsQuery.ilike("name", `%${escaped}%`);
  }

  if (status === "active") {
    itemsQuery = itemsQuery.eq("is_active", true);
  } else if (status === "inactive") {
    itemsQuery = itemsQuery.eq("is_active", false);
  }

  const { data: items } = await itemsQuery;

  let rows: InventoryRow[] = (items ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unit,
    quantity: Number(row.quantity),
    lowStockThreshold: Number(row.low_stock_threshold),
    notes: row.notes,
    isActive: row.is_active,
  }));

  if (stock === "low") {
    rows = rows.filter(
      (row) => row.isActive && isLowStock(row.quantity, row.lowStockThreshold),
    );
  }

  const lowCount = rows.filter(
    (row) => row.isActive && isLowStock(row.quantity, row.lowStockThreshold),
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
            <CardDescription>{t("createDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateInventoryItemForm />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>
            {t("listDescription")}
            {lowCount > 0 ? ` ${t("lowStockSummary", { count: lowCount })}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InventorySearchForm
            initialQuery={query}
            initialStatus={status}
            initialStock={stock}
          />
          <InventoryTable items={rows} canWrite={canWrite} />
        </CardContent>
      </Card>
    </main>
  );
}
