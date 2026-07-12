"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import {
  clearOperatorCookie,
  setOperatorCookie,
} from "@/lib/operators/session";
import { createClient } from "@/lib/supabase/server";
import {
  createOperatorSchema,
  setOperatorActiveSchema,
  switchOperatorSchema,
  updateOperatorPinSchema,
} from "@/lib/validations/operator";

export type OperatorActionState = {
  error?: string;
  message?: string;
} | null;

function mapRpcError(message: string | undefined): string {
  const raw = (message ?? "").toLowerCase();
  if (raw.includes("forbidden")) return "forbidden";
  if (raw.includes("unauthorized")) return "unauthorized";
  if (raw.includes("invalid_pin")) return "invalidPin";
  if (raw.includes("invalid_name")) return "invalid";
  if (raw.includes("invalid_profile")) return "invalidProfile";
  if (raw.includes("pin_taken")) return "pinTaken";
  if (raw.includes("not_found")) return "notFound";
  if (raw.includes("locked")) return "locked";
  return message ?? "failed";
}

export async function createOperatorAction(
  _prev: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const parsed = createOperatorSchema.safeParse({
    profileId: formData.get("profileId"),
    displayName: formData.get("displayName"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_clinic_operator", {
    p_profile_id: parsed.data.profileId,
    p_display_name: parsed.data.displayName,
    p_pin: parsed.data.pin,
  });

  if (error) {
    return { error: mapRpcError(error.message) };
  }

  revalidatePath("/settings/users");
  return { message: "operatorCreated" };
}

export async function updateOperatorPinAction(
  _prev: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const parsed = updateOperatorPinSchema.safeParse({
    operatorId: formData.get("operatorId"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_clinic_operator_pin", {
    p_operator_id: parsed.data.operatorId,
    p_pin: parsed.data.pin,
  });

  if (error) {
    return { error: mapRpcError(error.message) };
  }

  revalidatePath("/settings/users");
  return { message: "pinUpdated" };
}

export async function setOperatorActiveAction(
  operatorId: string,
  isActive: boolean,
): Promise<OperatorActionState> {
  const parsed = setOperatorActiveSchema.safeParse({ operatorId, isActive });
  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_clinic_operator_active", {
    p_operator_id: parsed.data.operatorId,
    p_is_active: parsed.data.isActive,
  });

  if (error) {
    return { error: mapRpcError(error.message) };
  }

  revalidatePath("/settings/users");
  return {
    message: isActive ? "operatorReactivated" : "operatorDeactivated",
  };
}

export async function switchOperatorAction(
  _prev: OperatorActionState,
  formData: FormData,
): Promise<OperatorActionState> {
  const parsed = switchOperatorSchema.safeParse({
    operatorId: formData.get("operatorId"),
    pin: formData.get("pin"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const locale = await getLocale();

  const { data, error } = await supabase.rpc("verify_operator_pin", {
    p_operator_id: parsed.data.operatorId,
    p_pin: parsed.data.pin,
  });

  if (error) {
    return { error: mapRpcError(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.operator_id) {
    return { error: "invalidPin" };
  }

  await setOperatorCookie(row.operator_id);
  redirect({ href: "/dashboard", locale });
  return null;
}

export async function clearOperatorSessionAction() {
  const locale = await getLocale();
  await clearOperatorCookie();
  redirect({ href: "/pin", locale });
}
