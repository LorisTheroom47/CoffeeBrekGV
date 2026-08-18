export default function LocationPlaceholder() {
  return (
    <section className="location-placeholder" aria-labelledby="location-title">
      <div className="location-pattern" aria-hidden="true" />
      <div className="location-content">
        <span className="location-icon">
          <svg
            aria-label="Indicatore della posizione"
            role="img"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
            <circle
              cx="12"
              cy="9"
              fill="none"
              r="2.4"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
        </span>
        <p className="location-label">Ci trovi qui</p>
        <h2 id="location-title">Via Pergolesi 33</h2>
        <p>Monza</p>
      </div>
    </section>
  );
}
