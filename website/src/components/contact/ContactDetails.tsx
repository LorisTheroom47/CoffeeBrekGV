const contactDetails = [
  { label: "Nome", values: [{ text: "Coffee Break GV" }] },
  { label: "Indirizzo", values: [{ text: "Via Pergolesi 33, Monza" }] },
  { label: "Servizio", values: [{ text: "Pranzo" }] },
  {
    label: "Telefono",
    values: [
      { text: "039 233 9799", href: "tel:+390392339799" },
      { text: "348 062 9825", href: "tel:+393480629825" },
    ],
  },
  {
    label: "Email",
    values: [
      { text: "ristogivi@gmail.com", href: "mailto:ristogivi@gmail.com" },
    ],
  },
  { label: "Orari", values: [{ text: "6:30 – 16:30" }] },
  { label: "Ordini", values: [{ text: "ORDINA ENTRO LE 10:00" }] },
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
            <dd>
              {detail.values.map((value, index) => (
                <span key={value.text}>
                  {"href" in value ? (
                    <a href={value.href}>{value.text}</a>
                  ) : (
                    value.text
                  )}
                  {index < detail.values.length - 1 ? <br /> : null}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
