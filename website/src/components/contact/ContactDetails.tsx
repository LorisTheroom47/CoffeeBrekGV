const contactDetails = [
  { label: "Nome", value: "Coffee Break Monza" },
  { label: "Indirizzo", value: "Via Pergolesi 33, Monza" },
  { label: "Servizio", value: "Pranzo" },
  { label: "Telefono", value: "Informazione in aggiornamento" },
  { label: "Email", value: "Informazione in aggiornamento" },
  { label: "Orari", value: "Informazione in aggiornamento" },
];

export default function ContactDetails() {
  return (
    <section className="contact-details-card" aria-labelledby="contact-details-title">
      <p className="eyebrow">Informazioni utili</p>
      <h2 id="contact-details-title">Coffee Break Monza</h2>
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
