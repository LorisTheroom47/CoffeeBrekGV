"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { isValidUuid } from "@/lib/menu/menu-item-form";
import {
  isManagedMenuImagePath,
  MENU_IMAGE_MAX_BYTES,
  MENU_IMAGES_BUCKET,
} from "@/lib/menu/storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MenuItemImageState = Readonly<{
  status: "idle" | "success" | "error";
  message: string | null;
}>;

const genericErrorMessage =
  "Non è stato possibile aggiornare la fotografia. Riprova più tardi.";

const extensionByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function errorState(message: string): MenuItemImageState {
  return { status: "error", message };
}

function hasExpectedImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }

  return false;
}

function revalidateMenuImagePaths(menuItemId: string) {
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/gallery");
  revalidatePath("/tv");
  revalidatePath("/admin");
  revalidatePath(`/admin/piatti/${menuItemId}/modifica`);
}

export async function uploadMenuItemImageAction(
  menuItemId: string,
  _previousState: MenuItemImageState,
  formData: FormData,
): Promise<MenuItemImageState> {
  await requireAdmin();
  void _previousState;

  if (!isValidUuid(menuItemId)) {
    return errorState(genericErrorMessage);
  }

  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return errorState("Seleziona una fotografia da caricare.");
  }

  const extension = extensionByMimeType.get(image.type);

  if (!extension) {
    return errorState("Formato non valido. Usa JPG, PNG o WebP.");
  }

  if (image.size > MENU_IMAGE_MAX_BYTES) {
    return errorState("La fotografia non può superare 4 MB.");
  }

  const imageBytes = new Uint8Array(await image.arrayBuffer());

  if (!hasExpectedImageSignature(imageBytes, image.type)) {
    return errorState("Il contenuto del file non corrisponde a un'immagine valida.");
  }

  const newImagePath = `menu-items/${menuItemId}/${crypto.randomUUID()}.${extension}`;

  try {
    const supabase = await createServerSupabaseClient();
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("id, image_url")
      .eq("id", menuItemId)
      .maybeSingle();

    if (itemError || !item) {
      return errorState(genericErrorMessage);
    }

    const { error: uploadError } = await supabase.storage
      .from(MENU_IMAGES_BUCKET)
      .upload(newImagePath, imageBytes, {
        cacheControl: "31536000",
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Caricamento della fotografia del piatto non riuscito.");
      return errorState(genericErrorMessage);
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("menu_items")
      .update({ image_url: newImagePath })
      .eq("id", menuItemId)
      .select("id")
      .maybeSingle();

    if (updateError || updatedItem?.id !== menuItemId) {
      await supabase.storage.from(MENU_IMAGES_BUCKET).remove([newImagePath]);
      console.error("Associazione della fotografia al piatto non riuscita.");
      return errorState(genericErrorMessage);
    }

    if (isManagedMenuImagePath(item.image_url)) {
      const { error: cleanupError } = await supabase.storage
        .from(MENU_IMAGES_BUCKET)
        .remove([item.image_url]);

      if (cleanupError) {
        console.error("Pulizia della fotografia sostituita non riuscita.");
      }
    }
  } catch {
    console.error("Aggiornamento della fotografia del piatto non riuscito.");
    return errorState(genericErrorMessage);
  }

  revalidateMenuImagePaths(menuItemId);
  return { status: "success", message: "Fotografia salvata correttamente." };
}

export async function removeMenuItemImageAction(
  menuItemId: string,
  _previousState: MenuItemImageState,
  _formData: FormData,
): Promise<MenuItemImageState> {
  await requireAdmin();
  void _previousState;
  void _formData;

  if (!isValidUuid(menuItemId)) {
    return errorState(genericErrorMessage);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("id, image_url")
      .eq("id", menuItemId)
      .maybeSingle();

    if (itemError || !item) {
      return errorState(genericErrorMessage);
    }

    if (!item.image_url) {
      return { status: "success", message: "Il piatto non ha una fotografia." };
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from("menu_items")
      .update({ image_url: null })
      .eq("id", menuItemId)
      .eq("image_url", item.image_url)
      .select("id")
      .maybeSingle();

    if (updateError || updatedItem?.id !== menuItemId) {
      return errorState(genericErrorMessage);
    }

    if (isManagedMenuImagePath(item.image_url)) {
      const { error: removalError } = await supabase.storage
        .from(MENU_IMAGES_BUCKET)
        .remove([item.image_url]);

      if (removalError) {
        console.error("Rimozione del file immagine non riuscita.");
      }
    }
  } catch {
    console.error("Rimozione della fotografia del piatto non riuscita.");
    return errorState(genericErrorMessage);
  }

  revalidateMenuImagePaths(menuItemId);
  return { status: "success", message: "Fotografia rimossa correttamente." };
}
