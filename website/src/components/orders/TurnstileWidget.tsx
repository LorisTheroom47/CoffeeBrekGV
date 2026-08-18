"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileWidgetProps = {
  onError: () => void;
  onExpired: () => void;
  onSuccess: (token: string) => void;
  resetKey: number;
};

type TurnstileApi = {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      appearance: "always";
      callback: (token: string) => void;
      "error-callback": () => boolean;
      "expired-callback": () => void;
      sitekey: string;
      size: "flexible";
      theme: "light";
    },
  ) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_ACTION = "order_submit";

export default function TurnstileWidget({
  onError,
  onExpired,
  onSuccess,
  resetKey,
}: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const onExpiredRef = useRef(onExpired);
  const onSuccessRef = useRef(onSuccess);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onErrorRef.current = onError;
    onExpiredRef.current = onExpired;
    onSuccessRef.current = onSuccess;
  }, [onError, onExpired, onSuccess]);

  useEffect(() => {
    const turnstile = window.turnstile;
    const container = containerRef.current;

    if (!scriptReady || !siteKey || !turnstile || !container) return;

    widgetIdRef.current = turnstile.render(container, {
      sitekey: siteKey,
      action: TURNSTILE_ACTION,
      appearance: "always",
      size: "flexible",
      theme: "light",
      callback: (token) => onSuccessRef.current(token),
      "expired-callback": () => onExpiredRef.current(),
      "error-callback": () => {
        onErrorRef.current();
        return true;
      },
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [scriptReady, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!siteKey) {
    return <div className="order-turnstile order-turnstile-unavailable" />;
  }

  return (
    <div className="order-turnstile">
      <Script
        id="cloudflare-turnstile"
        src={TURNSTILE_SCRIPT_URL}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => onErrorRef.current()}
      />
      <div ref={containerRef} />
    </div>
  );
}
