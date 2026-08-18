"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  getAllowedAdminOrderTransitions,
  isAdminOrderStatus,
  isAdminOrderTargetStatus,
  isValidAdminOrderId,
} from "@/lib/orders/admin-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UpdateOrderStatusState = Readonly<{
  message: string | null;
}>;

const genericErrorMessage = "Impossibile aggiornare lo stato. Riprova.";
const invalidTransitionMessage = "Transizione di stato non consentita.";
const concurrentUpdateMessage =
  "Lo stato dell’ordine è cambiato. Aggiorna la pagina e riprova.";

export async function updateOrderStatusAction(
  orderId: string,
  _previousState: UpdateOrderStatusState,
  formData: FormData,
): Promise<UpdateOrderStatusState> {
  await requireAdmin();

  const rawTargetStatus = formData.get("targetStatus");
  const rawExpectedCurrentStatus = formData.get("expectedCurrentStatus");

  if (
    !isValidAdminOrderId(orderId) ||
    typeof rawTargetStatus !== "string" ||
    !isAdminOrderTargetStatus(rawTargetStatus) ||
    typeof rawExpectedCurrentStatus !== "string" ||
    !isAdminOrderStatus(rawExpectedCurrentStatus)
  ) {
    return { message: invalidTransitionMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: currentOrder, error: readError } = await supabase
      .from("orders")
      .select("status, fulfillment_type")
      .eq("id", orderId)
      .maybeSingle();

    if (readError || !currentOrder) {
      return { message: genericErrorMessage };
    }

    const currentStatus = currentOrder.status;
    const fulfillmentType = currentOrder.fulfillment_type;

    if (
      typeof currentStatus !== "string" ||
      typeof fulfillmentType !== "string" ||
      !isAdminOrderStatus(currentStatus)
    ) {
      return { message: invalidTransitionMessage };
    }

    if (currentStatus !== rawExpectedCurrentStatus) {
      return { message: concurrentUpdateMessage };
    }

    const allowedTransitions = getAllowedAdminOrderTransitions(
      currentStatus,
      fulfillmentType,
    );

    if (!allowedTransitions.includes(rawTargetStatus)) {
      return { message: invalidTransitionMessage };
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({ status: rawTargetStatus })
      .eq("id", orderId)
      .eq("status", rawExpectedCurrentStatus)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { message: genericErrorMessage };
    }

    if (updatedOrder?.id !== orderId) {
      return { message: concurrentUpdateMessage };
    }
  } catch {
    return { message: genericErrorMessage };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ordini");
  revalidatePath(`/admin/ordini/${orderId}`);
  redirect(`/admin/ordini/${orderId}`);
}
