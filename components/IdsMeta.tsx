"use client";

import { useActionState, useState, useTransition } from "react";
import { cadastrarId, editarRegistro, reivindicar, removerRegistro, resolverDisputa, type Resultado } from "@/app/actions";
import { ADV, ADV_KEYS, NIVEL_NOME, SIT_NOME, TIPO_NOME, fmt, type AdvKey, type Nivel, type Situacao, type Tipo } from "@/lib/constantes";
import { Seg } from "./Seg";

export type RegistroView = { id: number; nivel: string; metaId: string; nome: string; anunciante: string; tipo: string; situacao: string; leads: number };
export type FilaView = { metaId: string; nivel: "campanha" | "anuncio"; leads: number; desde: string; sugestao: AdvKey | null };
export type DisputaView = { id: number; metaId: string; pedidoPor: string; donoAtual: string | null; nome: string | null };

const TIPO_STYLE: Record<string, React.CSSProperties> = {
  motor: { background: "#E6EEFB", color: "#1B4C9C" }, peca: { background: "#FDEEE3", color: "#8A3A10" },
  misto: { background: "#EEF0F3", color: "#3B4556" }, definir: { background: "#FFF4F2", color: "#B42318", border: "1px dashed #B42318" },
};
const SIT_STYLE: Record<string, React.CSSProperties> = {
  ativa: { background: "#E5F5EC", color: "#146C3A" }, pausada: { background: "#FFF5DB", color: "#7A5A00" }, encerrada: { background: "#EEF0F3", color: "#4B5565" },
};
const proximo = <T,>(l: T[], c: T) => l[(l.indexOf(c) + 1) % l.length];
const DOTS = Object.fromEntries(ADV_KEYS.map((k) => [k, ADV[k].cor]));

