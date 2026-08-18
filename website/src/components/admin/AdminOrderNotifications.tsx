"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  formatAdminOrderNumber,
  formatAdminOrderTotal,
  getAdminOrderFulfillmentLabel,
  isAdminOrderStatus,
  isValidAdminOrderId,
  type AdminOrderStatus,
} from "@/lib/orders/admin-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const soundPreferenceKey = "coffee-break-admin-order-sound";
const soundPreferenceEvent = "coffee-break-admin-order-sound-change";
const maximumVisibleNotifications = 3;
let soundPreferenceFallback = false;

type OrderNotification = Readonly<{
  id: string;
  orderNumber: string;
  fulfillmentType: "delivery" | "pickup";
  total: string | number;
  status: AdminOrderStatus;
  createdAt: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOrderNumber(value: unknown): string | null {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;

  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return String(value);
  }

  return null;
}

function normalizeTotal(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value)) {
    return value;
  }

  return null;
}

function parseOrderNotification(value: unknown): OrderNotification | null {
  if (!isRecord(value)) return null;

  const id = typeof value.order_id === "string" ? value.order_id : "";
  const orderNumber = normalizeOrderNumber(value.order_number);
  const fulfillmentType = value.fulfillment_type;
  const total = normalizeTotal(value.total);
  const status = value.status;
  const createdAt = value.created_at;

  if (
    !isValidAdminOrderId(id) ||
    orderNumber === null ||
    (fulfillmentType !== "delivery" && fulfillmentType !== "pickup") ||
    total === null ||
    typeof status !== "string" ||
    !isAdminOrderStatus(status) ||
    typeof createdAt !== "string" ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  return {
    id,
    orderNumber,
    fulfillmentType,
    total,
    status,
    createdAt,
  };
}

function subscribeToSoundPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(soundPreferenceEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(soundPreferenceEvent, onStoreChange);
  };
}

function getSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(soundPreferenceKey) === "true";
  } catch {
    return soundPreferenceFallback;
  }
}

function getServerSoundPreference(): boolean {
  return false;
}

async function prepareOrderSound(
  audioContextRef: { current: AudioContext | null },
): Promise<void> {
  try {
    const context =
      audioContextRef.current ??
      (typeof window.AudioContext === "function"
        ? new window.AudioContext()
        : null);

    if (!context) return;

    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
  } catch {
    // Il browser può bloccare l'audio: la notifica visuale resta disponibile.
  }
}

async function playOrderSound(
  audioContextRef: { current: AudioContext | null },
): Promise<void> {
  await prepareOrderSound(audioContextRef);

  const context = audioContextRef.current;
  if (!context || context.state !== "running") return;

  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.13, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.3);
  } catch {
    // Un errore audio non deve interrompere il flusso amministrativo.
  }
}

export default function AdminOrderNotifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const soundEnabled = useSyncExternalStore(
    subscribeToSoundPreference,
    getSoundPreference,
    getServerSoundPreference,
  );
  const [connectionUnavailable, setConnectionUnavailable] = useState(false);
  const notifiedOrderIdsRef = useRef(new Set<string>());
  const soundEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let disposed = false;

    const channel = supabase
      .channel("admin:orders", { config: { private: true } })
      .on<Record<string, unknown>>(
        "broadcast",
        { event: "new_order" },
        ({ payload }) => {
          if (disposed) return;

          const notification = parseOrderNotification(payload);
          if (
            !notification ||
            notifiedOrderIdsRef.current.has(notification.id)
          ) {
            return;
          }

          notifiedOrderIdsRef.current.add(notification.id);
          setNotifications((current) =>
            [notification, ...current].slice(0, maximumVisibleNotifications),
          );

          if (soundEnabledRef.current) {
            void playOrderSound(audioContextRef);
          }

          router.refresh();
        },
      )
      .subscribe((status) => {
        if (disposed) return;

        if (status === "SUBSCRIBED") {
          setConnectionUnavailable(false);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnectionUnavailable(true);
        }
      });

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(
    () => () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    },
    [],
  );

  function toggleSound() {
    const nextValue = !soundEnabledRef.current;
    soundEnabledRef.current = nextValue;
    soundPreferenceFallback = nextValue;

    try {
      window.localStorage.setItem(soundPreferenceKey, String(nextValue));
    } catch {
      // La preferenza resta valida per la sessione corrente.
    }

    window.dispatchEvent(new Event(soundPreferenceEvent));

    if (nextValue) {
      void prepareOrderSound(audioContextRef);
    } else if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  function dismissNotification(id: string) {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }

  return (
    <aside
      className="admin-order-notification-center"
      aria-label="Notifiche ordini"
    >
      <div className="admin-order-notification-controls">
        <button
          className="admin-order-sound-toggle"
          type="button"
          aria-pressed={soundEnabled}
          onClick={toggleSound}
        >
          Suono ordini: {soundEnabled ? "Attivo" : "Disattivo"}
        </button>
        {connectionUnavailable && (
          <p role="status">Aggiornamento automatico non disponibile</p>
        )}
      </div>

      <div className="admin-order-notification-list" aria-live="polite">
        {notifications.map((notification) => (
          <article className="admin-order-notification" key={notification.id}>
            <div>
              <p className="admin-order-notification-title">
                Nuovo ordine {formatAdminOrderNumber(notification.orderNumber)} ricevuto
              </p>
              <p>
                {getAdminOrderFulfillmentLabel(notification.fulfillmentType)} ·{" "}
                {formatAdminOrderTotal(notification.total)}
              </p>
            </div>
            <div className="admin-order-notification-actions">
              <Link href={`/admin/ordini/${notification.id}`}>
                Apri ordine
              </Link>
              <button
                type="button"
                aria-label={`Chiudi notifica ordine ${formatAdminOrderNumber(notification.orderNumber)}`}
                onClick={() => dismissNotification(notification.id)}
              >
                Chiudi
              </button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
