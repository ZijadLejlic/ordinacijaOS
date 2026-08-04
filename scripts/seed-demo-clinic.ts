/**
 * Seed (or refresh) the marketing live demo clinic (W8 / Website §4.6).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-clinic.ts
 *   npx tsx scripts/seed-demo-clinic.ts --refresh   # wipe + reseed clinic data
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 * Optional: DEMO_CLINIC_EMAIL / DEMO_CLINIC_PASSWORD (defaults below).
 *
 * Idempotent by default; `--refresh` replaces operational demo data with a
 * rich, multi-national patient base + full pricelist + calendar/finance samples.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import type { Database, Json } from "../lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
type ToothStatus = Database["public"]["Enums"]["tooth_status"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
type AllergySeverity = Database["public"]["Enums"]["allergy_severity"];

const DEMO_EMAIL =
  process.env.DEMO_CLINIC_EMAIL?.trim() || "demo@dentord.com";
const DEMO_PASSWORD =
  process.env.DEMO_CLINIC_PASSWORD?.trim() || "DemoDental-2026!";
const DEMO_CLINIC_NAME = "Demo Dental";
const REFRESH = process.argv.includes("--refresh");

type DemoPatient = {
  first_name: string;
  last_name: string;
  origin: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  notes?: string;
  medical_history?: string;
  next_control_at?: string;
};

/** Diverse names reflecting a Sarajevo clinic with patients of many origins. */
const PATIENTS: DemoPatient[] = [
  // BiH / regional
  { first_name: "Amina", last_name: "Hodžić", origin: "BA", phone: "+38761123401", email: "amina.hodzic@example.ba", address: "Zmaja od Bosne 12, Sarajevo", date_of_birth: "1992-03-14", notes: "Preferira dnevne termine.", next_control_at: "2026-09-10" },
  { first_name: "Emir", last_name: "Begić", origin: "BA", phone: "+38761123402", email: "emir.begic@example.ba", address: "Titova 45, Sarajevo", date_of_birth: "1985-11-02", medical_history: "Hipertenzija — pod kontrolom." },
  { first_name: "Lejla", last_name: "Softić", origin: "BA", phone: "+38762123403", email: "lejla.softic@example.ba", address: "Grbavička 8, Sarajevo", date_of_birth: "1998-07-21" },
  { first_name: "Haris", last_name: "Kovačević", origin: "BA", phone: "+38761123404", email: "haris.kovacevic@example.ba", address: "Ilidža, Sarajevo", date_of_birth: "1979-01-30", notes: "Implant plan u toku." },
  { first_name: "Maja", last_name: "Petrović", origin: "RS", phone: "+38765123405", email: "maja.petrovic@example.rs", address: "Banja Luka (dolazi u Sarajevo)", date_of_birth: "1990-05-09" },
  { first_name: "Nikola", last_name: "Jovanović", origin: "RS", phone: "+38765123406", email: "nikola.jovanovic@example.rs", address: "Dobrinja 5, Sarajevo", date_of_birth: "1988-09-18" },
  { first_name: "Ana", last_name: "Marić", origin: "HR", phone: "+38761123407", email: "ana.maric@example.hr", address: "Marijin Dvor, Sarajevo", date_of_birth: "1995-12-03", next_control_at: "2026-08-20" },
  { first_name: "Ivan", last_name: "Horvat", origin: "HR", phone: "+38591123408", email: "ivan.horvat@example.hr", address: "Zagreb — gost", date_of_birth: "1982-04-27" },
  { first_name: "Sara", last_name: "Delić", origin: "BA", phone: "+38761123409", email: "sara.delic@example.ba", address: "Čengić Vila, Sarajevo", date_of_birth: "2001-08-11" },
  { first_name: "Marko", last_name: "Novak", origin: "SI", phone: "+38640123410", email: "marko.novak@example.si", address: "Ljubljana — poslovni putnik", date_of_birth: "1987-06-15" },
  // Western / Northern Europe
  { first_name: "Sophie", last_name: "Müller", origin: "DE", phone: "+49170123411", email: "sophie.mueller@example.de", address: "Njemačka — ljetni boravak", date_of_birth: "1993-02-28", notes: "Govori EN/DE." },
  { first_name: "Lukas", last_name: "Schmidt", origin: "DE", phone: "+49170123412", email: "lukas.schmidt@example.de", address: "Hotel Europe, Sarajevo", date_of_birth: "1986-10-07" },
  { first_name: "Emma", last_name: "Johnson", origin: "GB", phone: "+44770123413", email: "emma.johnson@example.co.uk", address: "Expat, Centar", date_of_birth: "1991-01-19", medical_history: "Alergija na penicilin (vidi alergije)." },
  { first_name: "James", last_name: "Wilson", origin: "GB", phone: "+44770123414", email: "james.wilson@example.co.uk", address: "Skenderija 3, Sarajevo", date_of_birth: "1975-08-22" },
  { first_name: "Marie", last_name: "Dupont", origin: "FR", phone: "+33612123415", email: "marie.dupont@example.fr", address: "Francuska — turist", date_of_birth: "1994-04-12" },
  { first_name: "Lucas", last_name: "Bernard", origin: "FR", phone: "+33612123416", email: "lucas.bernard@example.fr", address: "Baščaršija (kratki boravak)", date_of_birth: "1989-11-25" },
  { first_name: "Giulia", last_name: "Rossi", origin: "IT", phone: "+39333123417", email: "giulia.rossi@example.it", address: "Italija — dijaspora", date_of_birth: "1996-07-08", next_control_at: "2026-08-28" },
  { first_name: "Marco", last_name: "Bianchi", origin: "IT", phone: "+39333123418", email: "marco.bianchi@example.it", address: "Novo Sarajevo", date_of_birth: "1983-03-31" },
  { first_name: "Lars", last_name: "Andersen", origin: "NO", phone: "+47912123419", email: "lars.andersen@example.no", address: "Norveška — sezonski posao", date_of_birth: "1980-12-14" },
  { first_name: "Ingrid", last_name: "Johansson", origin: "SE", phone: "+46701234120", email: "ingrid.johansson@example.se", address: "Švedska — posjeta porodici", date_of_birth: "1997-05-05" },
  { first_name: "Pieter", last_name: "de Vries", origin: "NL", phone: "+31612123421", email: "pieter.devries@example.nl", address: "Nizozemska — turist", date_of_birth: "1984-09-09" },
  { first_name: "Eva", last_name: "Nováková", origin: "CZ", phone: "+42060123422", email: "eva.novakova@example.cz", address: "Češka — razmjena", date_of_birth: "1999-02-17" },
  // Southern / Eastern Europe
  { first_name: "Elena", last_name: "Popescu", origin: "RO", phone: "+40721123423", email: "elena.popescu@example.ro", address: "Rumunija — radnik", date_of_birth: "1992-06-20" },
  { first_name: "Andrei", last_name: "Ionescu", origin: "RO", phone: "+40721123424", email: "andrei.ionescu@example.ro", address: "Hrasno, Sarajevo", date_of_birth: "1988-10-01" },
  { first_name: "Ioannis", last_name: "Papadopoulos", origin: "GR", phone: "+30697123425", email: "ioannis.papadopoulos@example.gr", address: "Grčka — posao", date_of_birth: "1977-07-13" },
  { first_name: "Dimitra", last_name: "Nikolaou", origin: "GR", phone: "+30697123426", email: "dimitra.nikolaou@example.gr", address: "Centar, Sarajevo", date_of_birth: "1993-12-29" },
  { first_name: "Katarzyna", last_name: "Nowak", origin: "PL", phone: "+48501123427", email: "katarzyna.nowak@example.pl", address: "Poljska — student", date_of_birth: "2000-04-04", next_control_at: "2026-09-01" },
  { first_name: "Piotr", last_name: "Kowalski", origin: "PL", phone: "+48501123428", email: "piotr.kowalski@example.pl", address: "Alipašino Polje", date_of_birth: "1985-08-16" },
  { first_name: "Yulia", last_name: "Kovalenko", origin: "UA", phone: "+38050123429", email: "yulia.kovalenko@example.ua", address: "Ukrajina — privremeni boravak", date_of_birth: "1991-03-08", notes: "Hitni termini po dogovoru." },
  { first_name: "Oleksandr", last_name: "Shevchenko", origin: "UA", phone: "+38050123430", email: "oleksandr.shevchenko@example.ua", address: "Dobrinja, Sarajevo", date_of_birth: "1986-11-11" },
  { first_name: "Mehmet", last_name: "Yılmaz", origin: "TR", phone: "+90532123431", email: "mehmet.yilmaz@example.tr", address: "Turska — dijaspora", date_of_birth: "1978-01-23", medical_history: "Dijabetes tip 2." },
  { first_name: "Ayşe", last_name: "Demir", origin: "TR", phone: "+90532123432", email: "ayse.demir@example.tr", address: "Stari Grad, Sarajevo", date_of_birth: "1994-09-30" },
  // Middle East / Africa / Asia / Americas
  { first_name: "Fatima", last_name: "Al-Hassan", origin: "SA", phone: "+96650123433", email: "fatima.alhassan@example.sa", address: "Saudijska Arabija — posjeta", date_of_birth: "1990-05-18" },
  { first_name: "Omar", last_name: "Khalil", origin: "JO", phone: "+96279123434", email: "omar.khalil@example.jo", address: "Jordan — turist", date_of_birth: "1987-07-07" },
  { first_name: "Amira", last_name: "Hassan", origin: "EG", phone: "+20100123435", email: "amira.hassan@example.eg", address: "Egipat — studije", date_of_birth: "1998-10-12" },
  { first_name: "Kwame", last_name: "Mensah", origin: "GH", phone: "+23324123436", email: "kwame.mensah@example.gh", address: "Gana — međunarodni student", date_of_birth: "1995-02-02" },
  { first_name: "Aisha", last_name: "Okafor", origin: "NG", phone: "+23480123437", email: "aisha.okafor@example.ng", address: "Nigerija — NGO", date_of_birth: "1992-08-25", next_control_at: "2026-08-15" },
  { first_name: "Wei", last_name: "Chen", origin: "CN", phone: "+86138123438", email: "wei.chen@example.cn", address: "Kina — poslovni boravak", date_of_birth: "1989-06-06" },
  { first_name: "Yuki", last_name: "Tanaka", origin: "JP", phone: "+8190123439", email: "yuki.tanaka@example.jp", address: "Japan — razmjena", date_of_birth: "1997-12-20" },
  { first_name: "Priya", last_name: "Sharma", origin: "IN", phone: "+91981123440", email: "priya.sharma@example.in", address: "Indija — IT remote", date_of_birth: "1993-04-14" },
  { first_name: "Arjun", last_name: "Patel", origin: "IN", phone: "+91981123441", email: "arjun.patel@example.in", address: "Ilidža, Sarajevo", date_of_birth: "1984-09-27", medical_history: "Astma — blaga." },
  { first_name: "Min-jun", last_name: "Kim", origin: "KR", phone: "+8210123442", email: "minjun.kim@example.kr", address: "Južna Koreja — turist", date_of_birth: "1996-01-08" },
  { first_name: "Sofía", last_name: "García", origin: "ES", phone: "+34612123443", email: "sofia.garcia@example.es", address: "Španija — Erasmus alumni", date_of_birth: "1994-11-03" },
  { first_name: "Carlos", last_name: "Fernández", origin: "ES", phone: "+34612123444", email: "carlos.fernandez@example.es", address: "Centar, Sarajevo", date_of_birth: "1981-05-21" },
  { first_name: "Isabella", last_name: "Silva", origin: "BR", phone: "+55119123445", email: "isabella.silva@example.br", address: "Brazil — dig. nomad", date_of_birth: "1995-03-16", notes: "Preferira jutarnje termine." },
  { first_name: "Mateo", last_name: "González", origin: "MX", phone: "+52551123446", email: "mateo.gonzalez@example.mx", address: "Meksiko — posjetitelj", date_of_birth: "1988-07-29" },
  { first_name: "Olivia", last_name: "Brown", origin: "US", phone: "+12025551247", email: "olivia.brown@example.com", address: "SAD — Embassy", date_of_birth: "1990-10-10", next_control_at: "2026-09-05" },
  { first_name: "Liam", last_name: "O'Connor", origin: "IE", phone: "+35387123448", email: "liam.oconnor@example.ie", address: "Irska — remote", date_of_birth: "1986-02-14" },
  { first_name: "Noa", last_name: "Cohen", origin: "IL", phone: "+97252123449", email: "noa.cohen@example.il", address: "Izrael — putovanje", date_of_birth: "1991-08-08" },
  { first_name: "Sara", last_name: "Al-Masri", origin: "SY", phone: "+38761123450", email: "sara.almasri@example.ba", address: "Sarajevo — lokalna adresa", date_of_birth: "1999-06-01", notes: "Lokalni broj +387." },
];

