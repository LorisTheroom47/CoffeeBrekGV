"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { MenuItemImageState } from "@/app/admin/(protected)/piatti/[id]/modifica/image-actions";

type ImageAction = (
  state: MenuItemImageState,
  formData: FormData,
) => Promise<MenuItemImageState>;

type MenuItemImageFormProps = Readonly<{
  imageUrl: string | null;
  itemName: string;
  removeAction: ImageAction;
  uploadAction: ImageAction;
}>;

const initialState: MenuItemImageState = { status: "idle", message: null };

export default function MenuItemImageForm({
  imageUrl,
  itemName,
  removeAction,
  uploadAction,
}: MenuItemImageFormProps) {
  const [uploadState, uploadFormAction, uploadPending] = useActionState(
    uploadAction,
    initialState,
  );
  const [removeState, removeFormAction, removePending] = useActionState(
    removeAction,
    initialState,
  );

  const state = removeState.message ? removeState : uploadState;
  const isPending = uploadPending || removePending;

  return (
    <div className="admin-image-manager">
      <div className="admin-image-preview">
        {imageUrl ? (
          <Image
            alt={`Fotografia di ${itemName}`}
            fill
            sizes="(max-width: 38rem) 100vw, 22rem"
            src={imageUrl}
          />
        ) : (
          <p>Nessuna fotografia associata.</p>
        )}
      </div>

      <div className="admin-image-controls">
        <p>
          Carica un file JPG, PNG o WebP fino a 4 MB. Il nome del file e il
          percorso Storage vengono gestiti automaticamente.
        </p>

        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "admin-image-message-success"
                : "admin-form-message"
            }
            role={state.status === "success" ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        <form action={uploadFormAction} className="admin-image-upload-form">
          <label htmlFor="menu-item-image">Fotografia del piatto</label>
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={isPending}
            id="menu-item-image"
            name="image"
            required
            type="file"
          />
          <button className="button button-primary" disabled={isPending} type="submit">
            {uploadPending
              ? "Caricamento…"
              : imageUrl
                ? "Sostituisci fotografia"
                : "Carica fotografia"}
          </button>
        </form>

        {imageUrl ? (
          <form action={removeFormAction}>
            <button
              className="button button-secondary"
              disabled={isPending}
              type="submit"
            >
              {removePending ? "Rimozione…" : "Rimuovi fotografia"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
