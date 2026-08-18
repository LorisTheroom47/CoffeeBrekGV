"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const invalidCredentialsMessage = "Credenziali non valide.";
const genericErrorMessage = "Si è verificato un errore. Riprova.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!emailPattern.test(email) || password.length === 0) {
      setErrorMessage(invalidCredentialsMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(invalidCredentialsMessage);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setErrorMessage(genericErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-login-form" noValidate onSubmit={handleSubmit}>
      <div>
        <label htmlFor="admin-email">Email</label>
        <input
          autoComplete="email"
          disabled={isSubmitting}
          id="admin-email"
          inputMode="email"
          name="email"
          required
          type="email"
        />
      </div>

      <div>
        <label htmlFor="admin-password">Password</label>
        <input
          autoComplete="current-password"
          disabled={isSubmitting}
          id="admin-password"
          name="password"
          required
          type="password"
        />
      </div>

      {errorMessage ? (
        <p className="admin-auth-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="button button-primary"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Accesso…" : "Accedi"}
      </button>
    </form>
  );
}