const SERVICES: Array<{
  name: string;
  code: string;
  duration_minutes: number;
  price_eur: number;
  vat_rate: number;
}> = [
  { name: "Pregled / konzultacija", code: "PRG", duration_minutes: 20, price_eur: 25, vat_rate: 17 },
  { name: "Kontrola", code: "KON", duration_minutes: 20, price_eur: 20, vat_rate: 17 },
  { name: "Profesionalna higijena", code: "HIG", duration_minutes: 45, price_eur: 40, vat_rate: 17 },
  { name: "Ultrazvučno čišćenje", code: "ULT", duration_minutes: 40, price_eur: 35, vat_rate: 17 },
  { name: "Bijeljenje zuba", code: "BIJ", duration_minutes: 60, price_eur: 180, vat_rate: 17 },
  { name: "Kompozitna plomba", code: "PLM", duration_minutes: 40, price_eur: 55, vat_rate: 17 },
  { name: "Amalgam zamjena", code: "AMZ", duration_minutes: 45, price_eur: 65, vat_rate: 17 },
  { name: "Endodoncija (jednokanalni)", code: "END1", duration_minutes: 60, price_eur: 120, vat_rate: 17 },
  { name: "Endodoncija (višekanalni)", code: "END2", duration_minutes: 90, price_eur: 180, vat_rate: 17 },
  { name: "Vađenje zuba", code: "VAD", duration_minutes: 30, price_eur: 50, vat_rate: 17 },
  { name: "Hirurško vađenje", code: "HIR", duration_minutes: 60, price_eur: 120, vat_rate: 17 },
  { name: "Krunica (cirkon)", code: "KRU", duration_minutes: 60, price_eur: 320, vat_rate: 17 },
  { name: "Most (po članu)", code: "MST", duration_minutes: 60, price_eur: 280, vat_rate: 17 },
  { name: "Implant (ugradnja)", code: "IMP", duration_minutes: 90, price_eur: 650, vat_rate: 17 },
  { name: "Protetika na implantu", code: "PRI", duration_minutes: 60, price_eur: 450, vat_rate: 17 },
  { name: "Proteza totalna", code: "PRT", duration_minutes: 45, price_eur: 400, vat_rate: 17 },
  { name: "Ortodontska kontrola", code: "ORT", duration_minutes: 20, price_eur: 30, vat_rate: 17 },
  { name: "Pedijatrijski pregled", code: "PED", duration_minutes: 30, price_eur: 30, vat_rate: 17 },
  { name: "RTG snimak (intraoralni)", code: "RTG", duration_minutes: 15, price_eur: 15, vat_rate: 17 },
  { name: "Ortopan", code: "OPG", duration_minutes: 20, price_eur: 35, vat_rate: 17 },
  { name: "Hitni pregled", code: "HIT", duration_minutes: 30, price_eur: 45, vat_rate: 17 },
  { name: "Parodontološki tretman", code: "PAR", duration_minutes: 50, price_eur: 80, vat_rate: 17 },
];

