import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isIP } from "node:net";

const FALLBACK_BUCKET = "shared-fallback";

type CloudflareRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

declare global {
  interface CloudflareEnv {
    ORDERS_RATE_LIMITER: CloudflareRateLimitBinding;
  }
}

function normalizeIp(value: string | null): string | null {
  if (!value || value.length > 256) return null;

  const candidate = value.split(",", 1)[0]?.trim();

  if (!candidate || candidate.length > 45 || isIP(candidate) === 0) {
    return null;
  }

  return candidate.toLowerCase();
}

export function getOrderRateLimitIdentifier(
  forwardedFor: string | null,
  realIp: string | null,
): string {
  const normalizedIp = normalizeIp(forwardedFor) ?? normalizeIp(realIp);
  return normalizedIp ? `ip:${normalizedIp}` : FALLBACK_BUCKET;
}

export async function allowOrderAttempt(identifier: string): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const limiter = env.ORDERS_RATE_LIMITER;

    if (!limiter) {
      return false;
    }

    const result = await limiter.limit({ key: identifier });
    return result.success;
  } catch {
    // Fail closed: un binding assente o non disponibile non deve aggirare il
    // controllo anti-abuso né esporre dettagli dell'infrastruttura al client.
    return false;
  }
}
