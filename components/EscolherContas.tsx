"use client";

import { useState, useTransition } from "react";
import { salvarContasConexao, type Resultado } from "@/app/actions";
import { ADV, ADV_KEYS, type AdvKey } from "@/lib/constantes";

type Conta = { id: string; name: string; ativa: boolean };

/** Avisa a janela do painel que a conexão terminou e fecha o popup. */
function concluir() {
  try { window.opener?.postMessage({ tipo: "meta-conectado" }, window.location.origin); } catch {}
  if (window.opener) window.close();
}

export default function EscolherContas({ erro, conexao, existentes, isAdmin, meuAnunciante }: {
  erro: string | null;
  conexao: { id: number; fbNome: string; contas: Conta[] } | null;
  existentes: Record<string, { anunciante: string; conexaoId: number | null }>;
  isAdmin: boolean;
  meuAnunciante: AdvKey | null;
}) {
  const [msg, setMsg] = useState<Resultado>(null);
  const [pend, start] = useTransition();
  // Nada vem marcado: a pessoa escolhe só as contas da Comafe (o login pode trazer contas de outros clientes).
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({});
  const [donos, setDonos] = useState<Record<string, string>>(() =>
    Object.fromEntries((conexao?.contas ?? []).map((c) => [c.id, meuAnunciante ?? ""])));
  const [busca, setBusca] = useState("");

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/comafe-logo.png" alt="Comafe Autopeças" style={{ height: 34, width: "auto", alignSelf: "flex-start" }} />
  );

  if (erro || !conexao) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {logo}
        <div role="alert" className="erro">{erro ?? "Nada para mostrar."}</div>
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => (window.opener ? window.close() : window.location.assign(window.location.origin + "/anuncios"))}>Fechar</button>
      </div>
    );
  }

  // Já conectadas (por esta ou outra conexão) ficam separadas e não podem ser marcadas de novo.
  const conectadas = conexao.contas.filter((c) => existentes[c.id]?.conexaoId != null);
  const termo = busca.trim().toLowerCase();
  const livres = conexao.contas
    .filter((c) => existentes[c.id]?.conexaoId == null)
    .filter((c) => !termo || c.name.toLowerCase().includes(termo) || c.id.includes(termo.replace(/\D/g, "") || "~"))
    .sort((x, y) => Number(y.ativa) - Number(x.ativa) || x.name.localeCompare(y.name));
  const escolhidas = conexao.contas.filter((c) => marcadas[c.id] && existentes[c.id]?.conexaoId == null);

  const salvar = () => start(async () => {
    const r = await salvarContasConexao(conexao.id, escolhidas.map((c) => ({ contaId: c.id, anunciante: donos[c.id] })));
    setMsg(r);
    if (r?.ok) setTimeout(concluir, 1500);
  });

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {logo}
      <div>
        <h1 className="h2" style={{ fontSize: 20 }}>Conectado como {conexao.fbNome}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {isAdmin ? "Marque as contas de anúncio da Comafe que o painel deve ler e diga de qual anunciante é cada uma."
            : `Marque as suas contas de anúncio da Comafe. Elas ficam ligadas a ${meuAnunciante ? ADV[meuAnunciante].nome : "você"}.`}
          {" "}O painel só lê; nada é alterado no Facebook.
        </p>
      </div>
      {msg && <div role="status" className={msg.ok ? "ok" : "erro"}>{msg.msg}</div>}

      {conexao.contas.length === 0 ? (
        <p className="muted">O Facebook não liberou nenhuma conta de anúncio. Na janela de login, clique em “Editar acesso” e marque as contas.</p>
      ) : (
        <>
          <label className="field">Buscar conta
            <input className="input" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome ou ID da conta" autoFocus />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
            {livres.length === 0 && (
              <p className="muted" style={{ padding: "8px 0" }}>{termo ? "Nenhuma conta encontrada com essa busca." : "Todas as contas liberadas já estão conectadas."}</p>
            )}
            {livres.map((c) => {
              const outro = !!existentes[c.id] && existentes[c.id].anunciante !== (meuAnunciante ?? "") && !isAdmin;
              return (
                <div key={c.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 12px", border: "1px solid " + (marcadas[c.id] ? "#4F7FC6" : "#E2E7EF"), background: marcadas[c.id] ? "#F3F7FD" : "#fff", borderRadius: 12, padding: "10px 12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px", minWidth: 0, cursor: outro ? "not-allowed" : "pointer" }}>
                    <input type="checkbox" checked={!!marcadas[c.id]} disabled={outro} onChange={(e) => setMarcadas({ ...marcadas, [c.id]: e.target.checked })} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, display: "block" }}>{c.name}</span>
                      <span className="mono muted" style={{ fontSize: 11 }}>{c.id}{c.ativa ? "" : " · conta inativa"}</span>
                      {outro && <span style={{ display: "block", fontSize: 12, color: "#B42318" }}>Já é de {ADV[existentes[c.id].anunciante as AdvKey]?.nome}</span>}
                    </span>
                  </label>
                  {isAdmin && marcadas[c.id] && (
                    <select className="input" style={{ height: 36 }} aria-label={`Anunciante da conta ${c.name}`} value={donos[c.id]} onChange={(e) => setDonos({ ...donos, [c.id]: e.target.value })}>
                      <option value="" disabled>De quem é?</option>
                      {ADV_KEYS.map((k) => <option key={k} value={k}>{ADV[k].nome}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          {conectadas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#5B6576" }}>Já conectadas ({conectadas.length})</div>
              {conectadas.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #E2E7EF", background: "#F4F6FA", borderRadius: 12, padding: "8px 12px", fontSize: 13 }}>
                  <span aria-hidden="true" style={{ color: "#146C3A", fontWeight: 700 }}>✓</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span> <span className="mono muted" style={{ fontSize: 11 }}>{c.id}</span>
                  </span>
                  <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                    <span className="dot" style={{ background: ADV[existentes[c.id].anunciante as AdvKey]?.cor }} />{ADV[existentes[c.id].anunciante as AdvKey]?.nome}
                  </span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11 }}>Para trocar o dono ou remover uma conta conectada, use a tela Anúncios.</p>
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary" disabled={pend || escolhidas.length === 0 || (isAdmin && escolhidas.some((c) => !donos[c.id]))} onClick={salvar}>
          {pend ? "Salvando…" : escolhidas.length ? `Conectar ${escolhidas.length} conta(s)` : "Marque as contas"}
        </button>
        <button type="button" className="btn" onClick={concluir}>Fechar</button>
      </div>
    </div>
  );
}
