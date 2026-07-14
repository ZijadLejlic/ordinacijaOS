"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { writeAuditEvent } from "@/lib/audit/log";
import { getClinicWriteBlock } from "@/lib/clinic/writable";
import { assertFeature } from "@/lib/entitlements";
import { canWriteInventory } from "@/lib/inventory/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  adjustInventoryQtySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
} from "@/lib/validations/inventory";

export type InventoryActionState = {
  error?: string;
  message?: string;
} | null;

type ProfileRow = {
  id: string;
  clinic_id: string;
  role: Parameters<typeof canWriteInventory>[0];
  is_active: boolean;
};

async function requireInventoryWriter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "unauthorized" as const,
      supabase,
      user: null,
      profile: null as ProfileRow | null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, clinic_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !canWriteInventory(profile.role)) {
    return { error: "forbidden" as const, supabase, user, profile: null };
  }

  const writeBlock = await getClinicWriteBlock(supabase, profile.clinic_id);
  if (writeBlock) {
    return { error: writeBlock, supabase, user, profile: profile as ProfileRow };
  }

  return { error: null, supabase, user, profile: profile as ProfileRow };
}

function revalidateInventory(locale: string) {
  revalidatePath(`/${locale}/inventory`);
}

export async function createInventoryItemAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const parsed = createInventoryItemSchema.safeParse({
    name: formData.get("name"),
    unit: formData.get("unit"),
    quantity: formData.get("quantity"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireInventoryWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "inventory_basic",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  const { data, error: insertError } = await supabase
    .from("inventory_items")
    .insert({
      clinic_id: profile.clinic_id,
      name: parsed.data.name,
      unit: parsed.data.unit,
      quantity: parsed.data.quantity,
      low_stock_threshold: parsed.data.lowStockThreshold,
      notes,
      created_by: profile.id,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !data) return { error: "createFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "inventory_item.created",
    payload: { item_id: data.id },
  });

  const locale = await getLocale();
  revalidateInventory(locale);
  return { message: "created" };
}

export async function updateInventoryItemAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const parsed = updateInventoryItemSchema.safeParse({
    itemId: formData.get("itemId"),
    name: formData.get("name"),
    unit: formData.get("unit"),
    quantity: formData.get("quantity"),
    lowStockThreshold: formData.get("lowStockThreshold"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireInventoryWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "inventory_basic",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const notes = parsed.data.notes?.trim() ? parsed.data.notes.trim() : null;

  const { data, error: updateError } = await supabase
    .from("inventory_items")
    .update({
      name: parsed.data.name,
      unit: parsed.data.unit,
      quantity: parsed.data.quantity,
      low_stock_threshold: parsed.data.lowStockThreshold,
      notes,
    })
    .eq("id", parsed.data.itemId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (updateError || !data) {
    return { error: updateError ? "saveFailed" : "itemNotFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "inventory_item.updated",
    payload: { item_id: data.id },
  });

  const locale = await getLocale();
  revalidateInventory(locale);
  return { message: "saved" };
}

export async function adjustInventoryQtyAction(
  itemId: string,
  delta: number,
): Promise<InventoryActionState> {
  const parsed = adjustInventoryQtySchema.safeParse({ itemId, delta });
  if (!parsed.success) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireInventoryWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "inventory_basic",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const { data: existing } = await supabase
    .from("inventory_items")
    .select("id, quantity")
    .eq("id", parsed.data.itemId)
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle();

  if (!existing) return { error: "itemNotFound" };

  const nextQty = Number(existing.quantity) + parsed.data.delta;
  if (nextQty < 0) return { error: "insufficientStock" };

  const { data, error: updateError } = await supabase
    .from("inventory_items")
    .update({ quantity: nextQty })
    .eq("id", parsed.data.itemId)
    .eq("clinic_id", profile.clinic_id)
    .select("id, quantity")
    .maybeSingle();

  if (updateError || !data) return { error: "saveFailed" };

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: "inventory_item.qty_adjusted",
    payload: {
      item_id: data.id,
      delta: parsed.data.delta,
      new_quantity: Number(data.quantity),
    },
  });

  const locale = await getLocale();
  revalidateInventory(locale);
  return { message: "adjusted" };
}

export async function setInventoryItemActiveAction(
  itemId: string,
  isActive: boolean,
): Promise<InventoryActionState> {
  if (!itemId) return { error: "invalid" };

  const { error, supabase, user, profile } = await requireInventoryWriter();
  if (error || !user || !profile) return { error: error ?? "unauthorized" };

  const feature = await assertFeature(
    supabase,
    profile.clinic_id,
    "inventory_basic",
  );
  if (!feature.ok) return { error: "featureDisabled" };

  const { data, error: updateError } = await supabase
    .from("inventory_items")
    .update({ is_active: isActive })
    .eq("id", itemId)
    .eq("clinic_id", profile.clinic_id)
    .select("id")
    .maybeSingle();

  if (updateError || !data) {
    return { error: updateError ? "saveFailed" : "itemNotFound" };
  }

  await writeAuditEvent(supabase, {
    clinicId: profile.clinic_id,
    actorUserId: user.id,
    eventName: isActive
      ? "inventory_item.activated"
      : "inventory_item.deactivated",
    payload: { item_id: data.id },
  });

  const locale = await getLocale();
  revalidateInventory(locale);
  return { message: isActive ? "activated" : "deactivated" };
}
