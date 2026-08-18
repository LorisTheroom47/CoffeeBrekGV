type MenuUnavailableProps = {
  variant?: "default" | "tv";
};

export default function MenuUnavailable({
  variant = "default",
}: MenuUnavailableProps) {
  return (
    <section
      className={`menu-unavailable${
        variant === "tv" ? " menu-unavailable-tv" : ""
      }`}
      aria-labelledby={`menu-unavailable-title-${variant}`}
    >
      <div className={variant === "default" ? "site-container" : undefined}>
        <h2 id={`menu-unavailable-title-${variant}`}>
          Il menu non è temporaneamente disponibile.
        </h2>
        <p>Ti invitiamo a riprovare più tardi.</p>
      </div>
    </section>
  );
}