export default function IdsMeta({ isAdmin, meuAnunciante, registros, fila, disputas }: {
  isAdmin: boolean; meuAnunciante: AdvKey | null; registros: RegistroView[]; fila: FilaView[]; disputas: DisputaView[];
}) {
  const [msg, setMsg] = useState<Resultado>(null);
  const [pend, start] = useTransition();
  const rodar = (fn: () => Promise<Resultado>) => start(async () => setMsg(await fn()));

  const [form, enviar, enviando] = useActionState(async (prev: Resultado, f: FormData) => {
    const r = await cadastrarId(prev, f);
    setMsg(r);
    return r;
  }, null);
  const [tipo, setTipo] = useState<Tipo>("motor");
  const [sit, setSit] = useState<Situacao>("ativa");
  const [adv, setAdv] = useState<AdvKey>(meuAnunciante ?? "alex");
  const [nivel, setNivel] = useState<Nivel>("campanha");
  const [editando, setEditando] = useState<number | null>(null);

  return (
    <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="h2" style={{ fontSize: 24 }}>{isAdmin ? "IDs do Meta" : `Meus IDs do Meta — ${meuAnunciante ? ADV[meuAnunciante].nome : ""}`}</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          {isAdmin ? "Todos os anunciantes, IDs sem dono e disputas." : "Diga quais campanhas, conjuntos e anúncios são seus e se vendem motor ou peça."}
        </p>
      </div>

      {msg && <div role="status" className={msg.ok ? "ok" : "erro"}>{msg.msg}</div>}

      {isAdmin && disputas.length > 0 && (
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12, borderColor: "#F3B7AE" }}>
          <h2 className="h2">Disputas para decidir</h2>
          {disputas.map((d) => (
            <div key={d.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", border: "1px solid #E2E7EF", borderRadius: 12, padding: "12px 14px" }}>
              <div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{d.metaId}</div>
                <div style={{ fontSize: 12, color: "#5B6576" }}>
                  {d.nome ? `${d.nome} · ` : ""}cadastrado por {d.donoAtual ? ADV[d.donoAtual as AdvKey]?.nome : "—"}, pedido por {ADV[d.pedidoPor as AdvKey]?.nome}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[d.donoAtual, d.pedidoPor].filter((x, i, a) => x && a.indexOf(x) === i).map((x) => (
                  <button key={x} type="button" className="btn" disabled={pend} onClick={() => rodar(() => resolverDisputa(d.id, x!))}>Fica com {ADV[x as AdvKey]?.nome}</button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: 20 }}>
        <form action={enviar} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }} key={form?.ok ? "ok-" + form.msg : "f"}>
          <div>
            <h2 className="h2">Cadastrar ID do Meta</h2>
            <p className="muted" style={{ marginTop: 4 }}>Copie o ID no Gerenciador de Anúncios (coluna “Identificação”) e diga se é motor ou peça</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <label className="field">Nível
              <select className="input" name="nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
                <option value="campanha">Campanha</option>
                <option value="conjunto">Conjunto de anúncios</option>
                <option value="anuncio">Anúncio</option>
              </select>
            </label>
            <label className="field">ID do Meta
              <input className="input" name="metaId" required inputMode="numeric" placeholder="1202…" />
            </label>
          </div>
          <label className="field">Nome para aparecer no painel
            <input className="input" name="nome" maxLength={160} placeholder="Ex.: Venda de motor • SP" />
          </label>
          {isAdmin && (
            <div className="field">Anunciante
              <Seg<AdvKey> label="Anunciante" options={ADV_KEYS.map((k) => [k, ADV[k].nome])} value={adv} onChange={setAdv} dots={DOTS} />
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 32px" }}>
            <div className="field">Tipo<Seg<Tipo> label="Tipo" options={[["motor", "Motor"], ["peca", "Peça"], ["misto", "Misto"]]} value={tipo} onChange={setTipo} /></div>
            <div className="field">Situação<Seg<Situacao> label="Situação" options={[["ativa", "Ativa"], ["pausada", "Pausada"]]} value={sit} onChange={setSit} /></div>
          </div>
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="situacao" value={sit} />
          <input type="hidden" name="anunciante" value={adv} />
          <p className="muted" style={{ fontSize: 12 }}>
            O ID da <strong>conta de anúncios</strong> não aparece no lead do Kommo, por isso o cadastro é por campanha, conjunto ou anúncio. Cadastrar a campanha já cobre todos os anúncios dela.
          </p>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={enviando}>{enviando ? "Cadastrando…" : "Cadastrar ID"}</button>
        </form>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h2 className="h2">IDs sem dono</h2>
            <p className="muted" style={{ marginTop: 4 }}>Apareceram nos leads do Kommo e ninguém cadastrou ainda. Por enquanto entram pela regra do final do ID.</p>
          </div>
          {fila.length === 0 && <p className="muted" style={{ padding: "16px 0" }}>Nenhum ID pendente. Todos os leads de anúncio têm dono.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 460, overflowY: "auto" }}>
            {fila.map((f) => (
              <div key={f.metaId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px", border: "1px solid #E2E7EF", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{f.metaId}</div>
                  <div style={{ fontSize: 12, color: "#5B6576" }}>
                    {NIVEL_NOME[f.nivel]} · {fmt(f.leads)} leads desde {f.desde}{f.sugestao ? ` · provável: ${ADV[f.sugestao].nome}` : ""}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  {isAdmin ? (
                    <>
                      <span style={{ fontSize: 12, color: "#5B6576" }}>Atribuir a:</span>
                      {ADV_KEYS.map((k) => (
                        <button key={k} type="button" className="btn" style={{ height: 34 }} disabled={pend} onClick={() => rodar(() => reivindicar(f.metaId, f.nivel, k))}>{ADV[k].nome}</button>
                      ))}
                    </>
                  ) : (
                    <button type="button" className="btn btn-primary" style={{ height: 34 }} disabled={pend} onClick={() => rodar(() => reivindicar(f.metaId, f.nivel))}>É meu</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", background: "#F4F6FA", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#3B4556", lineHeight: 1.5 }}>
            <strong>Como o painel decide o dono do lead:</strong> procura o ID do anúncio, depois o do conjunto, depois o da campanha. Sem cadastro, usa a regra do final do ID (…0194 Marcos, …0508 Matra, demais Alex) e marca como provisório.
          </div>
        </section>
      </div>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
          <h2 className="h2">{isAdmin ? "IDs cadastrados (todos os anunciantes)" : "Meus IDs cadastrados"}</h2>
          <p className="muted">Clique no tipo ou na situação para trocar; no nome para editar</p>
        </div>
        {registros.length === 0 ? <p className="muted" style={{ padding: "12px 0" }}>Nenhum ID cadastrado ainda.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 880 }}>
              <thead><tr><th>Nível</th><th>ID do Meta</th><th>Nome</th><th>Anunciante</th><th>Tipo</th><th>Situação</th><th className="num">Leads</th><th></th></tr></thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", color: "#3B4556" }}>{NIVEL_NOME[r.nivel as Nivel] ?? r.nivel}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.metaId}</td>
                    <td style={{ fontWeight: 500, minWidth: 200 }}>
                      {editando === r.id ? (
                        <form style={{ display: "flex", gap: 6 }} action={(f) => { setEditando(null); rodar(() => editarRegistro(r.id, { nome: String(f.get("nome") ?? "") })); }}>
                          <input className="input" name="nome" defaultValue={r.nome} autoFocus maxLength={160} style={{ height: 34, flex: 1 }} aria-label="Nome" />
                          <button type="submit" className="btn" style={{ height: 34 }}>Salvar</button>
                        </form>
                      ) : (
                        <button type="button" className="linkbtn" onClick={() => setEditando(r.id)}>{r.nome}</button>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {isAdmin ? (
                        <select className="input" style={{ height: 32 }} value={r.anunciante} aria-label="Anunciante" disabled={pend}
                          onChange={(e) => rodar(() => editarRegistro(r.id, { anunciante: e.target.value }))}>
                          {ADV_KEYS.map((k) => <option key={k} value={k}>{ADV[k].nome}</option>)}
                        </select>
                      ) : (<><span className="dot" style={{ background: ADV[r.anunciante as AdvKey]?.cor }} />{ADV[r.anunciante as AdvKey]?.nome}</>)}
                    </td>
                    <td>
                      <button type="button" className="pill" style={TIPO_STYLE[r.tipo]} disabled={pend}
                        onClick={() => rodar(() => editarRegistro(r.id, { tipo: proximo<string>(["motor", "peca", "misto"], r.tipo === "definir" ? "misto" : r.tipo) }))}>
                        {TIPO_NOME[r.tipo as Tipo] ?? r.tipo}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="pill" style={SIT_STYLE[r.situacao]} disabled={pend}
                        onClick={() => rodar(() => editarRegistro(r.id, { situacao: proximo<string>(["ativa", "pausada", "encerrada"], r.situacao) }))}>
                        {SIT_NOME[r.situacao as Situacao] ?? r.situacao}
                      </button>
                    </td>
                    <td className="num">{fmt(r.leads)}</td>
                    <td>
                      <button type="button" className="linkbtn" style={{ color: "#B42318" }} disabled={pend}
                        onClick={() => { if (window.confirm(`Remover o cadastro ${r.metaId}? Os leads dele voltam para a regra provisória.`)) rodar(() => removerRegistro(r.id)); }}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
