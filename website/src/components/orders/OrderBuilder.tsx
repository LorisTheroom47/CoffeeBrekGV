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
  OrderMenuExtra,
  OrderMenuItem,
} from "@/lib/orders";
import {
  deliveryPointOptions,
  deliveryTimeSlots,
  getDeliveryPointLabel,
  isDeliveryTimeSlot,
  type DeliveryPoint,
} from "@/lib/orders/delivery";
import {
  orderCategoryFilters,
  type OrderCategorySlug,
} from "@/lib/orders/categories";

type OrderBuilderProps = {
  categories: OrderMenuCategory[];
  extras: OrderMenuExtra[];
  initialCategorySlug: OrderCategorySlug | "all";
  minimumDate: string;
};

type FulfillmentType = "delivery" | "pickup";
type ExtraGroup = OrderMenuExtra["groupCode"];
type ExtraSelection = {
  cheeseExtraId: string;
  vegetableExtraId: string;
  sauceExtraId: string;
};
type CartLine = {
  key: string;
  item: OrderMenuItem;
  quantity: number;
  selection: ExtraSelection;
  selectedExtras: OrderMenuExtra[];
};

const emptySelection: ExtraSelection = {
  cheeseExtraId: "",
  vegetableExtraId: "",
  sauceExtraId: "",
};
const extraGroups: ReadonlyArray<{
  code: ExtraGroup;
  label: string;
  field: keyof ExtraSelection;
}> = [
  { code: "FORMAGGIO", label: "Formaggio", field: "cheeseExtraId" },
  { code: "VERDURA", label: "Verdura", field: "vegetableExtraId" },
  { code: "SALSA", label: "Salsa", field: "sauceExtraId" },
];
const extraGroupLabels: Readonly<Record<ExtraGroup, string>> = {
  FORMAGGIO: "Formaggio",
  VERDURA: "Verdura",
  SALSA: "Salsa",
};
const turnstileRequiredMessage =
  "Completa la verifica di sicurezza prima di inviare l’ordine.";
const turnstileUnavailableMessage =
  "Verifica di sicurezza non disponibile. Riprova tra poco.";