const INVENTORY = [
  { name: "Kompozit A2", unit: "kom", quantity: 18, low_stock_threshold: 5, notes: "3M Filtek" },
  { name: "Kompozit A3", unit: "kom", quantity: 11, low_stock_threshold: 5 },
  { name: "Anestezija Ubistesin", unit: "amp", quantity: 4, low_stock_threshold: 12, notes: "Nisko stanje" },
  { name: "Rukavice M", unit: "kut", quantity: 14, low_stock_threshold: 4 },
  { name: "Rukavice L", unit: "kut", quantity: 9, low_stock_threshold: 4 },
  { name: "Maske kirurške", unit: "kut", quantity: 6, low_stock_threshold: 3 },
  { name: "Igle 27G", unit: "kut", quantity: 7, low_stock_threshold: 3 },
  { name: "Endo turpije K-file", unit: "set", quantity: 5, low_stock_threshold: 2 },
  { name: "Cement GIC", unit: "kom", quantity: 8, low_stock_threshold: 3 },
  { name: "Alginat otisci", unit: "kg", quantity: 2.5, low_stock_threshold: 1 },
  { name: "Dezinfekcija površina", unit: "L", quantity: 3, low_stock_threshold: 1 },
  { name: "Fluor lak", unit: "kom", quantity: 10, low_stock_threshold: 3 },
];

const STAFF: Array<{
  email: string;
  full_name: string;
  role: AppRole;
}> = [
  { email: "dr.softic@demo.dentord.com", full_name: "Dr. Amila Softić", role: "doctor" },
  { email: "dr.petrovic@demo.dentord.com", full_name: "Dr. Marko Petrović", role: "doctor" },
  { email: "recepcija@demo.dentord.com", full_name: "Selma Hadžić", role: "reception" },
];

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function atSarajevo(dayOffset: number, hour: number, minute = 0): Date {
  // Build wall-clock Europe/Sarajevo as UTC+2 (CEST, Aug) for demo stability.
  const base = new Date("2026-08-04T00:00:00+02:00");
  base.setDate(base.getDate() + dayOffset);
  base.setHours(hour, minute, 0, 0);
  return base;
}

