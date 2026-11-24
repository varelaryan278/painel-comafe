"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { desconectarMeta, reatribuirConta, type Resultado } from "@/app/actions";
import { ADV, ADV_KEYS, type AdvKey } from "@/lib/constantes";

export type ConexaoView = {
  id: number; fbNome: string; conectadoPor: string; meu: boolean; expiraEm: number | null; invalida: boolean;
  contas: { id: string; nome: string; anunciante: string; erro: string | null }[];
};

/** Abre o login do Facebook num popup centralizado. */
export function abrirConexao() {
  const w = 600, h = 720;
  const x = window.screenX + (window.outerWidth - w) / 2, y = window.screenY + (window.outerHeight - h) / 2;
  const pop = window.open("/api/meta/conectar", "conectar-facebook", `width=${w},height=${h},left=${x},top=${y}`);
  if (!pop) window.location.assign(window.location.origin + "/api/meta/conectar"); // popup bloqueado: segue na mesma aba
}

const dias = (s: number) => Math.round((s * 1000 - Date.now()) / 86400000);

export default function ConexoesMeta({ conexoes, appOk, isAdmin, contasEnv }: {
  conexoes: ConexaoView[]; appOk: boolean; isAdmin: boolean; contasEnv: { id: string; nome: string; anunciante: string }[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Resultado>(null);
  const [pend, start] = useTransition();
  const rodar = (fn: () => Promise<Resultado>) => start(async () => setMsg(await fn()));

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.tipo === "meta-conectado") {
        setMsg({ ok: true, msg: "Contas conectadas. Os anúncios aparecem assim que a importação terminar." });
        router.refresh();
      }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [router]);

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="h2">Contas do Meta conectadas</h2>
          <p className="muted" style={{ marginTop: 4 }}>Cada conta conectada define o dono de tudo que roda nela. O painel só lê; nada muda no Facebook.</p>
        </div>
        {appOk ? (
          <button type="button" className="btn btn-primary" onClick={abrirConexao} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>
            Conectar com Facebook
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 12, maxWidth: 360 }}>
            Botão de conexão desligado: falta configurar o app do Facebook no <code>.env</code> (META_APP_ID e META_APP_SECRET).
          </span>
        )}
      </div>
      {msg && <div role="status" className={msg.ok ? "ok" : "erro"}>{msg.msg}</div>}

      {conexoes.length === 0 && contasEnv.length === 0 && <p className="muted">Nenhuma conta conectada ainda.</p>}

      {conexoes.map((c) => {
        const d = c.expiraEm ? dias(c.expiraEm) : null;
        const alerta = c.invalida || (d !== null && d <= 7);
        return (
          <div key={c.id} style={{ border: "1px solid " + (alerta ? "#F3B7AE" : "#E2E7EF"), borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, background: alerta ? "#FFF8F6" : "#fff" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" }}>
              <strong>{c.fbNome}</strong>
              <span className="muted" style={{ fontSize: 12 }}>conectado por {c.conectadoPor}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: alerta ? "#B42318" : "#146C3A" }}>
                {c.invalida ? "Acesso expirou — reconecte" : d === null ? "" : d <= 0 ? "Expira hoje — reconecte" : `Válido por mais ${d} dia(s)`}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {(c.meu || isAdmin) && appOk && c.meu && <button type="button" className="btn" style={{ height: 32 }} onClick={abrirConexao}>Reconectar</button>}
                {(c.meu || isAdmin) && (
                  <button type="button" className="btn" style={{ height: 32 }} disabled={pend}
                    onClick={() => { if (window.confirm(`Remover o acesso de ${c.fbNome}? Os anúncios dessas contas param de atualizar.`)) rodar(() => desconectarMeta(c.id)); }}>
                    Desconectar
                  </button>
                )}
              </div>
            </div>
            {c.contas.length === 0 ? <span className="muted" style={{ fontSize: 12 }}>Nenhuma conta escolhida. Clique em Reconectar para escolher.</span> : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {c.contas.map((ct) => <ContaChip key={ct.id} conta={ct} isAdmin={isAdmin} pend={pend} onDono={(a) => rodar(() => reatribuirConta(ct.id, a))} />)}
              </div>
            )}
          </div>
        );
      })}

      {contasEnv.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12 }}>Pelo token do servidor (.env):</span>
          {contasEnv.map((ct) => <ContaChip key={ct.id} conta={{ ...ct, erro: null }} isAdmin={false} pend={pend} onDono={() => {}} />)}
        </div>
      )}
    </section>
  );
}

function ContaChip({ conta, isAdmin, pend, onDono }: { conta: { id: string; nome: string; anunciante: string; erro: string | null }; isAdmin: boolean; pend: boolean; onDono: (a: string) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #E2E7EF", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13 }} title={conta.erro ?? conta.id}>
      <span className="dot" style={{ background: ADV[conta.anunciante as AdvKey]?.cor ?? "#8A94A6", marginRight: 0 }} />
      {conta.nome}
      {conta.erro && <span style={{ color: "#B42318", fontSize: 11 }}>erro</span>}
      {isAdmin ? (
        <select className="input" style={{ height: 28, fontSize: 12, padding: "0 6px" }} value={conta.anunciante} disabled={pend} aria-label={`Dono da conta ${conta.nome}`}
          onChange={(e) => onDono(e.target.value)}>
          {ADV_KEYS.map((k) => <option key={k} value={k}>{ADV[k].nome}</option>)}
        </select>
      ) : <span className="muted" style={{ fontSize: 12, paddingRight: 6 }}>{ADV[conta.anunciante as AdvKey]?.nome}</span>}
    </span>
  );
}
