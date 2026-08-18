import "server-only";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "order_submit";
const SITEVERIFY_TIMEOUT_MILLISECONDS = 5_000;

type TurnstileResponse = {
  action?: unknown;
  hostname?: unknown;
  success?: unknown;
};

function isTurnstileResponse(value: unknown): value is TurnstileResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!secretKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SITEVERIFY_TIMEOUT_MILLISECONDS,
  );

  try {
    const body = new URLSearchParams({
      response: token,
      secret: secretKey,
    });
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      signal: controller.signal,
    });

    if (!response.ok) return false;

    const result: unknown = await response.json();

    return (
      isTurnstileResponse(result) &&
      result.success === true &&
      result.action === TURNSTILE_ACTION &&
      typeof result.hostname === "string" &&
      result.hostname.length > 0
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