function money(n: number) {
  return Math.round(n * 100) / 100;
}

async function ensureAuthUser(
  service: SupabaseClient<Database>,
  email: string,
  fullName: string,
  password: string,
): Promise<string> {
  const list = await service.auth.admin.listUsers({ perPage: 500 });
  const existing = list.data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    await service.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    return existing.id;
  }
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? `createUser failed: ${email}`);
  }
  return created.data.user.id;
}

async function upsertProfile(
  service: SupabaseClient<Database>,
  id: string,
  clinicId: string,
  role: AppRole,
  fullName: string,
) {
  const { data: existing } = await service
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from("profiles")
      .update({
        clinic_id: clinicId,
        role,
        full_name: fullName,
        is_active: true,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await service.from("profiles").insert({
      id,
      clinic_id: clinicId,
      role,
      full_name: fullName,
      is_active: true,
    });
    if (error) throw new Error(error.message);
  }
}

async function clearClinicData(
  service: SupabaseClient<Database>,
  clinicId: string,
) {
  const tables = [
    "payment_plan_installments",
    "payment_plans",
    "payments",
    "invoice_lines",
    "invoices",
    "invoice_number_counters",
    "crm_notifications",
    "outbound_messages",
    "consent_signatures",
    "appointment_waitlist",
    "appointments",
    "treatment_plan_items",
    "treatment_plans",
    "odontogram_events",
    "odontogram_teeth",
    "patient_allergies",
    "patient_documents",
    "patient_images",
    "expenses",
    "inventory_items",
    "patients",
    "services",
  ] as const;

  for (const table of tables) {
    const { error } = await service.from(table).delete().eq("clinic_id", clinicId);
    if (error) {
      console.warn(`clear ${table}:`, error.message);
    }
  }
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const service = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const { data: plan, error: planError } = await service
    .from("plans")
    .select("id")
    .eq("code", "professional")
    .single();
  if (planError || !plan) {
    throw new Error(planError?.message ?? "professional plan not found");
  }

  let clinicId: string | null = null;
  const { data: existingDemo } = await service
    .from("clinics")
    .select("id")
    .eq("is_demo", true)
    .maybeSingle();

  if (existingDemo) {
    clinicId = existingDemo.id;
    console.log("Reusing demo clinic", clinicId);
  } else {
    const { data: clinic, error: clinicError } = await service
      .from("clinics")
      .insert({
        name: DEMO_CLINIC_NAME,
        plan_id: plan.id,
        trial_ends_at: "2099-12-31T23:59:59+00:00",
        status: "readonly",
        is_demo: true,
        readonly_started_at: new Date().toISOString(),
        settings_json: {
          onboarding: { completed: true, step: 3 },
          doctors_see_peer_amounts: true,
          shared_pricelist_across_locations: true,
        } as Json,
      })
      .select("id")
      .single();
    if (clinicError || !clinic) {
      throw new Error(clinicError?.message ?? "clinic insert failed");
    }
    clinicId = clinic.id;
    console.log("Created demo clinic", clinicId);

    await service.from("clinic_subscriptions").insert({
      clinic_id: clinicId,
      plan_id: plan.id,
      status: "trial",
    });
  }

  await service
    .from("clinics")
    .update({
      status: "readonly",
      is_demo: true,
      name: DEMO_CLINIC_NAME,
      trial_ends_at: "2099-12-31T23:59:59+00:00",
      grace_ends_at: null,
      closure_reason: null,
      timezone: "Europe/Sarajevo",
      phone_country_default: "+387",
      readonly_started_at: new Date().toISOString(),
      settings_json: {
        onboarding: { completed: true, step: 3 },
        doctors_see_peer_amounts: true,
        shared_pricelist_across_locations: true,
      } as Json,
      branding_json: {
        display_name: "Demo Dental",
        tagline: "Vaš osmijeh — naša briga",
      } as Json,
    })
    .eq("id", clinicId);

  // Locations (max 2 on professional)
  const { data: locations } = await service
    .from("clinic_locations")
    .select("id, name")
    .eq("clinic_id", clinicId);

  let locationCentar =
    locations?.find((l) => l.name === "Centar")?.id ?? locations?.[0]?.id;
  let locationIlidza = locations?.find((l) => l.name === "Ilidža")?.id;

  if (!locationCentar) {
    const { data: loc, error } = await service
      .from("clinic_locations")
      .insert({
        clinic_id: clinicId,
        name: "Centar",
        address: "Ferhadija 15, 71000 Sarajevo",
      })
      .select("id")
      .single();
    if (error || !loc) throw new Error(error?.message ?? "location Centar failed");
    locationCentar = loc.id;
  } else {
    await service
      .from("clinic_locations")
      .update({ address: "Ferhadija 15, 71000 Sarajevo", is_active: true })
      .eq("id", locationCentar);
  }

  if (!locationIlidza && (locations?.length ?? 0) < 2) {
    const { data: loc, error } = await service
      .from("clinic_locations")
      .insert({
        clinic_id: clinicId,
        name: "Ilidža",
        address: "Butmirska cesta 10, 71210 Ilidža",
      })
      .select("id")
      .single();
    if (error || !loc) {
      console.warn("Ilidža location skipped:", error?.message);
    } else {
      locationIlidza = loc.id;
    }
  }

  // Primary demo login (doctor)
  const primaryUserId = await ensureAuthUser(
    service,
    DEMO_EMAIL,
    "Dr. Demo",
    DEMO_PASSWORD,
  );
  await upsertProfile(service, primaryUserId, clinicId, "doctor", "Dr. Demo");
  console.log("Demo login ready:", DEMO_EMAIL);

  const doctorIds: string[] = [primaryUserId];
  for (const member of STAFF) {
    const id = await ensureAuthUser(
      service,
      member.email,
      member.full_name,
      DEMO_PASSWORD,
    );
    await upsertProfile(service, id, clinicId, member.role, member.full_name);
    if (member.role === "doctor") doctorIds.push(id);
    console.log("Staff ready:", member.full_name, member.email);
  }

  const { count: patientCount } = await service
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  const needsSeed = REFRESH || (patientCount ?? 0) < 20;
  if (!needsSeed) {
    console.log(
      `\nDemo already has ${patientCount} patients — pass --refresh to replace data.`,
    );
    console.log(`  Clinic: ${DEMO_CLINIC_NAME} (${clinicId})`);
    console.log(`  Login:  ${DEMO_EMAIL}`);
    return;
  }

  if (REFRESH || (patientCount ?? 0) > 0) {
    console.log("Clearing existing demo operational data…");
    await clearClinicData(service, clinicId);
  }

  // Seed templates
  await service.rpc("seed_default_email_templates", { p_clinic_id: clinicId });
  await service.rpc("seed_default_consent_forms", { p_clinic_id: clinicId });

  // Services
  const { data: insertedServices, error: svcError } = await service
    .from("services")
    .insert(
      SERVICES.map((s) => ({
        clinic_id: clinicId!,
        name: s.name,
        code: s.code,
        duration_minutes: s.duration_minutes,
        price_eur: s.price_eur,
        vat_rate: s.vat_rate,
        is_active: true,
      })),
    )
    .select("id, name, code, duration_minutes, price_eur, vat_rate");
  if (svcError || !insertedServices?.length) {
    throw new Error(svcError?.message ?? "services insert failed");
  }
  console.log(`Services: ${insertedServices.length}`);

  const serviceByCode = new Map(insertedServices.map((s) => [s.code!, s]));

  // Patients
  const { data: insertedPatients, error: patError } = await service
    .from("patients")
    .insert(
      PATIENTS.map((p) => ({
        clinic_id: clinicId!,
        first_name: p.first_name,
        last_name: p.last_name,
        phone: p.phone,
        email: p.email,
        address: p.address,
        date_of_birth: p.date_of_birth,
        notes: p.notes
          ? `${p.notes} [porijeklo: ${p.origin}]`
          : `Pacijent — porijeklo: ${p.origin}`,
        medical_history: p.medical_history ?? null,
        next_control_at: p.next_control_at ?? null,
        is_active: true,
      })),
    )
    .select("id, first_name, last_name");
  if (patError || !insertedPatients?.length) {
    throw new Error(patError?.message ?? "patients insert failed");
  }
  console.log(`Patients: ${insertedPatients.length}`);

  // Allergies
  const allergyTargets = [
    { idx: 12, allergen: "Penicilin", severity: "severe" as AllergySeverity, notes: "Anafilaksa u anamnezi" },
    { idx: 1, allergen: "Lateks", severity: "moderate" as AllergySeverity, notes: null },
    { idx: 30, allergen: "Lidokain", severity: "mild" as AllergySeverity, notes: "Koristiti alternativu" },
    { idx: 40, allergen: "Aspirin", severity: "moderate" as AllergySeverity, notes: null },
    { idx: 4, allergen: "Nikkel", severity: "mild" as AllergySeverity, notes: "Ortodoncija" },
  ];
  await service.from("patient_allergies").insert(
    allergyTargets
      .filter((a) => insertedPatients[a.idx])
      .map((a) => ({
        clinic_id: clinicId!,
        patient_id: insertedPatients[a.idx]!.id,
        allergen: a.allergen,
        severity: a.severity,
        notes: a.notes,
      })),
  );

  // Inventory
  await service.from("inventory_items").insert(
    INVENTORY.map((i) => ({
      clinic_id: clinicId!,
      name: i.name,
      unit: i.unit,
      quantity: i.quantity,
      low_stock_threshold: i.low_stock_threshold,
      notes: i.notes ?? null,
      created_by: primaryUserId,
      is_active: true,
    })),
  );

  // Odontogram samples for first 8 patients
  const toothSamples: Array<{
    patientIdx: number;
    teeth: Array<{ fdi: number; status: ToothStatus; surfaces?: Json; notes?: string }>;
  }> = [
    {
      patientIdx: 0,
      teeth: [
        { fdi: 16, status: "caries", surfaces: { O: "caries", M: "healthy" } },
        { fdi: 26, status: "filled", surfaces: { O: "filled" } },
        { fdi: 36, status: "healthy" },
        { fdi: 46, status: "crown" },
      ],
    },
    {
      patientIdx: 3,
      teeth: [
        { fdi: 11, status: "healthy" },
        { fdi: 21, status: "filled", surfaces: { M: "filled" } },
        { fdi: 36, status: "missing" },
        { fdi: 46, status: "implant", notes: "Implant ugrađen 2025" },
        { fdi: 47, status: "root_canal" },
      ],
    },
    {
      patientIdx: 10,
      teeth: [
        { fdi: 14, status: "caries", surfaces: { D: "caries" } },
        { fdi: 24, status: "caries", surfaces: { O: "caries" } },
        { fdi: 37, status: "filled", surfaces: { O: "filled", D: "filled" } },
      ],
    },
    {
      patientIdx: 16,
      teeth: [
        { fdi: 18, status: "missing", notes: "Ekstrahiran mudnjak" },
        { fdi: 28, status: "other", notes: "Retinirani — praćenje" },
        { fdi: 38, status: "missing" },
        { fdi: 48, status: "healthy" },
      ],
    },
    {
      patientIdx: 28,
      teeth: [
        { fdi: 12, status: "bridge" },
        { fdi: 13, status: "bridge" },
        { fdi: 14, status: "bridge" },
        { fdi: 26, status: "crown" },
      ],
    },
  ];

  for (const sample of toothSamples) {
    const patient = insertedPatients[sample.patientIdx];
    if (!patient) continue;
    const { error } = await service.from("odontogram_teeth").insert(
      sample.teeth.map((t) => ({
        clinic_id: clinicId!,
        patient_id: patient.id,
        fdi_number: t.fdi,
        status: t.status,
        surfaces_json: t.surfaces ?? {},
        notes: t.notes ?? null,
        updated_by: primaryUserId,
      })),
    );
    if (error) console.warn("odontogram:", error.message);

    await service.from("odontogram_events").insert(
      sample.teeth.slice(0, 2).map((t, i) => ({
        clinic_id: clinicId!,
        patient_id: patient.id,
        fdi_number: t.fdi,
        event_type: t.status === "caries" ? "diagnosis" : "treatment",
        status_before: "healthy" as ToothStatus,
        status_after: t.status,
        note: `Demo zapis — ${t.status}`,
        recorded_by: doctorIds[i % doctorIds.length]!,
        created_at: atSarajevo(-14 - i, 11).toISOString(),
      })),
    );
  }

  // Treatment plans
  const plomba = serviceByCode.get("PLM");
  const higijena = serviceByCode.get("HIG");
  const implant = serviceByCode.get("IMP");
  const krunica = serviceByCode.get("KRU");
  const endo = serviceByCode.get("END2");

  const planDefs = [
    {
      patientIdx: 0,
      title: "Sanacija karijesa — Amina H.",
      notes: "Prioritet: 16 O, zatim higijena.",
      items: [
        { service: plomba, name: "Kompozitna plomba", fdi: 16, status: "planned" as const, price: 55, order: 1 },
        { service: higijena, name: "Profesionalna higijena", fdi: null, status: "in_progress" as const, price: 40, order: 2 },
      ],
    },
    {
      patientIdx: 3,
      title: "Implant + protetika — Haris K.",
      notes: "Faza 1 završena; čeka se osseointegracija.",
      items: [
        { service: implant, name: "Implant (ugradnja)", fdi: 36, status: "done" as const, price: 650, order: 1 },
        { service: krunica, name: "Krunica (cirkon)", fdi: 36, status: "planned" as const, price: 320, order: 2 },
      ],
    },
    {
      patientIdx: 10,
      title: "Endodoncija + restauracija — Sophie M.",
      notes: "Bol na 14 — hitno.",
      items: [
        { service: endo, name: "Endodoncija (višekanalni)", fdi: 14, status: "in_progress" as const, price: 180, order: 1 },
        { service: plomba, name: "Kompozitna plomba", fdi: 14, status: "planned" as const, price: 55, order: 2 },
      ],
    },
  ];

  for (const def of planDefs) {
    const patient = insertedPatients[def.patientIdx];
    if (!patient) continue;
    const { data: tp, error } = await service
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        title: def.title,
        notes: def.notes,
        is_active: true,
        created_by: primaryUserId,
      })
      .select("id")
      .single();
    if (error || !tp) {
      console.warn("treatment plan:", error?.message);
      continue;
    }
    await service.from("treatment_plan_items").insert(
      def.items.map((item) => ({
        clinic_id: clinicId!,
        treatment_plan_id: tp.id,
        service_id: item.service?.id ?? null,
        service_name: item.name,
        fdi_number: item.fdi,
        status: item.status,
        estimated_price_eur: item.price,
        sort_order: item.order,
      })),
    );
  }

  // Appointments — past 10 workdays + next 10, no doctor overlaps
  const apptStatuses: AppointmentStatus[] = [
    "completed",
    "completed",
    "completed",
    "confirmed",
    "confirmed",
    "pending_confirmation",
    "cancelled",
    "no_show",
    "confirmed",
    "completed",
  ];
  const serviceCodes = [
    "PRG", "HIG", "PLM", "KON", "VAD", "END1", "BIJ", "HIT", "ORT", "OPG",
    "KRU", "PAR", "ULT", "PED", "RTG", "HIR", "AMZ", "IMP",
  ];

  type ApptRow = {
    clinic_id: string;
    location_id: string;
    patient_id: string;
    doctor_id: string;
    service_id: string;
    starts_at: string;
    ends_at: string;
    status: AppointmentStatus;
    notes: string | null;
    created_by: string;
  };

  const appointments: ApptRow[] = [];
  // Slot bookkeeping per doctor: dayOffset -> list of [startMin, endMin]
  const busy = new Map<string, Map<number, Array<[number, number]>>>();

  function canBook(doctorId: string, day: number, startMin: number, endMin: number) {
    const byDay = busy.get(doctorId) ?? new Map();
    const slots = byDay.get(day) ?? [];
    return !slots.some(([s, e]) => startMin < e && endMin > s);
  }
  function markBusy(doctorId: string, day: number, startMin: number, endMin: number) {
    if (!busy.has(doctorId)) busy.set(doctorId, new Map());
    const byDay = busy.get(doctorId)!;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push([startMin, endMin]);
  }

  // Past week (Mon-Fri of previous weeks) + this week + next week
  const dayOffsets = [
    -11, -10, -9, -8, -7, -4, -3, -2, -1, 0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 14,
  ];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  let apptIndex = 0;
  for (const day of dayOffsets) {
    // Skip weekends relative to 2026-08-04 (Tue)
    const d = atSarajevo(day, 12);
    const weekday = d.getDay(); // 0 Sun
    if (weekday === 0 || weekday === 6) continue;

    const slotsPerDay = day === 0 ? 6 : 4;
    for (let s = 0; s < slotsPerDay; s++) {
      const doctorId = doctorIds[apptIndex % doctorIds.length]!;
      const patient = insertedPatients[apptIndex % insertedPatients.length]!;
      const svc =
        serviceByCode.get(serviceCodes[apptIndex % serviceCodes.length]!) ??
        insertedServices[0]!;
      const hour = hours[s % hours.length]!;
      const startMin = hour * 60;
      const duration = svc.duration_minutes ?? 30;
      const endMin = startMin + duration;
      if (!canBook(doctorId, day, startMin, endMin)) continue;
      markBusy(doctorId, day, startMin, endMin);

      const starts = atSarajevo(day, hour, 0);
      const ends = new Date(starts.getTime() + duration * 60_000);
      const status: AppointmentStatus =
        day < 0
          ? apptStatuses[apptIndex % apptStatuses.length]! === "confirmed"
            ? "completed"
            : apptStatuses[apptIndex % apptStatuses.length]!
          : day === 0
            ? s < 2
              ? "completed"
              : "confirmed"
            : apptStatuses[(apptIndex + 3) % apptStatuses.length]!;

      const loc =
        locationIlidza && apptIndex % 5 === 0 ? locationIlidza : locationCentar!;

      appointments.push({
        clinic_id: clinicId!,
        location_id: loc,
        patient_id: patient.id,
        doctor_id: doctorId,
        service_id: svc.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status,
        notes:
          status === "cancelled"
            ? "Pacijent otkazao — porodične obaveze"
            : status === "no_show"
              ? "Nije se pojavio; SMS podsjetnik poslan"
              : null,
        created_by: primaryUserId,
      });
      apptIndex++;
    }
  }

  const { error: apptError } = await service.from("appointments").insert(appointments);
  if (apptError) {
    console.warn("appointments seed:", apptError.message);
  } else {
    console.log(`Appointments: ${appointments.length}`);
  }

  // Waitlist
  const waitlistPatients = [5, 15, 22, 35, 42]
    .map((i) => insertedPatients[i])
    .filter(Boolean);
  await service.from("appointment_waitlist").insert(
    waitlistPatients.map((p, i) => ({
      clinic_id: clinicId!,
      patient_id: p!.id,
      doctor_id: doctorIds[i % doctorIds.length]!,
      service_id: (serviceByCode.get(i % 2 === 0 ? "HIG" : "PLM") ?? insertedServices[0]!).id,
      location_id: locationCentar!,
      preferred_from: "2026-08-05",
      preferred_to: "2026-08-22",
      notes: i === 0 ? "Želi jutarnji termin" : i === 2 ? "Hitno — bol" : null,
      status: "waiting" as const,
      priority: i === 2 ? 10 : i,
      created_by: primaryUserId,
    })),
  );

  // Invoices + payments
  const vatFraction = 0.17;
  type InvDef = {
    patientIdx: number;
    series: number;
    status: InvoiceStatus;
    lines: Array<{ code: string; qty: number }>;
    method?: PaymentMethod;
    partialAmount?: number;
    issuedDaysAgo: number;
    notes?: string;
  };

  const invDefs: InvDef[] = [
    {
      patientIdx: 0,
      series: 1,
      status: "paid",
      lines: [{ code: "HIG", qty: 1 }, { code: "PLM", qty: 1 }],
      method: "card",
      issuedDaysAgo: 12,
    },
    {
      patientIdx: 3,
      series: 2,
      status: "partial",
      lines: [{ code: "IMP", qty: 1 }],
      method: "bank_transfer",
      partialAmount: 300,
      issuedDaysAgo: 20,
      notes: "Akontacija za implant",
    },
    {
      patientIdx: 10,
      series: 3,
      status: "unpaid",
      lines: [{ code: "END2", qty: 1 }, { code: "RTG", qty: 1 }],
      issuedDaysAgo: 3,
    },
    {
      patientIdx: 16,
      series: 4,
      status: "paid",
      lines: [{ code: "BIJ", qty: 1 }],
      method: "cash",
      issuedDaysAgo: 8,
    },
    {
      patientIdx: 7,
      series: 5,
      status: "paid",
      lines: [{ code: "PRG", qty: 1 }, { code: "OPG", qty: 1 }],
      method: "card",
      issuedDaysAgo: 15,
    },
    {
      patientIdx: 28,
      series: 6,
      status: "paid",
      lines: [{ code: "KRU", qty: 1 }],
      method: "bank_transfer",
      issuedDaysAgo: 25,
    },
    {
      patientIdx: 35,
      series: 7,
      status: "unpaid",
      lines: [{ code: "PAR", qty: 1 }, { code: "HIG", qty: 1 }],
      issuedDaysAgo: 1,
    },
    {
      patientIdx: 42,
      series: 8,
      status: "void",
      lines: [{ code: "HIT", qty: 1 }],
      issuedDaysAgo: 18,
      notes: "Greška u izdavanju — poništeno",
    },
    {
      patientIdx: 12,
      series: 9,
      status: "paid",
      lines: [{ code: "ULT", qty: 1 }, { code: "KON", qty: 1 }],
      method: "card",
      issuedDaysAgo: 6,
    },
    {
      patientIdx: 22,
      series: 10,
      status: "partial",
      lines: [{ code: "MST", qty: 2 }],
      method: "cash",
      partialAmount: 200,
      issuedDaysAgo: 30,
      notes: "Plan rata — most",
    },
  ];

  await service.from("invoice_number_counters").upsert({
    clinic_id: clinicId,
    series_year: 2026,
    last_number: invDefs.length,
  });

  for (const def of invDefs) {
    const patient = insertedPatients[def.patientIdx];
    if (!patient) continue;

    const lineRows = def.lines.map((line, i) => {
      const svc = serviceByCode.get(line.code) ?? insertedServices[0]!;
      const unit = Number(svc.price_eur);
      const lineTotal = money(unit * line.qty);
      return {
        clinic_id: clinicId!,
        service_id: svc.id,
        description: svc.name,
        quantity: line.qty,
        unit_price: unit,
        vat_rate: vatFraction,
        line_total: lineTotal,
        sort_order: i + 1,
      };
    });

    const subtotal = money(lineRows.reduce((s, l) => s + l.line_total, 0));
    const vatAmount = money(subtotal * vatFraction);
    const total = money(subtotal + vatAmount);
    const doctorId = doctorIds[def.series % doctorIds.length]!;

    const { data: inv, error: invError } = await service
      .from("invoices")
      .insert({
        clinic_id: clinicId,
        patient_id: patient.id,
        location_id: locationCentar!,
        doctor_id: doctorId,
        series_year: 2026,
        series_number: def.series,
        status: def.status === "void" ? "void" : def.status,
        subtotal_amount: subtotal,
        vat_amount: vatAmount,
        total_amount: total,
        currency: "EUR",
        notes: def.notes ?? null,
        issued_by: primaryUserId,
        issued_at: atSarajevo(-def.issuedDaysAgo, 14).toISOString(),
        voided_at:
          def.status === "void"
            ? atSarajevo(-def.issuedDaysAgo + 1, 10).toISOString()
            : null,
        voided_reason: def.status === "void" ? def.notes ?? "Poništeno" : null,
      })
      .select("id")
      .single();

    if (invError || !inv) {
      console.warn("invoice:", invError?.message);
      continue;
    }

    await service.from("invoice_lines").insert(
      lineRows.map((l) => ({ ...l, invoice_id: inv.id })),
    );

    if (def.status === "paid" && def.method) {
      await service.from("payments").insert({
        clinic_id: clinicId,
        invoice_id: inv.id,
        amount: total,
        method: def.method,
        paid_at: atSarajevo(-def.issuedDaysAgo, 15).toISOString(),
        recorded_by: primaryUserId,
        note: "Demo uplata",
      });
    } else if (def.status === "partial" && def.method && def.partialAmount) {
      await service.from("payments").insert({
        clinic_id: clinicId,
        invoice_id: inv.id,
        amount: def.partialAmount,
        method: def.method,
        paid_at: atSarajevo(-def.issuedDaysAgo, 15).toISOString(),
        recorded_by: primaryUserId,
        note: "Djelomična uplata",
      });

      if (def.series === 2 || def.series === 10) {
        const remaining = money(total - def.partialAmount);
        const { data: pp } = await service
          .from("payment_plans")
          .insert({
            clinic_id: clinicId,
            invoice_id: inv.id,
            patient_id: patient.id,
            total_amount: remaining,
            installment_count: 3,
            status: "active",
            notes: "Demo plan rata",
            created_by: primaryUserId,
          })
          .select("id")
          .single();
        if (pp) {
          const installment = money(remaining / 3);
          const dueDates = ["2026-09-15", "2026-10-15", "2026-11-15"];
          await service.from("payment_plan_installments").insert(
            [1, 2, 3].map((n) => ({
              clinic_id: clinicId!,
              payment_plan_id: pp.id,
              sequence_number: n,
              due_date: dueDates[n - 1]!,
              amount: n === 3 ? money(remaining - installment * 2) : installment,
              status: "pending" as const,
            })),
          );
        }
      }
    }
  }
  console.log(`Invoices: ${invDefs.length}`);

  // Expenses
  const expenseRows: Array<{
    category: ExpenseCategory;
    description: string;
    amount: number;
    expense_date: string;
    vendor: string;
  }> = [
    { category: "rent", description: "Najam prostora — Centar", amount: 1200, expense_date: "2026-07-01", vendor: "ImoCentar d.o.o." },
    { category: "rent", description: "Najam — Ilidža", amount: 650, expense_date: "2026-07-01", vendor: "Ilidža Properties" },
    { category: "supplies", description: "Stomatološki materijal — mjesečna nabavka", amount: 480, expense_date: "2026-07-15", vendor: "DentalTrade BA" },
    { category: "lab", description: "Laboratorij — krunice i mostovi", amount: 920, expense_date: "2026-07-22", vendor: "ProDent Lab" },
    { category: "utilities", description: "Struja i grijanje", amount: 210, expense_date: "2026-07-28", vendor: "Elektroprivreda" },
    { category: "salaries", description: "Plate — juli 2026", amount: 4800, expense_date: "2026-07-31", vendor: "Interno" },
    { category: "equipment", description: "Servis autoklava", amount: 150, expense_date: "2026-07-10", vendor: "MedServis" },
    { category: "marketing", description: "Google Ads — lokalni", amount: 180, expense_date: "2026-07-05", vendor: "Google" },
    { category: "supplies", description: "Rukavice i maske", amount: 95, expense_date: "2026-08-01", vendor: "MedSupply" },
    { category: "other", description: "Održavanje softvera / IT", amount: 60, expense_date: "2026-08-02", vendor: "IT Partner" },
  ];

  await service.from("expenses").insert(
    expenseRows.map((e) => ({
      clinic_id: clinicId!,
      category: e.category,
      description: e.description,
      amount: e.amount,
      currency: "EUR",
      expense_date: e.expense_date,
      vendor: e.vendor,
      recorded_by: primaryUserId,
    })),
  );

  // CRM notifications (open)
  const crmPatients = insertedPatients.filter((_, i) => PATIENTS[i]?.next_control_at);
  if (crmPatients.length) {
    await service.from("crm_notifications").insert(
      crmPatients.slice(0, 6).map((p, i) => ({
        clinic_id: clinicId!,
        patient_id: p.id,
        kind: (i % 3 === 0 ? "birthday" : i % 3 === 1 ? "recall" : "control") as
          | "birthday"
          | "recall"
          | "control",
        due_on: PATIENTS.find(
          (x) =>
            x.first_name === p.first_name && x.last_name === p.last_name,
        )?.next_control_at ?? "2026-08-15",
        status: "open" as const,
      })),
    );
  }

  // Sample outbound reminder
  const firstApptPatient = insertedPatients[0]!;
  await service.from("outbound_messages").insert({
    clinic_id: clinicId,
    channel: "email",
    template_key: "appointment_reminder",
    locale: "bs",
    to_address: PATIENTS[0]!.email,
    subject: "Podsjetnik na termin — Demo Dental",
    status: "sent",
    patient_id: firstApptPatient.id,
    sent_by: primaryUserId,
    sent_at: atSarajevo(-1, 9).toISOString(),
    is_test: true,
  });

  console.log("\nDemo clinic ready (rich seed).");
  console.log(`  Clinic: ${DEMO_CLINIC_NAME} (${clinicId})`);
  console.log(`  Patients: ${insertedPatients.length} (multi-national)`);
  console.log(`  Services: ${insertedServices.length}`);
  console.log(`  Appointments: ${appointments.length}`);
  console.log(`  Doctors: ${doctorIds.length}`);
  console.log(`  Login:  ${DEMO_EMAIL}`);
  console.log(`  Pass:   (DEMO_CLINIC_PASSWORD or default)`);
  console.log(
    "\nStaff (same password as demo):\n" +
      STAFF.map((s) => `  ${s.role.padEnd(10)} ${s.email} — ${s.full_name}`).join(
        "\n",
      ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
