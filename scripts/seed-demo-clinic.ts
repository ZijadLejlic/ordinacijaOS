/**
 * Seed (or refresh) the marketing live demo clinic (W8 / Website §4.6).
 *
 * Usage:
 *   npx tsx scripts/seed-demo-clinic.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 * Optional: DEMO_CLINIC_EMAIL / DEMO_CLINIC_PASSWORD (defaults below).
 *
 * Creates one doctor user + readonly Demo Dental clinic with sample BS data.
 * Idempotent: reuses existing is_demo clinic / demo email when present.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/supabase/database.types";

const DEMO_EMAIL =
  process.env.DEMO_CLINIC_EMAIL?.trim() || "demo@dentord.com";
const DEMO_PASSWORD =
  process.env.DEMO_CLINIC_PASSWORD?.trim() || "DemoDental-2026!";
const DEMO_CLINIC_NAME = "Demo Dental";

const PATIENT_NAMES = [
  "Amina Hodžić",
  "Emir Begić",
  "Lejla Softić",
  "Haris Kovačević",
  "Sara Delić",
  "Adnan Mujić",
  "Maja Petrović",
  "Kenan Halilović",
  "Ivana Marković",
  "Damir Jusić",
] as const;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const service = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
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

    await service.from("clinic_locations").insert({
      clinic_id: clinicId,
      name: "Centar",
    });
  }

  // Ensure readonly + is_demo flags stay set
  await service
    .from("clinics")
    .update({
      status: "readonly",
      is_demo: true,
      name: DEMO_CLINIC_NAME,
      trial_ends_at: "2099-12-31T23:59:59+00:00",
      grace_ends_at: null,
      closure_reason: null,
      readonly_started_at: new Date().toISOString(),
    })
    .eq("id", clinicId);

  const { data: location } = await service
    .from("clinic_locations")
    .select("id")
    .eq("clinic_id", clinicId)
    .limit(1)
    .maybeSingle();

  let locationId = location?.id;
  if (!locationId) {
    const { data: loc, error: locError } = await service
      .from("clinic_locations")
      .insert({
        clinic_id: clinicId,
        name: "Centar",
      })
      .select("id")
      .single();
    if (locError || !loc) {
      throw new Error(locError?.message ?? "location insert failed");
    }
    locationId = loc.id;
  }

  // Auth user
  const list = await service.auth.admin.listUsers({ perPage: 200 });
  let userId =
    list.data.users.find(
      (u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase(),
    )?.id ?? null;

  if (!userId) {
    const created = await service.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Dr. Demo" },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "createUser failed");
    }
    userId = created.data.user.id;
    console.log("Created demo user", DEMO_EMAIL);
  } else {
    await service.auth.admin.updateUserById(userId, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    console.log("Updated demo user password", DEMO_EMAIL);
  }

  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    await service
      .from("profiles")
      .update({
        clinic_id: clinicId,
        role: "doctor",
        full_name: "Dr. Demo",
        is_active: true,
      })
      .eq("id", userId);
  } else {
    const { error: profileError } = await service.from("profiles").insert({
      id: userId,
      clinic_id: clinicId,
      role: "doctor",
      full_name: "Dr. Demo",
      is_active: true,
    });
    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  // Services
  const { count: serviceCount } = await service
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if ((serviceCount ?? 0) === 0) {
    await service.from("services").insert([
      {
        clinic_id: clinicId,
        name: "Kontrola",
        duration_minutes: 20,
        price_eur: 25,
        vat_rate: 17,
      },
      {
        clinic_id: clinicId,
        name: "Plomba",
        duration_minutes: 40,
        price_eur: 45,
        vat_rate: 17,
      },
      {
        clinic_id: clinicId,
        name: "Higijena",
        duration_minutes: 45,
        price_eur: 35,
        vat_rate: 17,
      },
      {
        clinic_id: clinicId,
        name: "Vađenje",
        duration_minutes: 30,
        price_eur: 55,
        vat_rate: 17,
      },
    ]);
  }

  const { data: services } = await service
    .from("services")
    .select("id, name")
    .eq("clinic_id", clinicId);

  // Patients
  const { count: patientCount } = await service
    .from("patients")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if ((patientCount ?? 0) === 0) {
    const rows = PATIENT_NAMES.map((fullName, i) => {
      const [first_name, ...rest] = fullName.split(" ");
      return {
        clinic_id: clinicId!,
        first_name: first_name!,
        last_name: rest.join(" ") || first_name!,
        phone: `+38761${String(100000 + i).slice(0, 6)}`,
        email: `${first_name!.toLowerCase()}@example.ba`,
        is_active: true,
      };
    });
    await service.from("patients").insert(rows);
  }

  const { data: patients } = await service
    .from("patients")
    .select("id, first_name, last_name")
    .eq("clinic_id", clinicId)
    .limit(10);

  // Appointments this week
  const { count: apptCount } = await service
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if ((apptCount ?? 0) === 0 && patients?.length && services?.length) {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(9, 0, 0, 0);
    const inserts = patients.slice(0, 6).map((p, i) => {
      const start = new Date(dayStart);
      start.setDate(start.getDate() + (i % 5));
      start.setHours(9 + i, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      return {
        clinic_id: clinicId!,
        location_id: locationId!,
        patient_id: p.id,
        doctor_id: userId!,
        service_id: services[i % services.length]!.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed" as const,
      };
    });
    const { error: apptError } = await service
      .from("appointments")
      .insert(inserts);
    if (apptError) {
      console.warn("appointments seed skipped:", apptError.message);
    }
  }

  // Inventory sample
  const { count: invCount } = await service
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);

  if ((invCount ?? 0) === 0) {
    await service.from("inventory_items").insert([
      {
        clinic_id: clinicId,
        name: "Kompozit A2",
        unit: "kom",
        quantity: 12,
        low_stock_threshold: 5,
      },
      {
        clinic_id: clinicId,
        name: "Anestezija",
        unit: "amp",
        quantity: 3,
        low_stock_threshold: 10,
      },
      {
        clinic_id: clinicId,
        name: "Rukavice M",
        unit: "kut",
        quantity: 8,
        low_stock_threshold: 2,
      },
    ]);
  }

  // Odontogram sample for first patient
  const firstPatient = patients?.[0];
  if (firstPatient) {
    const { count: toothCount } = await service
      .from("odontogram_teeth")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", firstPatient.id);

    if ((toothCount ?? 0) === 0) {
      const { error: toothError } = await service.from("odontogram_teeth").insert([
        {
          clinic_id: clinicId,
          patient_id: firstPatient.id,
          fdi_number: 16,
          status: "caries",
          surfaces_json: { O: "caries", M: "healthy" },
          updated_by: userId,
        },
        {
          clinic_id: clinicId,
          patient_id: firstPatient.id,
          fdi_number: 26,
          status: "filled",
          surfaces_json: { O: "filled" },
          updated_by: userId,
        },
        {
          clinic_id: clinicId,
          patient_id: firstPatient.id,
          fdi_number: 36,
          status: "healthy",
          surfaces_json: {},
          updated_by: userId,
        },
        {
          clinic_id: clinicId,
          patient_id: firstPatient.id,
          fdi_number: 46,
          status: "crown",
          surfaces_json: {},
          updated_by: userId,
        },
      ]);
      if (toothError) {
        console.warn("odontogram seed skipped:", toothError.message);
      }
    }

    const { count: planCount } = await service
      .from("treatment_plans")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    if ((planCount ?? 0) === 0) {
      const plomba = services?.find((s) => s.name === "Plomba");
      const higijena = services?.find((s) => s.name === "Higijena");
      const { data: plan, error: planError } = await service
        .from("treatment_plans")
        .insert({
          clinic_id: clinicId,
          patient_id: firstPatient.id,
          title: "Plan terapije — demonstracija",
          notes: "Primjer plana za marketing demo.",
          is_active: true,
          created_by: userId,
        })
        .select("id")
        .single();

      if (planError || !plan) {
        console.warn("treatment plan seed skipped:", planError?.message);
      } else {
        await service.from("treatment_plan_items").insert([
          {
            clinic_id: clinicId,
            treatment_plan_id: plan.id,
            service_id: plomba?.id ?? null,
            service_name: "Plomba",
            fdi_number: 16,
            status: "planned",
            estimated_price_eur: 45,
            sort_order: 1,
          },
          {
            clinic_id: clinicId,
            treatment_plan_id: plan.id,
            service_id: higijena?.id ?? null,
            service_name: "Higijena",
            fdi_number: null,
            status: "in_progress",
            estimated_price_eur: 35,
            sort_order: 2,
          },
        ]);
      }
    }
  }

  console.log("\nDemo clinic ready.");
  console.log(`  Clinic: ${DEMO_CLINIC_NAME} (${clinicId})`);
  console.log(`  Login:  ${DEMO_EMAIL}`);
  console.log(`  Pass:   (from DEMO_CLINIC_PASSWORD or default)`);
  console.log(
    "\nSet in .env.local:\n  DEMO_CLINIC_EMAIL=" +
      DEMO_EMAIL +
      "\n  DEMO_CLINIC_PASSWORD=<password>",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
