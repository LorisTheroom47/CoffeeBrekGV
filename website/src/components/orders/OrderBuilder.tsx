"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPublicOrderAction } from "@/app/ordine/actions";
import TurnstileWidget from "@/components/orders/TurnstileWidget";
import type {
  CreateOrderField,
  CreateOrderFieldErrors,
  CreateOrderInput,
  CreateOrderResult,
  OrderMenuCategory,
} from "@/lib/orders";

type OrderBuilderProps = {
  categories: OrderMenuCategory[];
  minimumDate: string;
};

type FulfillmentType = "delivery" | "pickup";

const turnstileRequiredMessage =
  "Completa la verifica di sicurezza prima di inviare l’ordine.";
const turnstileUnavailableMessage =
  "Verifica di sicurezza non disponibile. Riprova tra poco.";

type OrderConfirmation = {
  orderNumber: string;
  total: string;
  fulfillmentType: FulfillmentType;
  requestedDate: string;
  requestedTime: string | null;
};

const moneyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function definitiveMoney(value: string): string {
  const [euros, cents = "00"] = value.split(".");
  const groupedEuros = euros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${groupedEuros},${cents.padEnd(2, "0")} €`;
}

function formatRequestedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function FieldError({
  field,
  errors,
}: {
  field: CreateOrderField;
  errors: CreateOrderFieldErrors;
}) {
  const message = errors[field];

  return message ? (
    <span className="order-field-error" id={`${field}-error`}>
      {message}
    </span>
  ) : null;
}

export default function OrderBuilder({
  categories,
  minimumDate,
}: OrderBuilderProps) {
  const turnstileConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [requestedDate, setRequestedDate] = useState(minimumDate);
  const [requestedTime, setRequestedTime] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileMessage, setTurnstileMessage] = useState<string | null>(
    turnstileConfigured ? null : turnstileUnavailableMessage,
  );
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [fieldErrors, setFieldErrors] =
    useState<CreateOrderFieldErrors>({});
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [confirmation, setConfirmation] =
    useState<OrderConfirmation | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmation) confirmationRef.current?.focus();
  }, [confirmation]);

  const allItems = useMemo(
    () => categories.flatMap((category) => category.items),
    [categories],
  );
  const selectedItems = allItems.filter(
    (item) => (quantities[item.id] ?? 0) > 0,
  );
  const indicativeTotal = selectedItems.reduce(
    (total, item) => total + item.price * (quantities[item.id] ?? 0),
    0,
  );

  function updateQuantity(itemId: string, change: number) {
    setQuantities((current) => {
      const nextQuantity = Math.min(
        99,
        Math.max(0, (current[itemId] ?? 0) + change),
      );

      if (nextQuantity === 0) {
        const { [itemId]: _removed, ...remaining } = current;
        void _removed;
        setItemNotes((notes) => {
          const { [itemId]: _removedNote, ...remainingNotes } = notes;
          void _removedNote;
          return remainingNotes;
        });
        return remaining;
      }

      return { ...current, [itemId]: nextQuantity };
    });
    setFieldErrors((current) => ({ ...current, items: undefined }));
  }

  function changeFulfillment(nextValue: FulfillmentType) {
    setFulfillmentType(nextValue);
    setFieldErrors((current) => ({
      ...current,
      fulfillmentType: undefined,
      deliveryAddress: undefined,
      deliveryCity: undefined,
      deliveryPostalCode: undefined,
    }));

    if (nextValue === "pickup") {
      setDeliveryAddress("");
      setDeliveryCity("");
      setDeliveryPostalCode("");
    }
  }

  function resetOrder() {
    setQuantities({});
    setItemNotes({});
    setFulfillmentType("delivery");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDeliveryAddress("");
    setDeliveryCity("");
    setDeliveryPostalCode("");
    setRequestedDate(minimumDate);
    setRequestedTime("");
    setCustomerNotes("");
    setWebsite("");
    setTurnstileToken(null);
    setTurnstileMessage(null);
    setTurnstileResetKey((current) => current + 1);
    setFieldErrors({});
    setResult(null);
    setConfirmation(null);
  }

  function validate(): CreateOrderFieldErrors {
    const errors: CreateOrderFieldErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (selectedItems.length === 0) {
      errors.items = "Seleziona almeno un piatto.";
    }
    if (customerName.trim().length === 0 || customerName.trim().length > 120) {
      errors.customerName = "Inserisci un nome valido.";
    }
    if (customerPhone.trim().length === 0 || customerPhone.trim().length > 40) {
      errors.customerPhone = "Inserisci un telefono valido.";
    }
    if (
      customerEmail.trim().length > 0 &&
      (customerEmail.trim().length > 254 ||
        !emailPattern.test(customerEmail.trim()))
    ) {
      errors.customerEmail = "Inserisci un’email valida.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || requestedDate < minimumDate) {
      errors.requestedDate = "Seleziona una data valida.";
    }
    if (requestedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)) {
      errors.requestedTime = "Inserisci un orario valido.";
    }
    if (fulfillmentType === "delivery") {
      if (!deliveryAddress.trim() || deliveryAddress.trim().length > 200) {
        errors.deliveryAddress = "Inserisci l’indirizzo di consegna.";
      }
      if (!deliveryCity.trim() || deliveryCity.trim().length > 120) {
        errors.deliveryCity = "Inserisci la città.";
      }
      if (!deliveryPostalCode.trim() || deliveryPostalCode.trim().length > 20) {
        errors.deliveryPostalCode = "Inserisci il CAP.";
      }
    }
    if (customerNotes.trim().length > 1000) {
      errors.customerNotes = "Le note sono troppo lunghe.";
    }
    if (
      selectedItems.some(
        (item) => (itemNotes[item.id]?.trim().length ?? 0) > 500,
      )
    ) {
      errors.items = "Le note di un piatto sono troppo lunghe.";
    }

    return errors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) return;

    const errors = validate();
    const honeypotValue = website;
    const captchaToken = turnstileToken;
    setWebsite("");
    setFieldErrors(errors);
    setResult(null);

    if (!captchaToken) {
      setTurnstileMessage((current) =>
        current === turnstileUnavailableMessage
          ? current
          : turnstileRequiredMessage,
      );
    }

    if (Object.keys(errors).length > 0 || !captchaToken) return;

    setTurnstileMessage(null);

    const input: CreateOrderInput = {
      idempotencyKey,
      fulfillmentType,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      requestedDate,
      website: honeypotValue,
      turnstileToken: captchaToken,
      items: selectedItems.map((item) => ({
        menuItemId: item.id,
        quantity: quantities[item.id],
        ...(itemNotes[item.id]?.trim()
          ? { customerNotes: itemNotes[item.id].trim() }
          : {}),
      })),
      ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
      ...(requestedTime ? { requestedTime } : {}),
      ...(customerNotes.trim() ? { customerNotes: customerNotes.trim() } : {}),
      ...(fulfillmentType === "delivery"
        ? {
            deliveryAddress: deliveryAddress.trim(),
            deliveryCity: deliveryCity.trim(),
            deliveryPostalCode: deliveryPostalCode.trim(),
          }
        : {}),
    };

    startTransition(async () => {
      let response: CreateOrderResult;

      try {
        response = await createPublicOrderAction(input);
      } catch {
        response = {
          success: false,
          code: "ORDER_CREATION_FAILED",
          message: "Impossibile creare l’ordine. Riprova.",
        };
      }

      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);

      if (response.success) {
        setIdempotencyKey(crypto.randomUUID());
        setQuantities({});
        setItemNotes({});
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setDeliveryAddress("");
        setDeliveryCity("");
        setDeliveryPostalCode("");
        setFulfillmentType("delivery");
        setRequestedDate(minimumDate);
        setRequestedTime("");
        setCustomerNotes("");
        setWebsite("");
        setTurnstileMessage(null);
        setFieldErrors({});
        setResult(null);
        setConfirmation({
          orderNumber: response.orderNumber,
          total: response.total,
          fulfillmentType: input.fulfillmentType,
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime ?? null,
        });
      } else {
        setWebsite("");
        setTurnstileMessage(turnstileRequiredMessage);
        setFieldErrors(response.fieldErrors ?? {});
        setResult(response);
      }
    });
  }

  if (confirmation) {
    return (
      <div
        className="order-success"
        role="status"
        aria-live="polite"
        ref={confirmationRef}
        tabIndex={-1}
      >
        <span className="order-success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Richiesta inviata</p>
        <h2>Ordine ricevuto</h2>
        <dl>
          <div>
            <dt>Numero ordine</dt>
            <dd>{confirmation.orderNumber}</dd>
          </div>
          <div>
            <dt>Totale definitivo</dt>
            <dd>{definitiveMoney(confirmation.total)}</dd>
          </div>
          <div>
            <dt>Modalità</dt>
            <dd>
              {confirmation.fulfillmentType === "delivery"
                ? "Consegna"
                : "Ritiro"}
            </dd>
          </div>
          <div>
            <dt>Data richiesta</dt>
            <dd>{formatRequestedDate(confirmation.requestedDate)}</dd>
          </div>
        </dl>
        {confirmation.requestedTime && (
          <p className="order-confirmation-time">
            <strong>Orario preferito:</strong> {confirmation.requestedTime}
          </p>
        )}
        <p>
          La richiesta è stata ricevuta. Il locale potrà confermare l’ordine.
        </p>
        <div className="order-confirmation-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={resetOrder}
          >
            Fai un nuovo ordine
          </button>
          <Link className="button button-secondary" href="/menu">
            Torna al menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      <div className="order-honeypot" aria-hidden="true">
        <label htmlFor="order-website">Sito web</label>
        <input
          id="order-website"
          name="website"
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>
      <fieldset className="order-builder-fieldset" disabled={isPending}>
        <legend className="sr-only">Dati dell’ordine</legend>
        <div className="order-builder-layout">
          <div className="order-builder-main">
            <section className="order-card" aria-labelledby="dishes-title">
              <div className="order-card-heading">
                <div>
                  <p className="eyebrow">1. Scegli</p>
                  <h2 id="dishes-title">Piatti disponibili</h2>
                </div>
                <span>{selectedItems.length} selezionati</span>
              </div>

              {categories.map((category) => (
                <section className="order-category" key={category.id}>
                  <h3>{category.name}</h3>
                  <div className="order-dish-list">
                    {category.items.map((item) => {
                      const quantity = quantities[item.id] ?? 0;

                      return (
                        <article
                          className={`order-dish${quantity > 0 ? " order-dish-selected" : ""}`}
                          key={item.id}
                        >
                          <div className="order-dish-info">
                            <h4>{item.name}</h4>
                            <strong>{moneyFormatter.format(item.price)}</strong>
                            {item.allergens.length > 0 && (
                              <p>Allergeni: {item.allergens.join(", ")}</p>
                            )}
                          </div>
                          <div className="quantity-control" aria-label={`Quantità di ${item.name}`}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              disabled={quantity === 0}
                              aria-label={`Riduci quantità di ${item.name}`}
                            >
                              −
                            </button>
                            <output aria-live="polite" aria-label={`Quantità: ${quantity}`}>
                              {quantity}
                            </output>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              disabled={quantity === 99}
                              aria-label={`Aumenta quantità di ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
              <FieldError field="items" errors={fieldErrors} />
            </section>

            <section className="order-card" aria-labelledby="details-title">
              <div className="order-card-heading">
                <div>
                  <p className="eyebrow">2. Completa</p>
                  <h2 id="details-title">Consegna e contatti</h2>
                </div>
              </div>

              <fieldset className="fulfillment-fieldset">
                <legend>Come vuoi ricevere l’ordine?</legend>
                <div className="fulfillment-options">
                  <label>
                    <input
                      type="radio"
                      name="fulfillmentType"
                      value="delivery"
                      checked={fulfillmentType === "delivery"}
                      onChange={() => changeFulfillment("delivery")}
                    />
                    <span><strong>Consegna</strong><small>All’indirizzo indicato</small></span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="fulfillmentType"
                      value="pickup"
                      checked={fulfillmentType === "pickup"}
                      onChange={() => changeFulfillment("pickup")}
                    />
                    <span><strong>Ritiro</strong><small>Presso Coffee Break Monza</small></span>
                  </label>
                </div>
                <FieldError field="fulfillmentType" errors={fieldErrors} />
              </fieldset>

              <div className="order-fields-grid">
                <label>
                  Nome e cognome <span aria-hidden="true">*</span>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    required
                    aria-invalid={Boolean(fieldErrors.customerName)}
                    aria-describedby={fieldErrors.customerName ? "customerName-error" : undefined}
                  />
                  <FieldError field="customerName" errors={fieldErrors} />
                </label>
                <label>
                  Telefono <span aria-hidden="true">*</span>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    autoComplete="tel"
                    maxLength={40}
                    required
                    aria-invalid={Boolean(fieldErrors.customerPhone)}
                    aria-describedby={fieldErrors.customerPhone ? "customerPhone-error" : undefined}
                  />
                  <FieldError field="customerPhone" errors={fieldErrors} />
                </label>
                <label className="order-field-wide">
                  Email <span className="optional-label">(facoltativa)</span>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    aria-invalid={Boolean(fieldErrors.customerEmail)}
                    aria-describedby={fieldErrors.customerEmail ? "customerEmail-error" : undefined}
                  />
                  <FieldError field="customerEmail" errors={fieldErrors} />
                </label>
              </div>

              {fulfillmentType === "delivery" && (
                <div className="order-fields-grid order-delivery-fields">
                  <label className="order-field-wide">
                    Indirizzo <span aria-hidden="true">*</span>
                    <input
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      autoComplete="street-address"
                      maxLength={200}
                      required
                      aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                      aria-describedby={fieldErrors.deliveryAddress ? "deliveryAddress-error" : undefined}
                    />
                    <FieldError field="deliveryAddress" errors={fieldErrors} />
                  </label>
                  <label>
                    Città <span aria-hidden="true">*</span>
                    <input
                      value={deliveryCity}
                      onChange={(event) => setDeliveryCity(event.target.value)}
                      autoComplete="address-level2"
                      maxLength={120}
                      required
                      aria-invalid={Boolean(fieldErrors.deliveryCity)}
                      aria-describedby={fieldErrors.deliveryCity ? "deliveryCity-error" : undefined}
                    />
                    <FieldError field="deliveryCity" errors={fieldErrors} />
                  </label>
                  <label>
                    CAP <span aria-hidden="true">*</span>
                    <input
                      inputMode="numeric"
                      value={deliveryPostalCode}
                      onChange={(event) => setDeliveryPostalCode(event.target.value)}
                      autoComplete="postal-code"
                      maxLength={20}
                      required
                      aria-invalid={Boolean(fieldErrors.deliveryPostalCode)}
                      aria-describedby={fieldErrors.deliveryPostalCode ? "deliveryPostalCode-error" : undefined}
                    />
                    <FieldError field="deliveryPostalCode" errors={fieldErrors} />
                  </label>
                </div>
              )}

              <div className="order-fields-grid">
                <label>
                  Data richiesta <span aria-hidden="true">*</span>
                  <input
                    type="date"
                    min={minimumDate}
                    value={requestedDate}
                    onChange={(event) => setRequestedDate(event.target.value)}
                    required
                    aria-invalid={Boolean(fieldErrors.requestedDate)}
                    aria-describedby={fieldErrors.requestedDate ? "requestedDate-error" : undefined}
                  />
                  <FieldError field="requestedDate" errors={fieldErrors} />
                </label>
                <label>
                  Orario preferito <span className="optional-label">(facoltativo)</span>
                  <input
                    type="time"
                    value={requestedTime}
                    onChange={(event) => setRequestedTime(event.target.value)}
                    aria-invalid={Boolean(fieldErrors.requestedTime)}
                    aria-describedby={fieldErrors.requestedTime ? "requestedTime-error" : undefined}
                  />
                  <FieldError field="requestedTime" errors={fieldErrors} />
                </label>
                <label className="order-field-wide">
                  Note sull’ordine <span className="optional-label">(facoltative)</span>
                  <textarea
                    value={customerNotes}
                    onChange={(event) => setCustomerNotes(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    aria-invalid={Boolean(fieldErrors.customerNotes)}
                    aria-describedby={fieldErrors.customerNotes ? "customerNotes-error" : undefined}
                  />
                  <FieldError field="customerNotes" errors={fieldErrors} />
                </label>
              </div>
            </section>
          </div>

          <aside className="order-cart" aria-labelledby="cart-title">
            <div className="order-card order-cart-card">
              <p className="eyebrow">Il tuo ordine</p>
              <h2 id="cart-title">Riepilogo</h2>

              {selectedItems.length === 0 ? (
                <p className="order-empty-cart">Il carrello è vuoto. Aggiungi un piatto per iniziare.</p>
              ) : (
                <ul className="order-cart-list">
                  {selectedItems.map((item) => {
                    const quantity = quantities[item.id];

                    return (
                      <li key={item.id}>
                        <div className="order-cart-line">
                          <span>
                            <strong>{quantity}× {item.name}</strong>
                            <small>{moneyFormatter.format(item.price)} cad.</small>
                          </span>
                          <span>{moneyFormatter.format(item.price * quantity)}</span>
                        </div>
                        <label>
                          Nota per questo piatto
                          <textarea
                            value={itemNotes[item.id] ?? ""}
                            onChange={(event) => setItemNotes((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))}
                            maxLength={500}
                            rows={2}
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="order-indicative-total">
                <span>Totale indicativo</span>
                <strong>{moneyFormatter.format(indicativeTotal)}</strong>
              </div>
              <p className="order-total-note">
                Il totale definitivo, incluse eventuali spese di consegna, è
                calcolato in modo sicuro al momento dell’invio.
              </p>

              <TurnstileWidget
                resetKey={turnstileResetKey}
                onSuccess={(token) => {
                  setTurnstileToken(token);
                  setTurnstileMessage(null);
                }}
                onExpired={() => {
                  setTurnstileToken(null);
                  setTurnstileMessage(turnstileRequiredMessage);
                }}
                onError={() => {
                  setTurnstileToken(null);
                  setTurnstileMessage(turnstileUnavailableMessage);
                }}
              />

              {turnstileMessage && (
                <p
                  className="order-security-message"
                  id="turnstile-message"
                  role="alert"
                >
                  {turnstileMessage}
                </p>
              )}

              {result && !result.success && (
                <div className="order-submit-error" role="alert">
                  <strong>Ordine non inviato</strong>
                  <p>{result.message}</p>
                  {result.code === "ITEM_NOT_AVAILABLE" && (
                    <p>Controlla il menu e aggiorna la selezione prima di riprovare.</p>
                  )}
                </div>
              )}

              <button
                className="button button-primary order-submit-button"
                type="submit"
                disabled={isPending || selectedItems.length === 0}
                aria-describedby={
                  turnstileMessage ? "turnstile-message" : undefined
                }
              >
                {isPending ? "Invio ordine…" : "Invia ordine"}
              </button>
              <p className="order-privacy-note">
                I dati inseriti vengono utilizzati esclusivamente per gestire
                questa richiesta d’ordine.
              </p>
            </div>
          </aside>
        </div>
      </fieldset>
    </form>
  );
}
