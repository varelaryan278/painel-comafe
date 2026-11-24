"use client";

import { useActionState } from "react";
import { trocarSenha } from "@/app/actions";

export default function ContaForm() {
  const [res, acao, pendente] = useActionState(trocarSenha, null);
  return (
    <form action={acao} className="card" style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 14 }} key={res?.ok ? "ok" : "f"}>
      <h2 className="h2">Trocar senha</h2>
      {res && <div role="status" className={res.ok ? "ok" : "erro"}>{res.msg}</div>}
      <label className="field">Senha atual<input className="input" name="atual" type="password" required autoComplete="current-password" /></label>
      <label className="field">Nova senha (mín. 8)<input className="input" name="nova" type="password" required minLength={8} autoComplete="new-password" /></label>
      <label className="field">Repita a nova senha<input className="input" name="confirma" type="password" required minLength={8} autoComplete="new-password" /></label>
      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={pendente}>{pendente ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
