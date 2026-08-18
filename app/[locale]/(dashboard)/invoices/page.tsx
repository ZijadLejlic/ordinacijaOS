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
  CreateInvoiceForm,
  InvoiceLegalSettingsForm,
  InvoiceSearchForm,
  InvoicesTable,
} from "@/components/invoices/invoice-forms";
import { canAccessInvoices, canWriteInvoices } from "@/lib/invoices/rbac";
import { formatInvoiceNumber, roundMoney } from "@/lib/invoices/money";
import { getClinicContext } from "@/lib/supabase/clinic-context";
import { createClient } from "@/lib/supabase/server";
import { toDoctorOptions } from "@/lib/staff/bookable";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function InvoicesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, status: statusParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Invoices");
  const supabase = await createClient();

  const ctx = await getClinicContext();

  if (!ctx) {
    redirect({ href: "/login", locale });
  }

  const { profile, clinic } = ctx!;

  if (!canAccessInvoices(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWriteInvoices(profile.role);
  const isOwner = profile.role === "owner";
  const query = q?.trim() ?? "";
  const status =
    statusParam === "unpaid" ||
    statusParam === "partial" ||
    statusParam === "paid" ||
    statusParam === "void" ||
    statusParam === "debts"
      ? statusParam
      : "all";

  let invoicesQuery = supabase
    .from("invoices")
    .select(
      "id, series_year, series_number, status, total_amount, issued_at, patient_id",
    )
    .eq("clinic_id", profile.clinic_id)
    .order("issued_at", { ascending: false })
    .limit(100);

  if (status === "debts") {
    invoicesQuery = invoicesQuery.in("status", ["unpaid", "partial"]);
  } else if (status !== "all") {
    invoicesQuery = invoicesQuery.eq("status", status);
  }

  const [
    { data: invoices },
    { data: patients },
    { data: services },
    { data: doctors },
    { data: locations },
  ] = await Promise.all([
    invoicesQuery,
    canWrite
      ? supabase.rpc("list_patients_for_invoices")
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    canWrite
      ? supabase
          .from("services")
          .select("id, name, price_eur, vat_rate")
          .eq("clinic_id", profile.clinic_id)
          .eq("is_active", true)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string; price_eur: number; vat_rate: number }[] }),
    canWrite
      ? supabase
          .from("profiles")
          .select("id, full_name, role, practices_as_doctor")
          .eq("clinic_id", profile.clinic_id)
          .eq("is_active", true)
          .in("role", ["doctor", "owner"])
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string;
            role: "doctor" | "owner";
            practices_as_doctor: boolean;
          }[],
        }),
    canWrite
      ? supabase
          .from("clinic_locations")
          .select("id, name")
          .eq("clinic_id", profile.clinic_id)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const patientIds = [...new Set((invoices ?? []).map((i) => i.patient_id))];
  const [{ data: payments }, { data: patientNames }] = await Promise.all([
    invoiceIds.length > 0
      ? supabase
          .from("payments")
          .select("invoice_id, amount")
          .eq("clinic_id", profile.clinic_id)
          .in("invoice_id", invoiceIds)
      : Promise.resolve({ data: [] as { invoice_id: string; amount: number }[] }),
    patientIds.length > 0
      ? supabase.rpc("get_invoice_patient_names", {
          p_patient_ids: patientIds,
        })
      : Promise.resolve({
          data: [] as { id: string; first_name: string; last_name: string }[],
        }),
  ]);

  const nameById = new Map(
    (patientNames ?? []).map((p) => [
      p.id,
      `${p.first_name} ${p.last_name}`.trim(),
    ]),
  );

  const paidByInvoice = new Map<string, number>();
  for (const payment of payments ?? []) {
    paidByInvoice.set(
      payment.invoice_id,
      roundMoney(
        (paidByInvoice.get(payment.invoice_id) ?? 0) + Number(payment.amount),
      ),
    );
  }

  let rows = (invoices ?? []).map((invoice) => {
    const patientName = nameById.get(invoice.patient_id) ?? "—";
    const total = Number(invoice.total_amount);
    const paid =
      invoice.status === "void"
        ? 0
        : (paidByInvoice.get(invoice.id) ?? 0);
    const balance =
      invoice.status === "void" ? 0 : roundMoney(total - paid);

    return {
      id: invoice.id,
      number: formatInvoiceNumber(invoice.series_year, invoice.series_number),
      patientName,
      status: invoice.status,
      total,
      issuedAt: invoice.issued_at,
      balance,
    };
  });

  if (query) {
    const qLower = query.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.number.toLowerCase().includes(qLower) ||
        row.patientName.toLowerCase().includes(qLower),
    );
  }

  const settings = (clinic?.settings_json ?? {}) as Record<string, unknown>;
  const legalName =
    typeof settings.legal_name === "string" ? settings.legal_name : "";
  const taxId = typeof settings.tax_id === "string" ? settings.tax_id : "";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InvoiceSearchForm initialQuery={query} initialStatus={status} />
          <InvoicesTable rows={rows} />
        </CardContent>
      </Card>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("createTitle")}</CardTitle>
            <CardDescription>{t("createDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateInvoiceForm
              patients={(patients ?? []).map((p) => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`.trim(),
              }))}
              services={(services ?? []).map((s) => ({
                id: s.id,
                name: s.name,
                priceEur: Number(s.price_eur),
                vatRate: Number(s.vat_rate),
              }))}
              doctors={toDoctorOptions(doctors ?? []).map((d) => ({
                id: d.id,
                name: d.fullName,
              }))}
              locations={(locations ?? []).map((l) => ({
                id: l.id,
                name: l.name,
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("legalSettingsTitle")}</CardTitle>
            <CardDescription>{t("legalSettingsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceLegalSettingsForm legalName={legalName} taxId={taxId} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
