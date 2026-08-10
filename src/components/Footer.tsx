import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer id="contato" className={styles.footer}>
      <div className={`${styles.inner} container`}>
        <div className={styles.bloco}>
          <p className={styles.marca}>Antonina Osteria</p>
          <p>Rua Vinicius Degani 161, Uberlândia — 38408-630</p>
        </div>

        <div className={styles.bloco}>
          <p className={styles.rotulo}>Horário</p>
          <p>Terça a Sexta — 18h30 às 23h30</p>
          <p>Sábados e feriados — 12h às 16h e 18h30 às 23h30</p>
          <p>Domingos e horários especiais: consulte o Instagram</p>
        </div>

        <div className={styles.bloco}>
          <p className={styles.rotulo}>Reservar</p>
          <Link href="/reservar-mesa">Reservar Mesa</Link>
          <Link href="/reservar-evento">Reservar Evento</Link>
        </div>

        <div className={styles.bloco}>
          <a
            href="https://www.instagram.com/antoninaosteria/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
        </div>
      </div>
    </footer>
  );
}
