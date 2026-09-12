"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type DeleteReservationState = Readonly<{ message: string | null }>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const genericErrorMessage = "Impossibile eliminare la prenotazione. Riprova.";

export async function deleteTableReservationAction(
  reservationId: string,
  previousState: DeleteReservationState,
  formData: FormData,
): Promise<DeleteReservationState> {
  void previousState;
  void formData;
  await requireAdmin();

  if (!uuidPattern.test(reservationId)) {
    return { message: genericErrorMessage };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: result, error } = await supabase.rpc(
      "delete_table_reservation",
      { p_reservation_id: reservationId },
    );

    if (error || typeof result !== "string") {
      return { message: genericErrorMessage };
    }
    if (result === "access_denied") {
      return { message: "Non hai i permessi per eliminare questa prenotazione." };
    }
    if (result === "invalid_id") {
      return { message: "Identificativo della prenotazione non valido." };
    }
    if (result === "not_found") {
      return { message: "La prenotazione non è più disponibile." };
    }
    if (result !== "deleted") {
      return { message: genericErrorMessage };
    }
  } catch {
    return { message: genericErrorMessage };
  }

  revalidatePath("/admin/prenotazioni");
  redirect("/admin/prenotazioni");
}