type OrderConfirmation = {
  orderNumber: string;
  total: string;
  fulfillmentType: FulfillmentType;
  deliveryPoint: DeliveryPoint | null;
  requestedDate: string;
  requestedTime: string | null;
  items: Array<{
    key: string;
    name: string;
    quantity: number;
    extras: OrderMenuExtra[];
  }>;
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

function lineKey(itemId: string, selection: ExtraSelection): string {
  return [
    itemId,
    selection.cheeseExtraId,
    selection.vegetableExtraId,
    selection.sauceExtraId,
  ].join("|");
}

function extraTotal(extras: readonly OrderMenuExtra[]): number {
  return extras.reduce((total, extra) => total + extra.price, 0);
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
  extras,
  initialCategorySlug,
  minimumDate,
}: OrderBuilderProps) {
  const turnstileConfigured = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [customizationSelections, setCustomizationSelections] = useState<
    Record<string, ExtraSelection>
  >({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<
    OrderCategorySlug | "all"
  >(initialCategorySlug);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryPoint, setDeliveryPoint] = useState<DeliveryPoint | "">("");
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

  useEffect(() => {
    setSelectedCategorySlug(initialCategorySlug);
  }, [initialCategorySlug]);

  const selectableCategories = useMemo(
    () =>
      orderCategoryFilters.flatMap((filter) => {
        const category = categories.find(
          (candidate) => candidate.slug === filter.slug,
        );
        return category ? [category] : [];
      }),
    [categories],
  );
  const visibleCategories =
    selectedCategorySlug === "all"
      ? categories
      : categories.filter((category) => category.slug === selectedCategorySlug);
  const selectedQuantity = cartLines.reduce(
    (total, line) => total + line.quantity,
    0,
  );
  const indicativeTotal = cartLines.reduce(
    (total, line) =>
      total +
      (line.item.price + extraTotal(line.selectedExtras)) * line.quantity,
    0,
  );

  function compatibleExtras(item: OrderMenuItem, group: ExtraGroup) {
    if (!item.customizationScope) return [];
    return extras.filter(
      (extra) =>
        extra.groupCode === group &&
        (item.customizationScope === "SENZA_GLUTINE"
          ? extra.appliesToGlutenFree
          : extra.appliesTo === item.customizationScope ||
            extra.appliesTo === "ENTRAMBI"),
    );
  }

  function updateLineQuantity(key: string, change: number) {
    setCartLines((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        const quantity = Math.min(99, Math.max(0, line.quantity + change));
        return quantity === 0 ? [] : [{ ...line, quantity }];
      }),
    );
    if (change < 0) {
      setItemNotes((current) => {
        const line = cartLines.find((candidate) => candidate.key === key);
        if (!line || line.quantity > 1) return current;
        const { [key]: _removed, ...remaining } = current;
        void _removed;
        return remaining;
      });
    }
    setFieldErrors((current) => ({ ...current, items: undefined }));
  }

  function updateSimpleQuantity(item: OrderMenuItem, change: number) {
    const key = lineKey(item.id, emptySelection);
    const existing = cartLines.find((line) => line.key === key);
    if (existing) {
      updateLineQuantity(key, change);
      return;
    }
    if (change > 0) {
      setCartLines((current) => [
        ...current,
        {
          key,
          item,
          quantity: 1,
          selection: { ...emptySelection },
          selectedExtras: [],
        },
      ]);
      setFieldErrors((current) => ({ ...current, items: undefined }));
    }
  }

  function updateSelection(
    itemId: string,
    field: keyof ExtraSelection,
    value: string,
  ) {
    setCustomizationSelections((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? emptySelection),
        [field]: value,
      },
    }));
  }

  function addCustomizedLine(item: OrderMenuItem) {
    const selection = customizationSelections[item.id] ?? emptySelection;
    const selectedIds = new Set(Object.values(selection).filter(Boolean));
    const selectedExtras = extras.filter((extra) => selectedIds.has(extra.id));
    const key = lineKey(item.id, selection);
    const existing = cartLines.find((line) => line.key === key);

    if (existing) {
      updateLineQuantity(key, 1);
    } else {
      setCartLines((current) => [
        ...current,
        {
          key,
          item,
          quantity: 1,
          selection: { ...selection },
          selectedExtras,
        },
      ]);
      setFieldErrors((current) => ({ ...current, items: undefined }));
    }
    setExpandedItemId(null);
  }

  function changeFulfillment(nextValue: FulfillmentType) {
    setFulfillmentType(nextValue);
    setFieldErrors((current) => ({
      ...current,
      fulfillmentType: undefined,
      deliveryPoint: undefined,
    }));
    if (nextValue === "pickup") {
      setDeliveryPoint("");
    } else if (requestedTime && !isDeliveryTimeSlot(requestedTime)) {
      setRequestedTime("");
    }
  }

  function resetOrder() {
    setCartLines([]);
    setItemNotes({});
    setCustomizationSelections({});
    setExpandedItemId(null);
    setFulfillmentType("delivery");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setDeliveryPoint("");
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

    if (cartLines.length === 0) errors.items = "Seleziona almeno un piatto.";
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
    if (fulfillmentType === "delivery") {
      if (!deliveryPoint) errors.deliveryPoint = "Seleziona un punto di consegna.";
      if (!isDeliveryTimeSlot(requestedTime)) {
        errors.requestedTime =
          "Seleziona un orario di consegna tra le 12:00 e le 14:00.";
      }
    } else if (
      requestedTime &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(requestedTime)
    ) {
      errors.requestedTime = "Inserisci un orario valido.";
    }
    if (customerNotes.trim().length > 1000) {
      errors.customerNotes = "Le note sono troppo lunghe.";
    }
    if (
      cartLines.some(
        (line) => (itemNotes[line.key]?.trim().length ?? 0) > 500,
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
      items: cartLines.map((line) => ({
        menuItemId: line.item.id,
        quantity: line.quantity,
        ...(itemNotes[line.key]?.trim()
          ? { customerNotes: itemNotes[line.key].trim() }
          : {}),
        ...(line.selection.cheeseExtraId
          ? { cheeseExtraId: line.selection.cheeseExtraId }
          : {}),
        ...(line.selection.vegetableExtraId
          ? { vegetableExtraId: line.selection.vegetableExtraId }
          : {}),
        ...(line.selection.sauceExtraId
          ? { sauceExtraId: line.selection.sauceExtraId }
          : {}),
      })),
      ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
      ...(requestedTime ? { requestedTime } : {}),
      ...(customerNotes.trim() ? { customerNotes: customerNotes.trim() } : {}),
      ...(fulfillmentType === "delivery"
        ? { deliveryPoint: deliveryPoint as DeliveryPoint }
        : {}),
    };
    const confirmedItems = cartLines.map((line) => ({
      key: line.key,
      name: line.item.name,
      quantity: line.quantity,
      extras: line.selectedExtras,
    }));

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
        setCartLines([]);
        setItemNotes({});
        setCustomizationSelections({});
        setExpandedItemId(null);
        setCustomerName("");
        setCustomerPhone("");
        setCustomerEmail("");
        setDeliveryPoint("");
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
          deliveryPoint: input.deliveryPoint ?? null,
          requestedDate: input.requestedDate,
          requestedTime: input.requestedTime ?? null,
          items: confirmedItems,
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
      <div className="order-success" role="status" aria-live="polite" ref={confirmationRef} tabIndex={-1}>
        <span className="order-success-icon" aria-hidden="true">✓</span>
        <p className="eyebrow">Richiesta inviata</p>
        <h2>Ordine ricevuto</h2>
        <dl>
          <div><dt>Numero ordine</dt><dd>{confirmation.orderNumber}</dd></div>
          <div><dt>Totale definitivo</dt><dd>{definitiveMoney(confirmation.total)}</dd></div>
          <div><dt>Modalità</dt><dd>{confirmation.fulfillmentType === "delivery" ? "Consegna" : "Ritiro"}</dd></div>
          {confirmation.deliveryPoint && (
            <div><dt>Punto di consegna</dt><dd>{getDeliveryPointLabel(confirmation.deliveryPoint)}</dd></div>
          )}
          <div><dt>Data richiesta</dt><dd>{formatRequestedDate(confirmation.requestedDate)}</dd></div>
        </dl>
        <div className="order-confirmation-items">
          <h3>Composizione ordine</h3>
          <ul>
            {confirmation.items.map((item) => (
              <li key={item.key}>
                <strong>{item.quantity}× {item.name}</strong>
                {item.extras.map((extra) => (
                  <span key={extra.id}>{extraGroupLabels[extra.groupCode]}: {extra.name}</span>
                ))}
              </li>
            ))}
          </ul>
        </div>
        {confirmation.requestedTime && (
          <p className="order-confirmation-time">
            <strong>{confirmation.fulfillmentType === "delivery" ? "Orario consegna:" : "Orario preferito:"}</strong>{" "}
            {confirmation.requestedTime}
          </p>
        )}
        <p>La richiesta è stata ricevuta. Il locale potrà confermare l’ordine.</p>
        <div className="order-confirmation-actions">
          <button className="button button-primary" type="button" onClick={resetOrder}>Fai un nuovo ordine</button>
          <Link className="button button-secondary" href="/menu">Torna al menu</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      <div className="order-honeypot" aria-hidden="true">
        <label htmlFor="order-website">Sito web</label>
        <input id="order-website" name="website" type="text" value={website} onChange={(event) => setWebsite(event.target.value)} autoComplete="off" tabIndex={-1} />
      </div>
      <fieldset className="order-builder-fieldset" disabled={isPending}>
        <legend className="sr-only">Dati dell’ordine</legend>
        <div className="order-builder-layout">
          <div className="order-builder-main">
            <section className="order-card" aria-labelledby="dishes-title">
              <div className="order-card-heading">
                <div><p className="eyebrow">1. Scegli</p><h2 id="dishes-title">Piatti disponibili</h2></div>
                <span>{selectedQuantity} selezionati</span>
              </div>
              <nav aria-label="Filtra i piatti per categoria" className="order-category-filters">
                <button aria-pressed={selectedCategorySlug === "all"} className="order-category-filter" onClick={() => setSelectedCategorySlug("all")} type="button">Tutti</button>
                {selectableCategories.map((category) => (
                  <button aria-pressed={selectedCategorySlug === category.slug} className="order-category-filter" key={category.id} onClick={() => setSelectedCategorySlug(category.slug as OrderCategorySlug)} type="button">{category.name}</button>
                ))}
              </nav>

              {visibleCategories.map((category) => (
                <section className="order-category" key={category.id}>
                  <h3>{category.name}</h3>
                  <div className="order-dish-list">
                    {category.items.map((item) => {
                      const itemLines = cartLines.filter((line) => line.item.id === item.id);
                      const quantity = itemLines.reduce((total, line) => total + line.quantity, 0);
                      const canCustomize = item.customizable && item.customizationScope !== null;
                      const selection = customizationSelections[item.id] ?? emptySelection;
                      const selectedIds = new Set(Object.values(selection).filter(Boolean));
                      const previewExtras = extras.filter((extra) => selectedIds.has(extra.id));
                      const unitPreview = item.price + extraTotal(previewExtras);
                      const isExpanded = expandedItemId === item.id;

                      return (
                        <article className={`order-dish${quantity > 0 ? " order-dish-selected" : ""}`} key={item.id}>
                          <div className="order-dish-row">
                            <div className="order-dish-info">
                              <h4>{item.name}</h4>
                              <strong>{moneyFormatter.format(item.price)}</strong>
                              {item.allergens.length > 0 && <p>Allergeni: {item.allergens.join(", ")}</p>}
                            </div>
                            {canCustomize ? (
                              <div className="order-customize-trigger">
                                {quantity > 0 && <span>{quantity} nel carrello</span>}
                                <button className="button button-secondary" type="button" aria-expanded={isExpanded} onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                                  {isExpanded ? "Chiudi" : "Personalizza"}
                                </button>
                              </div>
                            ) : (
                              <div className="quantity-control" aria-label={`Quantità di ${item.name}`}>
                                <button type="button" onClick={() => updateSimpleQuantity(item, -1)} disabled={quantity === 0} aria-label={`Riduci quantità di ${item.name}`}>−</button>
                                <output aria-live="polite" aria-label={`Quantità: ${quantity}`}>{quantity}</output>
                                <button type="button" onClick={() => updateSimpleQuantity(item, 1)} disabled={quantity === 99} aria-label={`Aumenta quantità di ${item.name}`}>+</button>
                              </div>
                            )}
                          </div>

                          {canCustomize && isExpanded && (
                            <div className="order-customizer">
                              <div className="order-customizer-heading">
                                <div><span>Personalizza</span><strong>{item.name}</strong></div>
                                <strong>{moneyFormatter.format(unitPreview)}</strong>
                              </div>
                              <div className="order-extra-groups">
                                {extraGroups.map((group) => (
                                  <fieldset key={group.code}>
                                    <legend>{group.label}</legend>
                                    <label>
                                      <input type="radio" name={`${item.id}-${group.code}`} value="" checked={selection[group.field] === ""} onChange={() => updateSelection(item.id, group.field, "")} />
                                      <span>Nessuno</span>
                                    </label>
                                    {compatibleExtras(item, group.code).map((extra) => (
                                      <label key={extra.id}>
                                        <input type="radio" name={`${item.id}-${group.code}`} value={extra.id} checked={selection[group.field] === extra.id} onChange={() => updateSelection(item.id, group.field, extra.id)} />
                                        <span>{extra.name}{extra.price > 0 ? ` +${moneyFormatter.format(extra.price)}` : ""}</span>
                                      </label>
                                    ))}
                                  </fieldset>
                                ))}
                              </div>
                              <button className="button button-primary order-add-customized" type="button" onClick={() => addCustomizedLine(item)}>
                                Aggiungi al carrello · {moneyFormatter.format(unitPreview)}
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
              <FieldError field="items" errors={fieldErrors} />
            </section>

            <section className="order-card" aria-labelledby="details-title">
              <div className="order-card-heading"><div><p className="eyebrow">2. Completa</p><h2 id="details-title">Consegna e contatti</h2></div></div>
              <fieldset className="fulfillment-fieldset">
                <legend>Come vuoi ricevere l’ordine?</legend>
                <div className="fulfillment-options">
                  <label><input type="radio" name="fulfillmentType" value="delivery" checked={fulfillmentType === "delivery"} onChange={() => changeFulfillment("delivery")} /><span><strong>Consegna in ospedale</strong><small>Scegli il punto di consegna</small></span></label>
                  <label><input type="radio" name="fulfillmentType" value="pickup" checked={fulfillmentType === "pickup"} onChange={() => changeFulfillment("pickup")} /><span><strong>Ritiro</strong><small>Presso Coffee Break GV</small></span></label>
                </div>
                <FieldError field="fulfillmentType" errors={fieldErrors} />
              </fieldset>
              <div className="order-fields-grid">
                <label>Nome e cognome <span aria-hidden="true">*</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} autoComplete="name" maxLength={120} required aria-invalid={Boolean(fieldErrors.customerName)} /><FieldError field="customerName" errors={fieldErrors} /></label>
                <label>Telefono <span aria-hidden="true">*</span><input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} autoComplete="tel" maxLength={40} required aria-invalid={Boolean(fieldErrors.customerPhone)} /><FieldError field="customerPhone" errors={fieldErrors} /></label>
                <label className="order-field-wide">Email <span className="optional-label">(facoltativa)</span><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} autoComplete="email" maxLength={254} aria-invalid={Boolean(fieldErrors.customerEmail)} /><FieldError field="customerEmail" errors={fieldErrors} /></label>
              </div>

              {fulfillmentType === "delivery" && (
                <fieldset className="order-delivery-fields">
                  <legend>Punto di consegna <span aria-hidden="true">*</span></legend>
                  <div className="delivery-point-options">
                    {deliveryPointOptions.map((point) => (
                      <label key={point.value}><input type="radio" name="deliveryPoint" value={point.value} checked={deliveryPoint === point.value} onChange={() => { setDeliveryPoint(point.value); setFieldErrors((current) => ({ ...current, deliveryPoint: undefined })); }} required /><span><strong>{point.title}</strong>{point.description && <small>{point.description}</small>}</span></label>
                    ))}
                  </div>
                  <FieldError field="deliveryPoint" errors={fieldErrors} />
                </fieldset>
              )}

              <div className="order-fields-grid">
                <label>Data richiesta <span aria-hidden="true">*</span><input type="date" min={minimumDate} value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} required aria-invalid={Boolean(fieldErrors.requestedDate)} /><FieldError field="requestedDate" errors={fieldErrors} /></label>
                <label>{fulfillmentType === "delivery" ? <>Orario consegna <span aria-hidden="true">*</span></> : <>Orario preferito <span className="optional-label">(facoltativo)</span></>}
                  {fulfillmentType === "delivery" ? (
                    <select value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} required aria-invalid={Boolean(fieldErrors.requestedTime)}><option value="">Seleziona un orario</option>{deliveryTimeSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select>
                  ) : (
                    <input type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} aria-invalid={Boolean(fieldErrors.requestedTime)} />
                  )}
                  <FieldError field="requestedTime" errors={fieldErrors} />
                </label>
                <label className="order-field-wide">Note sull’ordine <span className="optional-label">(facoltative)</span><textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} maxLength={1000} rows={4} aria-invalid={Boolean(fieldErrors.customerNotes)} /><FieldError field="customerNotes" errors={fieldErrors} /></label>
              </div>
            </section>
          </div>

          <aside className="order-cart" aria-labelledby="cart-title">
            <div className="order-card order-cart-card" id="order-checkout">
              <p className="eyebrow">Il tuo ordine</p>
              <h2 id="cart-title">Riepilogo</h2>
              {cartLines.length === 0 ? (
                <p className="order-empty-cart">Il carrello è vuoto. Aggiungi un piatto per iniziare.</p>
              ) : (
                <ul className="order-cart-list">
                  {cartLines.map((line) => {
                    const unitPrice = line.item.price + extraTotal(line.selectedExtras);
                    return (
                      <li key={line.key}>
                        <div className="order-cart-line">
                          <span><strong>{line.quantity}× {line.item.name}</strong><small>{moneyFormatter.format(unitPrice)} cad.</small></span>
                          <span>{moneyFormatter.format(unitPrice * line.quantity)}</span>
                        </div>
                        {line.selectedExtras.length > 0 && (
                          <ul className="order-cart-extras">
                            {line.selectedExtras.map((extra) => <li key={extra.id}><span>{extraGroupLabels[extra.groupCode]}: {extra.name}</span><small>{extra.price > 0 ? `+${moneyFormatter.format(extra.price)}` : "incluso"}</small></li>)}
                          </ul>
                        )}
                        <div className="quantity-control order-cart-quantity" aria-label={`Quantità di ${line.item.name}`}>
                          <button type="button" onClick={() => updateLineQuantity(line.key, -1)} aria-label={`Riduci quantità di ${line.item.name}`}>−</button>
                          <output>{line.quantity}</output>
                          <button type="button" onClick={() => updateLineQuantity(line.key, 1)} disabled={line.quantity === 99} aria-label={`Aumenta quantità di ${line.item.name}`}>+</button>
                        </div>
                        <label>Nota per questo piatto<textarea value={itemNotes[line.key] ?? ""} onChange={(event) => setItemNotes((current) => ({ ...current, [line.key]: event.target.value }))} maxLength={500} rows={2} /></label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="order-indicative-total"><span>Totale indicativo</span><strong>{moneyFormatter.format(indicativeTotal)}</strong></div>
              {fulfillmentType === "delivery" && deliveryPoint && (
                <div className="order-delivery-summary"><p><strong>Punto di consegna:</strong> {getDeliveryPointLabel(deliveryPoint)}</p><p><strong>Consegna:</strong> Gratuita</p>{requestedTime && <p><strong>Orario consegna:</strong> {requestedTime}</p>}</div>
              )}
              <p className="order-total-note">Il totale definitivo è calcolato in modo sicuro al momento dell’invio.</p>
              <TurnstileWidget resetKey={turnstileResetKey} onSuccess={(token) => { setTurnstileToken(token); setTurnstileMessage(null); }} onExpired={() => { setTurnstileToken(null); setTurnstileMessage(turnstileRequiredMessage); }} onError={() => { setTurnstileToken(null); setTurnstileMessage(turnstileUnavailableMessage); }} />
              {turnstileMessage && <p className="order-security-message" id="turnstile-message" role="alert">{turnstileMessage}</p>}
              {result && !result.success && <div className="order-submit-error" role="alert"><strong>Ordine non inviato</strong><p>{result.message}</p>{result.code === "ITEM_NOT_AVAILABLE" && <p>Controlla il menu e aggiorna la selezione prima di riprovare.</p>}</div>}
              <button className="button button-primary order-submit-button" type="submit" disabled={isPending || cartLines.length === 0}>{isPending ? "Invio ordine…" : "Invia ordine"}</button>
              <p className="order-privacy-note">I dati inseriti vengono utilizzati esclusivamente per gestire questa richiesta d’ordine.</p>
            </div>
          </aside>
        </div>
        {cartLines.length > 0 && (
          <a className="order-mobile-cart-shortcut" href="#order-checkout"><span>{selectedQuantity} nel carrello</span><strong>{moneyFormatter.format(indicativeTotal)}</strong><span>Riepilogo</span></a>
        )}
      </fieldset>
    </form>
  );
}
