"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrderAccess } from "@/lib/auth/authorization";
import {
  isAdminOrderStatus,
  isAdminOrderTargetStatus,
  isValidAdminOrderId,
} from "@/lib/orders/admin-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UpdateOrderStatusState = Readonly<{
  message: string | null;
}>;

export type DeleteOrderState = Readonly<{
  message: string | null;
}>;

const genericErrorMessage = "Impossibile aggiornare lo stato. Riprova.";
const invalidTransitionMessage = "Transizione di stato non consentita.";
const concurrentUpdateMessage =
  "Lo stato dell’ordine è cambiato. Aggiorna la pagina e riprova.";
const genericDeleteErrorMessage = "Impossibile eliminare l’ordine. Riprova.";

export async function updateOrderStatusAction(
  orderId: string,
  _previousState: UpdateOrderStatusState,
  formData: FormData,
): Promise<UpdateOrderStatusState> {
  await requireOrderAccess();

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
    const { data: result, error: updateError } = await supabase.rpc(
      "update_order_status",
      {
        p_order_id: orderId,
        p_expected_status: rawExpectedCurrentStatus,
        p_target_status: rawTargetStatus,
      },
    );

    if (updateError || typeof result !== "string") {
      return { message: genericErrorMessage };
    }

    if (result === "conflict") {
      return { message: concurrentUpdateMessage };
    }

    if (result === "invalid_transition") {
      return { message: invalidTransitionMessage };
    }

    if (result !== "updated") {
      return { message: genericErrorMessage };
    }
  } catch {
    return { message: genericErrorMessage };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ordini");
  revalidatePath(`/admin/ordini/${orderId}`);
  redirect(`/admin/ordini/${orderId}`);
}

export async function deleteOrderAction(
  orderId: string,
  previousState: DeleteOrderState,
  formData: FormData,
): Promise<DeleteOrderState> {
  void previousState;
  void formData;
  await requireOrderAccess();

  if (!isValidAdminOrderId(orderId)) {
    return { message: genericDeleteErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: result, error: deleteError } = await supabase.rpc(
      "delete_order",
      { p_order_id: orderId },
    );

    if (deleteError || typeof result !== "string") {
      return { message: genericDeleteErrorMessage };
    }

    if (result === "access_denied") {
      return { message: "Non hai i permessi per eliminare questo ordine." };
    }

    if (result === "not_found") {
      return { message: "L’ordine non è più disponibile." };
    }

    if (result !== "deleted") {
      return { message: genericDeleteErrorMessage };
    }
  } catch {
    return { message: genericDeleteErrorMessage };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/ordini");
  revalidatePath(`/admin/ordini/${orderId}`);
  redirect("/admin/ordini");
}
