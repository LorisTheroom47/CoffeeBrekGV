"use client";

import { useState } from "react";
import { createTableReservationAction } from "@/app/prenota/actions";
import TurnstileWidget from "@/components/orders/TurnstileWidget";
import {
  reservationTimeSlots,
  type CreateReservationResult,
  type ReservationFieldErrors,
} from "@/lib/reservations";

type ReservationFormProps = Readonly<{
  minimumDate: string;
  currentRomeTime: string;
}>;

const initialResult: CreateReservationResult | null = null;

export default function ReservationForm({
  minimumDate,
  currentRomeTime,
}: ReservationFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [reservationDate, setReservationDate] = useState(minimumDate);
  const [reservationTime, setReservationTime] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileMessage, setTurnstileMessage] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<CreateReservationResult | null>(initialResult);
  const [pending, setPending] = useState(false);

  const allTodaySlotsHavePassed =
    reservationDate === minimumDate &&
    reservationTimeSlots.every((slot) => slot <= currentRomeTime);
  const fieldErrors: ReservationFieldErrors =
    result && !result.success ? result.fieldErrors ?? {} : {};

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const response = await createTableReservationAction({
      customerName,
      customerPhone,
      partySize,
      reservationDate,
      reservationTime,
      customerNotes,
      idempotencyKey,
      turnstileToken,
      website: String(formData.get("website") ?? ""),
    });

    setResult(response);
    setPending(false);
    setTurnstileToken("");
    setTurnstileMessage("");
    setTurnstileResetKey((value) => value + 1);
    if (response.success) setIdempotencyKey(crypto.randomUUID());
  }

  if (result?.success) {
    return (
      <section className="order-success reservation-success" aria-live="polite">
        <div className="order-success-icon" aria-hidden="true">✓</div>
        <p className="eyebrow">Prenotazione confermata</p>
        <h2>Il tavolo è prenotato</h2>
        <p>La prenotazione n. <strong>{result.reservationNumber}</strong> è confermata.</p>
        <dl>
          <div><dt>Data</dt><dd>{reservationDate}</dd></div>
          <div><dt>Ora</dt><dd>{reservationTime}</dd></div>
          <div><dt>Persone</dt><dd>{partySize}</dd></div>
          <div><dt>Stato</dt><dd>Confermata</dd></div>
        </dl>
        <button className="button button-primary" type="button" onClick={() => setResult(null)}>
          Nuova prenotazione
        </button>
      </section>
    );
  }

  return (
    <form className="order-card reservation-form" onSubmit={handleSubmit} noValidate>
      <div className="order-card-heading">
        <div><p className="eyebrow">I tuoi dati</p><h2>Prenota il tavolo</h2></div>
        <span>Conferma immediata</span>
      </div>

      <div className="order-honeypot" aria-hidden="true">
        <label>Non compilare<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="order-fields-grid">
        <label>Nome
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} autoComplete="name" aria-invalid={Boolean(fieldErrors.customerName)} required />
          {fieldErrors.customerName && <span className="order-field-error">{fieldErrors.customerName}</span>}
        </label>
        <label>Telefono
          <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" aria-invalid={Boolean(fieldErrors.customerPhone)} required />
          {fieldErrors.customerPhone && <span className="order-field-error">{fieldErrors.customerPhone}</span>}
        </label>
        <label>Numero persone
          <select value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} aria-invalid={Boolean(fieldErrors.partySize)} required>
            {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {fieldErrors.partySize && <span className="order-field-error">{fieldErrors.partySize}</span>}
        </label>
        <label>Data
          <input type="date" min={minimumDate} value={reservationDate} onChange={(event) => { setReservationDate(event.target.value); setReservationTime(""); }} aria-invalid={Boolean(fieldErrors.reservationDate)} required />
          {fieldErrors.reservationDate && <span className="order-field-error">{fieldErrors.reservationDate}</span>}
        </label>
        <label>Ora
          <select value={reservationTime} onChange={(event) => setReservationTime(event.target.value)} aria-invalid={Boolean(fieldErrors.reservationTime)} required>
            <option value="">Seleziona un orario</option>
            {reservationTimeSlots.map((slot) => (
              <option
                disabled={
                  reservationDate === minimumDate && slot <= currentRomeTime
                }
                key={slot}
                value={slot}
              >
                {slot}
              </option>
            ))}
          </select>
          {allTodaySlotsHavePassed && <span className="optional-label">Per oggi non restano slot: scegli un’altra data.</span>}
          {fieldErrors.reservationTime && <span className="order-field-error">{fieldErrors.reservationTime}</span>}
        </label>
        <label className="order-field-wide">Note <span className="optional-label">facoltative</span>
          <textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} rows={4} maxLength={1000} aria-invalid={Boolean(fieldErrors.customerNotes)} />
          {fieldErrors.customerNotes && <span className="order-field-error">{fieldErrors.customerNotes}</span>}
        </label>
      </div>

      <TurnstileWidget
        action="reservation_submit"
        resetKey={turnstileResetKey}
        onSuccess={(token) => { setTurnstileToken(token); setTurnstileMessage(""); }}
        onExpired={() => { setTurnstileToken(""); setTurnstileMessage("La verifica di sicurezza è scaduta. Riprova."); }}
        onError={() => { setTurnstileToken(""); setTurnstileMessage("Verifica di sicurezza non disponibile. Ricarica la pagina."); }}
      />
      {turnstileMessage && <p className="order-security-message" role="status">{turnstileMessage}</p>}
      {result && !result.success && <div className="order-submit-error" role="alert"><strong>Prenotazione non inviata</strong><p>{result.message}</p></div>}
      <button className="button button-primary order-submit-button" type="submit" disabled={pending || !turnstileToken}>
        {pending ? "Invio in corso…" : "Conferma prenotazione"}
      </button>
      <p className="order-privacy-note">I dati saranno usati esclusivamente per gestire la prenotazione.</p>
    </form>
  );
}
