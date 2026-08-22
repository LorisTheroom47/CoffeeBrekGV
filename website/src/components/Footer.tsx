import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-main">
        <div>
          <p className="footer-brand">Coffee Break GV</p>
          <p>Via Pergolesi 33, Monza</p>
        </div>
        <nav aria-label="Navigazione nel piè di pagina">
          <Link href="/">Home</Link>
          <Link href="/menu">Menu del giorno</Link>
          <Link href="/contatti">Contatti</Link>
        </nav>
      </div>
      <div className="site-container footer-bottom">
        <p>© {currentYear} Coffee Break GV</p>
        <p>Sito in fase di sviluppo</p>
      </div>
    </footer>
  );
}
