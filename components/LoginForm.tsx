"use client";

import { useActionState } from "react";
import { entrar } from "@/app/actions";

export default function LoginForm() {
  const [res, acao, pendente] = useActionState(entrar, null);
  return (
    <form action={acao} className="card" style={{ width: "100%", maxWidth: 420, padding: 32, display: "flex", flexDirection: "column", gap: 18 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/comafe-logo.png" alt="Comafe Autopeças" style={{ width: 180, height: "auto", alignSelf: "center" }} />
      <div style={{ textAlign: "center" }}>
        <h1 className="h2" style={{ fontSize: 22 }}>Painel de vendas e tráfego</h1>
        <p className="muted" style={{ marginTop: 6 }}>Entre com o usuário criado pelo administrador</p>
      </div>
      {res && !res.ok && <div role="alert" className="erro">{res.msg}</div>}
      <label className="field">E-mail<input className="input" name="email" type="email" required autoComplete="username" /></label>
      <label className="field">Senha<input className="input" name="senha" type="password" required autoComplete="current-password" /></label>
      <button type="submit" className="btn btn-primary" style={{ height: 44 }} disabled={pendente}>{pendente ? "Entrando…" : "Entrar"}</button>
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>Esqueceu a senha? Peça ao administrador para criar uma nova.</p>
    </form>
  );
}
