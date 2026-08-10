import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "@/components/SiteNav";
import { Footer } from "@/components/Footer";
import { DishCard } from "@/components/DishCard";
import styles from "./page.module.css";

const CARDAPIO_URL = "https://cardapio.pedyun.com.br/antoninaosteria";

const PRATOS_DESTAQUE = [
  {
    nome: "Arancini",
    descricao: "Bolinho de risoto com molho de tomate pelado recheado com queijo.",
    preco: 42,
    imagemSrc: "/images/prato-arancini.jpg",
    imagemAlt: "Arancini servido em prato de madeira",
  },
  {
    nome: "Burrata al Pesto",
    descricao: "Burrata com pesto, raspas de limão siciliano, parma e rúculas. Acompanha torradas.",
    preco: 98,
    imagemSrc: "/images/prato-burrata.jpg",
    imagemAlt: "Burrata al Pesto com folhas de rúcula",
  },
  {
    nome: "Cacio e Pepe",
    descricao: "Spaghetti tradicional Cacio e Pepe.",
    preco: 78,
    imagemSrc: "/images/prato-cacio-e-pepe.jpg",
    imagemAlt: "Prato de spaghetti Cacio e Pepe",
  },
  {
    nome: "Banoffee Antonina",
    descricao: "Banoffee feita com doce de leite da casa, farofa crocante com toque de mascarpone.",
    preco: 42,
    imagemSrc: "/images/prato-banoffee.jpg",
    imagemAlt: "Sobremesa Banoffee Antonina",
  },
];

const GALERIA = [
  { src: "/images/interior-salao.jpg", alt: "Salão interno do Antonina Osteria" },
  { src: "/images/interior-terraco.jpg", alt: "Terraço externo do Antonina Osteria" },
  { src: "/images/mezanino.jpg", alt: "Mezanino, espaço de eventos do Antonina Osteria" },
  { src: "/images/hero-fachada.jpg", alt: "Fachada do Antonina Osteria" },
];

export default function HomePage() {
  return (
    <>
      <SiteNav />

      <main>
        <section className={styles.hero}>
          <Image
            src="/images/hero-fachada.jpg"
            alt="Fachada do Antonina Osteria ao entardecer"
            fill
            priority
            className={styles.heroImagem}
          />
          <div className={styles.heroOverlay} />
          <div className={`${styles.heroConteudo} container`}>
            <h1 className={styles.heroTitulo}>Antonina Osteria</h1>
            <p className={styles.heroTagline}>1ª Osteria Tartuferia de Uberlândia</p>
            <p className={styles.heroSubtexto}>
              Cozinha italiana autoral com trufa em cada etapa do menu. Terça a domingo, no
              coração de Uberlândia.
            </p>
          </div>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>Osteria Tartuferia</h2>
          <p className={styles.textoLongo}>
            Osteria Tartuferia significa um compromisso simples: trazer a trufa pra mesa em cada
            prato que faz sentido, sem exagero. No Antonina, isso vira arancini, burrata, massas
            feitas na casa e um andar de cima reservado pra celebrar — o Mezanino, nosso espaço de
            eventos.
          </p>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>Destaques do cardápio</h2>
          <div className={styles.gradePratos}>
            {PRATOS_DESTAQUE.map((prato) => (
              <DishCard key={prato.nome} {...prato} />
            ))}
          </div>
          <a href={CARDAPIO_URL} target="_blank" rel="noopener noreferrer" className={styles.linkCardapio}>
            Ver cardápio completo
          </a>
        </section>

        <section className={`${styles.secaoPapel} container`}>
          <h2>O espaço</h2>
          <div className={styles.gradeGaleria}>
            {GALERIA.map((foto) => (
              <Image
                key={foto.src}
                src={foto.src}
                alt={foto.alt}
                width={400}
                height={300}
                className={styles.fotoGaleria}
              />
            ))}
          </div>
          <a
            href="https://my.matterport.com/show/?m=noadeK6Syis"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkTour}
          >
            Ver tour virtual 3D
          </a>
        </section>

        <section id="eventos" className={styles.secaoEscura}>
          <div className="container">
            <h2 className={styles.tituloEscuro}>Mezanino — eventos privados</h2>
            <p className={styles.textoEscuro}>
              O Mezanino é o nosso espaço para aniversários, jantares corporativos e celebrações
              fechadas — até 40 convidados, cardápio dedicado e equipamento de telão disponível.
              Reserve a data e cuidamos do resto.
            </p>
            <Link href="/reservar-evento" className={styles.botaoDourado}>
              Reservar Evento
            </Link>
          </div>
        </section>

        <section className={styles.secaoEscura}>
          <div className="container">
            <h2 className={styles.tituloEscuro}>Venha nos visitar</h2>
            <p className={styles.textoEscuro}>Rua Vinicius Degani 161, Uberlândia — 38408-630</p>
            <p className={styles.textoEscuro}>Terça a Sexta — 18h30 às 23h30</p>
            <p className={styles.textoEscuro}>
              Sábados e feriados — 12h às 16h e 18h30 às 23h30
            </p>
            <div className={styles.ctaFinal}>
              <Link href="/reservar-mesa" className={styles.botaoDourado}>
                Reservar Mesa
              </Link>
              <Link href="/reservar-evento" className={styles.botaoContorno}>
                Reservar Evento
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
