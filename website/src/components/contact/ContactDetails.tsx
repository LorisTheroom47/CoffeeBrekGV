const contactDetails = [
  { label: "Nome", value: "Coffee Break GV" },
  { label: "Indirizzo", value: "Via Pergolesi 33, Monza" },
  { label: "Servizio", value: "Pranzo" },
  { label: "Telefono", value: "039 223 39799 · 348 062 9825" },
  { label: "Email", value: "Informazione in aggiornamento" },
  { label: "Orari", value: "7:00 – 16:00" },
  { label: "Ordini", value: "Gli ordini devono essere effettuati entro le 10:00." },
];

export default function ContactDetails() {
  return (
    <section className="contact-details-card" aria-labelledby="contact-details-title">
      <p className="eyebrow">Informazioni utili</p>
      <h2 id="contact-details-title">Coffee Break GV</h2>
      <dl className="contact-details-list">
        {contactDetails.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
