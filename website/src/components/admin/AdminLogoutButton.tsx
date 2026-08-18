"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AdminLogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogout() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("Si è verificato un errore. Riprova.");
        return;
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setErrorMessage("Si è verificato un errore. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-logout">
      <button
        className="button button-secondary button-small admin-logout-button"
        disabled={isSubmitting}
        onClick={handleLogout}
        type="button"
      >
        {isSubmitting ? "Uscita…" : "Esci"}
      </button>
      {errorMessage ? (
        <p className="admin-auth-message" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
