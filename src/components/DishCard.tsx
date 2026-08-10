import Image from "next/image";
import styles from "./DishCard.module.css";

interface DishCardProps {
  nome: string;
  descricao: string;
  preco: number;
  imagemSrc: string;
  imagemAlt: string;
}

export function DishCard({ nome, descricao, preco, imagemSrc, imagemAlt }: DishCardProps) {
  return (
    <article className={styles.card}>
      <Image
        src={imagemSrc}
        alt={imagemAlt}
        width={320}
        height={320}
        className={styles.imagem}
      />
      <h3 className={styles.nome}>{nome}</h3>
      <p className={styles.descricao}>{descricao}</p>
      <p className={styles.preco}>R$ {preco.toFixed(2)}</p>
    </article>
  );
}
