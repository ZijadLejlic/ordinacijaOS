import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CancelPaymentPlanForm,
  PaymentPlanForm,
  RecordPaymentForm,
  VoidInvoiceForm,
} from "@/components/invoices/invoice-forms";
import { clinicHasFeature } from "@/lib/entitlements";
import { canAccessInvoices, canWriteInvoices } from "@/lib/invoices/rbac";
import { formatInvoiceNumber, roundMoney } from "@/lib/invoices/money";
import { formatMoney } from "@/lib/money/format";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ locale: string; invoiceId: string }>;
};

export default async function InvoiceDetailPage({ params }: Props) {
  const { locale, invoiceId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invoices");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!profile || !canAccessInvoices(profile.role)) {
    redirect({ href: "/dashboard", locale });
  }

  const canWrite = canWriteInvoices(profile!.role);

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, series_year, series_number, status, subtotal_amount, vat_amount, total_amount, currency, notes, issued_at, voided_at, voided_reason, pdf_storage_path, patient_id",
    )
    .eq("id", invoiceId)
    .eq("clinic_id", profile!.clinic_id)
    .maybeSingle();

  if (!invoice) {
    redirect({ href: "/invoices", locale });
  }

  const [
    { data: lines },
    { data: payments },
    { data: plans },
    { data: patientNameRows },
    installmentsEnabled,
  ] = await Promise.all([
    supabase
      .from("invoice_lines")
      .select(
        "id, description, quantity, unit_price, vat_rate, line_total, sort_order",
      )
      .eq("invoice_id", invoice!.id)
      .eq("clinic_id", profile!.clinic_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("payments")
      .select("id, amount, method, paid_at, note")
      .eq("invoice_id", invoice!.id)
      .eq("clinic_id", profile!.clinic_id)
      .order("paid_at", { ascending: false }),
    supabase
      .from("payment_plans")
      .select(
        "id, status, total_amount, installment_count, created_at, payment_plan_installments(id, sequence_number, due_date, amount, status)",
      )
      .eq("invoice_id", invoice!.id)
      .eq("clinic_id", profile!.clinic_id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_invoice_patient_names", {
      p_patient_ids: [invoice!.patient_id],
    }),
    clinicHasFeature(
      supabase,
      profile!.clinic_id,
      "installments_calculator",
    ),
  ]);

  const paid = roundMoney(
    (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
  );
  const total = Number(invoice!.total_amount);
  const balance =
    invoice!.status === "void" ? 0 : roundMoney(total - paid);
  const patient = patientNameRows?.[0];
  const patientName = patient
    ? `${patient.first_name} ${patient.last_name}`.trim()
    : "—";
  const number = formatInvoiceNumber(
    invoice!.series_year,
    invoice!.series_number,
  );
  const activePlan = (plans ?? []).find((p) => p.status === "active");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">
            <Link
              href="/invoices"
              className="underline-offset-4 hover:underline"
            >
              {t("backToList")}
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            {t("invoice")} {number}
          </h1>
          <p className="text-muted-foreground text-sm">
            {patientName} · {t(`status.${invoice!.status}`)} ·{" "}
            {new Date(invoice!.issued_at).toLocaleDateString(locale)}
          </p>
        </div>
        {invoice!.pdf_storage_path ? (
          <a
            href={`/api/invoices/${invoice!.id}/pdf`}
            className="border-border bg-background hover:bg-muted inline-flex h-9 w-full items-center justify-center rounded-lg border px-2.5 text-sm font-medium sm:h-8 sm:w-auto"
          >
            {t("downloadPdf")}
          </a>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("lines")}</CardTitle>
          <CardDescription>
            {t("totalsSummary", {
              subtotal: formatMoney(Number(invoice!.subtotal_amount), locale),
              vat: formatMoney(Number(invoice!.vat_amount), locale),
              total: formatMoney(total, locale),
              balance: formatMoney(balance, locale),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("unitPrice")}</TableHead>
                <TableHead className="text-right">{t("vatRate")}</TableHead>
                <TableHead className="text-right">{t("colTotal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(lines ?? []).map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">
                    {Number(line.quantity)}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(line.unit_price).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(line.vat_rate) * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(line.line_total).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {invoice!.notes ? (
            <p className="text-muted-foreground mt-4 text-sm">
              {t("notes")}: {invoice!.notes}
            </p>
          ) : null}
          {invoice!.status === "void" && invoice!.voided_reason ? (
            <p className="mt-2 text-sm text-red-700">
              {t("voidedReason")}: {invoice!.voided_reason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentsTitle")}</CardTitle>
          <CardDescription>{t("paymentsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(payments ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noPayments")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead className="text-right">
                    {t("paymentAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.paid_at).toLocaleString(locale)}
                    </TableCell>
                    <TableCell>
                      {t(`methods.${payment.method}`)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(Number(payment.amount), locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {canWrite && invoice!.status !== "void" && balance > 0 ? (
            <RecordPaymentForm
              invoiceId={invoice!.id}
              maxAmount={balance}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("planTitle")}</CardTitle>
          <CardDescription>{t("planDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activePlan ? (
            <div className="space-y-3">
              <p className="text-sm">
                {t("activePlan", {
                  count: activePlan.installment_count,
                  total: formatMoney(Number(activePlan.total_amount), locale),
                })}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t("firstDueDate")}</TableHead>
                    <TableHead className="text-right">
                      {t("paymentAmount")}
                    </TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    (activePlan.payment_plan_installments as
                      | {
                          id: string;
                          sequence_number: number;
                          due_date: string;
                          amount: number;
                          status: string;
                        }[]
                      | null) ?? []
                  )
                    .slice()
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.sequence_number}</TableCell>
                        <TableCell>{inst.due_date}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(Number(inst.amount), locale)}
                        </TableCell>
                        <TableCell>
                          {t(`installmentStatus.${inst.status}` as "installmentStatus.pending")}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {canWrite ? (
                <CancelPaymentPlanForm paymentPlanId={activePlan.id} />
              ) : null}
            </div>
          ) : canWrite &&
            invoice!.status !== "void" &&
            invoice!.status !== "paid" ? (
            <PaymentPlanForm
              invoiceId={invoice!.id}
              enabled={installmentsEnabled}
            />
          ) : (
            <p className="text-muted-foreground text-sm">{t("noPlan")}</p>
          )}
        </CardContent>
      </Card>

      {canWrite && invoice!.status !== "void" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("voidTitle")}</CardTitle>
            <CardDescription>{t("voidDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <VoidInvoiceForm invoiceId={invoice!.id} />
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
