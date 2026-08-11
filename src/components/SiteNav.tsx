import Link from "next/link";
import { CARDAPIO_URL } from "@/lib/constants";
import styles from "./SiteNav.module.css";

export function SiteNav() {
  return (
    <header className={styles.nav}>
      <div className={`${styles.inner} container`}>
        <Link href="/" className={styles.logo}>
          Antonina Osteria
        </Link>

        <nav className={styles.links} aria-label="Navegação principal">
          <a href={CARDAPIO_URL} target="_blank" rel="noopener noreferrer">
            Cardápio
          </a>
          <Link href="/#eventos">Eventos</Link>
          <Link href="/#contato">Contato</Link>
        </nav>

        <div className={styles.reservar} role="group" aria-label="Reservar">
          <Link href="/reservar-mesa" className={styles.reservarMesa}>
            Mesa
          </Link>
          <Link href="/reservar-evento" className={styles.reservarEvento}>
            Evento
          </Link>
        </div>
      </div>
    </header>
  );
}
