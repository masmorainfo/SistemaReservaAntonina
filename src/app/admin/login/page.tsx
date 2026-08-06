"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const resultado = await signIn("credentials", { email, senha, redirect: false });
      if (resultado?.error) {
        setErro("e-mail ou senha inválidos");
        return;
      }
      router.push("/admin/mapa-do-dia");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={handleSubmit}>
        {erro && <p role="alert">{erro}</p>}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <button type="submit" disabled={carregando}>
          Entrar
        </button>
      </form>
    </main>
  );
}
