export type SupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

const missingConfigurationMessage =
  "Configurazione Supabase mancante. Controlla il file .env.local.";

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(missingConfigurationMessage);
  }

  return {
    url,
    publishableKey,
  };
}
