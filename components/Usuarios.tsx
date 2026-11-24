"use client";

import { useActionState, useState, useTransition } from "react";
import { desativarLinkPublico, gerarLinkPublico, novoUsuario, removerUsuario, sincronizarAgora, type Resultado } from "@/app/actions";
import { ADV, ADV_KEYS, type AdvKey } from "@/lib/constantes";

export type UsuarioView = { id: string; nome: string; email: string; papel: string; anunciante: string | null; eu: boolean };

export default function Usuarios({ usuarios, link, ultimaSync, webhookPath, origem }: {
  usuarios: UsuarioView[]; link: string | null; ultimaSync: string | null; webhookPath: string; origem: string;
}) {
  const [msg, setMsg] = useState<Resultado>(null);
  const [pend, start] = useTransition();
  const rodar = (fn: () => Promise<Resultado>) => start(async () => setMsg(await fn()));
  const [papel, setPapel] = useState<"gestor" | "admin">("gestor");
  const [, enviar, enviando] = useActionState(async (p: Resultado, f: FormData) => { const r = await novoUsuario(p, f); setMsg(r); return r; }, null);
  const urlLink = link ? `${origem}/relatorio/${link}` : null;

  return (
    <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="h2" style={{ fontSize: 24 }}>Usuários e acesso</h1>
        <p className="muted" style={{ marginTop: 6 }}>Quem entra no painel, o link público e a sincronização com o Kommo.</p>
      </div>
      {msg && <div role="status" className={msg.ok ? "ok" : "erro"}>{msg.msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: 20 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Usuários</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Nome</th><th>Perfil</th><th>Anunciante</th><th></th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td><div style={{ fontWeight: 500 }}>{u.nome}{u.eu ? " (você)" : ""}</div><div style={{ fontSize: 12, color: "#5B6576" }}>{u.email}</div></td>
                    <td>{u.papel === "admin" ? "Admin" : "Gestor de tráfego"}</td>
                    <td>{u.anunciante ? <><span className="dot" style={{ background: ADV[u.anunciante as AdvKey]?.cor }} />{ADV[u.anunciante as AdvKey]?.nome}</> : <span className="muted">Todos</span>}</td>
                    <td>
                      {!u.eu && (
                        <button type="button" className="linkbtn" style={{ color: "#B42318" }} disabled={pend}
                          onClick={() => { if (window.confirm(`Remover o acesso de ${u.email}?`)) rodar(() => removerUsuario(u.id)); }}>Remover</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <form action={enviar} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Criar usuário</h2>
          <label className="field">Nome<input className="input" name="nome" required maxLength={80} /></label>
          <label className="field">E-mail<input className="input" name="email" type="email" required autoComplete="off" /></label>
          <label className="field">Senha inicial (mín. 8)<input className="input" name="senha" type="password" required minLength={8} autoComplete="new-password" /></label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <label className="field">Perfil
              <select className="input" name="papel" value={papel} onChange={(e) => setPapel(e.target.value as "gestor" | "admin")}>
                <option value="gestor">Gestor de tráfego</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {papel === "gestor" && (
              <label className="field">Anunciante
                <select className="input" name="anunciante" required defaultValue="">
                  <option value="" disabled>Escolha…</option>
                  {ADV_KEYS.map((k) => <option key={k} value={k}>{ADV[k].nome}</option>)}
                </select>
              </label>
            )}
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={enviando}>{enviando ? "Criando…" : "Criar usuário"}</button>
        </form>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Painel público</h2>
          <p className="muted">Quem tiver o link vê o relatório sem login. Não mostra nome nem telefone de clientes; os vendedores aparecem como “Vendedor 1, 2…”.</p>
          {urlLink ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <code className="codebox">{urlLink}</code>
              <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(urlLink); setMsg({ ok: true, msg: "Link copiado." }); }}>Copiar</button>
              <a className="btn" href={urlLink} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Abrir</a>
            </div>
          ) : <p className="muted">O painel público está desligado.</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={pend} onClick={() => rodar(gerarLinkPublico)}>{link ? "Gerar novo link" : "Criar link público"}</button>
            {link && <button type="button" className="btn" disabled={pend} onClick={() => { if (window.confirm("Desligar o painel público? O link atual para de funcionar.")) rodar(desativarLinkPublico); }}>Desligar</button>}
          </div>
          {link && <p className="muted" style={{ fontSize: 12 }}>Gerar um novo link desativa o anterior.</p>}
        </section>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Sincronização com o Kommo</h2>
          <p className="muted">Última sincronização: <strong>{ultimaSync ?? "nunca"}</strong>. O painel só lê o Kommo; nada é alterado no CRM.</p>
          <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={pend} onClick={() => rodar(sincronizarAgora)}>
            {pend ? "Sincronizando…" : "Sincronizar agora"}
          </button>
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Para atualizar na hora, cadastre no Kommo (Configurações › Integrações › Webhooks) o endereço
            <code style={{ display: "block", marginTop: 4, overflowWrap: "anywhere" }}>{origem}{webhookPath}</code>
            nos eventos de lead. Sem webhook, o painel sincroniza sozinho a cada poucos minutos.
          </p>
        </section>
      </div>
    </main>
  );
}
