import "server-only";

import { isIP } from "node:net";

const ATTEMPT_LIMIT = 5;
const WINDOW_MILLISECONDS = 10 * 60 * 1000;
const MAXIMUM_BUCKETS = 10_000;
const FALLBACK_BUCKET = "shared-fallback";

type RateLimitBucket = {
  attempts: number;
  expiresAt: number;
};

// Limiter best-effort: questa Map appartiene soltanto al processo corrente e
// non è persistente né condivisa tra istanze serverless.
const orderRateLimitBuckets = new Map<string, RateLimitBucket>();

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

function removeExpiredBuckets(now: number) {
  for (const [identifier, bucket] of orderRateLimitBuckets) {
    if (bucket.expiresAt <= now) {
      orderRateLimitBuckets.delete(identifier);
    }
  }
}

export function allowOrderAttempt(identifier: string): boolean {
  const now = Date.now();
  removeExpiredBuckets(now);

  let bucketIdentifier = identifier;

  if (
    !orderRateLimitBuckets.has(bucketIdentifier) &&
    orderRateLimitBuckets.size >= MAXIMUM_BUCKETS
  ) {
    bucketIdentifier = FALLBACK_BUCKET;
  }

  const currentBucket = orderRateLimitBuckets.get(bucketIdentifier);

  if (!currentBucket) {
    orderRateLimitBuckets.set(bucketIdentifier, {
      attempts: 1,
      expiresAt: now + WINDOW_MILLISECONDS,
    });
    return true;
  }

  if (currentBucket.attempts >= ATTEMPT_LIMIT) {
    return false;
  }

  currentBucket.attempts += 1;
  return true;
}
