import { NextResponse } from "next/server";
import { canAccessInvoices } from "@/lib/invoices/rbac";
import { PATIENT_FILES_BUCKET } from "@/lib/patients/storage";
import { formatInvoiceNumber } from "@/lib/invoices/money";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ invoiceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { invoiceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canAccessInvoices(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, series_year, series_number, pdf_storage_path, patient_id, clinic_id",
    )
    .eq("id", invoiceId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!invoice?.pdf_storage_path) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: file, error } = await supabase.storage
    .from(PATIENT_FILES_BUCKET)
    .download(invoice.pdf_storage_path);

  if (error || !file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `invoice-${formatInvoiceNumber(invoice.series_year, invoice.series_number)}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
