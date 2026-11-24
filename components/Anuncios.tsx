"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { definirTipoEmLote, limparTipo, sincronizarMetaAgora, type Resultado } from "@/app/actions";
import type { AnuncioView, CampanhaView, ConjuntoView, ContaView, Numeros, SemVinculo } from "@/lib/anuncios";
import { ADV, ADV_KEYS, TIPO_NOME, fmt, money, type AdvKey, type Tipo } from "@/lib/constantes";
import { Seg } from "./Seg";

type Nivel = "campanha" | "conjunto" | "anuncio";
type Sel = Map<string, Nivel>;
type Detalhe = { conta: ContaView; camp: CampanhaView; set: ConjuntoView; ad: AnuncioView };
type LeadRec = { id: number; em: number; etapa: string; vendedor: string; valor: number };

const FORMATOS: [string, string][] = [
  ["MOBILE_FEED_STANDARD", "Feed Facebook"], ["INSTAGRAM_STANDARD", "Feed Instagram"],
  ["INSTAGRAM_STORY", "Stories Instagram"], ["INSTAGRAM_REELS", "Reels Instagram"], ["FACEBOOK_STORY_MOBILE", "Stories Facebook"],
];
const TIPO_STYLE: Record<string, React.CSSProperties> = {
  motor: { background: "#E6EEFB", color: "#1B4C9C" }, peca: { background: "#FDEEE3", color: "#8A3A10" },
  misto: { background: "#EEF0F3", color: "#3B4556" }, definir: { background: "#FFF4F2", color: "#B42318" },
};
const ativo = (s: string | null) => s === "ACTIVE";
const STATUS_NOME: Record<string, string> = {
  ACTIVE: "Ativo", PAUSED: "Pausado", CAMPAIGN_PAUSED: "Campanha pausada", ADSET_PAUSED: "Conjunto pausado",
  DELETED: "Excluído", ARCHIVED: "Arquivado", IN_PROCESS: "Em análise", WITH_ISSUES: "Com problemas", DISAPPROVED: "Reprovado", PENDING_REVIEW: "Em análise",
};
/** Opção sem token: abre o anúncio no Gerenciador do Meta num popup (usa o login de Facebook da própria pessoa). */
function abrirGerenciador(contaId: string, adId: string) {
  const url = `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${contaId.replace("act_", "")}&selected_ad_ids=${adId}`;
  const w = Math.min(1280, window.outerWidth - 80), h = Math.min(860, window.outerHeight - 80);
  window.open(url, "gerenciador-meta", `width=${w},height=${h},left=${window.screenX + 40},top=${window.screenY + 40}`);
}
const cpl = (n: Numeros) => (n.gasto > 0 && n.leads > 0 ? money(n.gasto / n.leads) : "—");
const ha = (s: number | null) => {
  if (!s) return "nenhum lead no período";
  const m = Math.round((Date.now() / 1000 - s) / 60);
  if (m < 60) return `último lead há ${m} min`;
  if (m < 1440) return `último lead há ${Math.round(m / 60)} h`;
  return `último lead há ${Math.round(m / 1440)} d`;
};

export default function Anuncios({ arvore, semVinculo, isAdmin, metaOk, ultimaMeta }: {
  arvore: ContaView[]; semVinculo: SemVinculo[]; isAdmin: boolean; metaOk: boolean; ultimaMeta: string | null;
}) {
  const [msg, setMsg] = useState<Resultado>(null);
  const [pend, start] = useTransition();
  const rodar = (fn: () => Promise<Resultado>) => start(async () => { const r = await fn(); setMsg(r); if (r?.ok) setSel(new Map()); });

  const [adv, setAdv] = useState<"todos" | AdvKey>("todos");
  const [sit, setSit] = useState<"ativos" | "todos">("ativos");
  const [tipo, setTipo] = useState<"todos" | "sem" | "motor" | "peca">("todos");
  const [comLeads, setComLeads] = useState(false);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Sel>(new Map());
  const [det, setDet] = useState<Detalhe | null>(null);

  const passaAd = (a: AnuncioView) =>
    (sit === "todos" || ativo(a.status) || a.n.leads > 0) &&
    (tipo === "todos" || (tipo === "sem" ? !a.tipo || a.tipo === "definir" : a.tipo === tipo)) &&
    (!comLeads || a.n.leads > 0) &&
    (!busca || (a.nome + " " + a.id + " " + (a.titulo ?? "")).toLowerCase().includes(busca.toLowerCase()));

  const visivel = useMemo(() => arvore
    .filter((c) => adv === "todos" || c.anunciante === adv)
    .map((c) => ({
      ...c,
      campanhas: c.campanhas.map((cp) => ({
        ...cp,
        conjuntos: cp.conjuntos.map((st) => ({ ...st, anuncios: st.anuncios.filter(passaAd) })).filter((st) => st.anuncios.length),
      })).filter((cp) => cp.conjuntos.length),
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [arvore, adv, sit, tipo, comLeads, busca]);

  const alternar = (id: string, nivel: Nivel) => setSel((s) => { const n = new Map(s); if (n.has(id)) n.delete(id); else n.set(id, nivel); return n; });
  const totalAds = visivel.reduce((t, c) => t + c.campanhas.reduce((u, cp) => u + cp.conjuntos.reduce((v, st) => v + st.anuncios.length, 0), 0), 0);

  if (arvore.length === 0) {
    return (
      <>
        <p className="muted" style={{ padding: "8px 0" }}>
          {metaOk ? "Nenhum anúncio importado ainda. Conecte uma conta acima ou clique em “Atualizar do Meta”." : "Conecte as contas de anúncio acima para ver os anúncios, vídeos e prévias."}
        </p>
        {semVinculo.length > 0 && <SemVinculoCard itens={semVinculo} />}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: sel.size ? 90 : 0 }}>
      {msg && <div role="status" className={msg.ok ? "ok" : "erro"}>{msg.msg}</div>}

      <div className="card" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "14px 24px" }}>
        {isAdmin && (
          <div className="field">Anunciante
            <Seg<"todos" | AdvKey> label="Anunciante" options={[["todos", "Todos"], ...ADV_KEYS.map((k) => [k, ADV[k].nome] as ["todos" | AdvKey, string])]}
              value={adv} onChange={setAdv} dots={{ alex: ADV.alex.cor, marcos: ADV.marcos.cor, matra: ADV.matra.cor }} />
          </div>
        )}
        <div className="field">Situação<Seg label="Situação" options={[["ativos", "Ativos ou com leads"], ["todos", "Todos"]]} value={sit} onChange={setSit} /></div>
        <div className="field">Tipo<Seg label="Tipo" options={[["todos", "Todos"], ["sem", "Sem tipo"], ["motor", "Motor"], ["peca", "Peça"]]} value={tipo} onChange={setTipo} /></div>
        <label className="field">Buscar<input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome ou ID" style={{ width: 200 }} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, height: 40 }}>
          <input type="checkbox" checked={comLeads} onChange={(e) => setComLeads(e.target.checked)} /> Só com leads
        </label>
        {isAdmin && (
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <button type="button" className="btn" disabled={pend} onClick={() => rodar(sincronizarMetaAgora)}>{pend ? "Atualizando…" : "Atualizar do Meta"}</button>
            <span className="muted" style={{ fontSize: 11 }}>{ultimaMeta ? `Meta lido em ${ultimaMeta}` : "Meta ainda não lido"}</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {arvore.filter((c) => adv === "todos" || c.anunciante === adv).map((c) => (
          <div key={c.id} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}><span className="dot" style={{ background: ADV[c.anunciante].cor }} />{ADV[c.anunciante].nome}</div>
            <div style={{ fontSize: 12, color: "#5B6576" }}>{c.nome} · {c.id}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{fmt(c.n.leads)} leads · {money(c.n.gasto)} · CPL {cpl(c.n)}</div>
            {c.erro && <div style={{ fontSize: 12, color: "#B42318" }}>Erro ao ler: {c.erro}</div>}
          </div>
        ))}
      </div>

      {semVinculo.length > 0 && <SemVinculoCard itens={semVinculo} />}

      <p className="muted">{fmt(totalAds)} anúncios na lista. Marque anúncios, conjuntos ou campanhas e escolha o tipo na barra de baixo.</p>

      {visivel.map((c) => c.campanhas.map((cp) => (
        <details key={cp.id} className="card" open style={{ padding: 0 }}>
          <summary style={{ listStyle: "none", cursor: "pointer", padding: "14px 18px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", borderBottom: "1px solid #EEF1F5" }}>
            <input type="checkbox" aria-label={`Selecionar campanha ${cp.nome}`} checked={sel.has(cp.id)} onClick={(e) => e.stopPropagation()} onChange={() => alternar(cp.id, "campanha")} />
            <span className="dot" style={{ background: ADV[c.anunciante].cor }} />
            <span style={{ fontWeight: 600 }}>{cp.nome}</span>
            <StatusPill s={cp.status} />
            <TipoPill tipo={cp.tipo} />
            <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>Campanha · {fmt(cp.n.leads)} leads · {fmt(cp.n.vendas)} vendas · {money(cp.n.gasto)} · CPL {cpl(cp.n)}</span>
          </summary>
          <div style={{ padding: "8px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            {cp.conjuntos.map((st) => (
              <div key={st.id}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px", margin: "8px 0" }}>
                  <input type="checkbox" aria-label={`Selecionar conjunto ${st.nome}`} checked={sel.has(st.id)} onChange={() => alternar(st.id, "conjunto")} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#3B4556" }}>Conjunto: {st.nome}</span>
                  <StatusPill s={st.status} />
                  <span className="muted" style={{ fontSize: 12 }}>{fmt(st.n.leads)} leads · {money(st.n.gasto)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 10 }}>
                  {st.anuncios.map((a) => (
                    <div key={a.id} style={{ border: "1px solid " + (sel.has(a.id) ? "#4F7FC6" : "#E2E7EF"), borderRadius: 12, padding: 10, display: "grid", gridTemplateColumns: "auto 84px minmax(0, 1fr)", gap: 10, alignItems: "start", background: sel.has(a.id) ? "#F3F7FD" : "#fff" }}>
                      <input type="checkbox" aria-label={`Selecionar anúncio ${a.nome}`} checked={sel.has(a.id)} onChange={() => alternar(a.id, "anuncio")} style={{ marginTop: 4 }} />
                      <button type="button" onClick={() => setDet({ conta: c, camp: cp, set: st, ad: a })} aria-label={`Ver prévia de ${a.nome}`}
                        style={{ position: "relative", width: 84, height: 84, padding: 0, border: 0, borderRadius: 8, overflow: "hidden", background: "#EEF1F5", cursor: "pointer" }}>
                        {a.thumb
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={a.thumb} alt="" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: 11, color: "#5B6576" }}>sem imagem</span>}
                        {a.video && <span style={{ position: "absolute", left: 4, bottom: 4, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "1px 5px" }}>VÍDEO</span>}
                      </button>
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.nome}>{a.nome}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          <StatusPill s={a.status} />
                          <TipoPill tipo={a.tipo} herdado={a.tipoNivel && a.tipoNivel !== "anuncio" ? a.tipoNivel : null} />
                        </div>
                        <div style={{ fontSize: 12, color: "#3B4556" }}>{fmt(a.n.leads)} leads · {fmt(a.n.vendas)} vendas · CPL {cpl(a.n)}</div>
                        <div style={{ fontSize: 11, color: "#5B6576" }}>{ha(a.n.ultimo)}</div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <button type="button" className="linkbtn" style={{ fontSize: 12, fontWeight: 600 }} onClick={() => setDet({ conta: c, camp: cp, set: st, ad: a })}>Ver prévia e leads →</button>
                          <button type="button" className="linkbtn" style={{ fontSize: 12 }} onClick={() => abrirGerenciador(c.id, a.id)}>Gerenciador ↗</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )))}

      {totalAds === 0 && <p className="muted" style={{ padding: 20, textAlign: "center" }}>Nenhum anúncio com esses filtros.</p>}

      {sel.size > 0 && (
        <div role="region" aria-label="Ações em lote" style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#172033", color: "#fff", padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", zIndex: 20 }}>
          <strong>{sel.size} selecionado(s)</strong>
          <span style={{ color: "#C9D1DE", fontSize: 13 }}>Marcar como:</span>
          {(["motor", "peca", "misto"] as Tipo[]).map((t) => (
            <button key={t} type="button" className="btn" disabled={pend}
              onClick={() => rodar(() => definirTipoEmLote([...sel.entries()].map(([metaId, nivel]) => ({ metaId, nivel })), t))}>{TIPO_NOME[t]}</button>
          ))}
          <button type="button" className="btn" style={{ marginLeft: "auto", background: "transparent", color: "#fff", borderColor: "#5B6576" }} onClick={() => setSel(new Map())}>Limpar seleção</button>
        </div>
      )}

      {det && <Previa det={det} onClose={() => setDet(null)} onLimpar={(id) => rodar(() => limparTipo(id))} onTipo={(t) => rodar(() => definirTipoEmLote([{ metaId: det.ad.id, nivel: "anuncio" }], t))} pend={pend} />}
    </div>
  );
}

function StatusPill({ s }: { s: string | null }) {
  if (!s) return null;
  const on = s === "ACTIVE";
  return <span className="pill" style={{ height: 22, fontSize: 11, cursor: "default", background: on ? "#E5F5EC" : "#EEF0F3", color: on ? "#146C3A" : "#4B5565" }}>{STATUS_NOME[s] ?? s}</span>;
}

function TipoPill({ tipo, herdado }: { tipo: string | null; herdado?: string | null }) {
  if (!tipo || tipo === "definir") return <span className="pill" style={{ height: 22, fontSize: 11, cursor: "default", background: "#FFF4F2", color: "#B42318", border: "1px dashed #B42318" }}>Sem tipo</span>;
  return (
    <span className="pill" style={{ height: 22, fontSize: 11, cursor: "default", ...TIPO_STYLE[tipo] }} title={herdado ? `Definido no(a) ${herdado}` : undefined}>
      {TIPO_NOME[tipo as Tipo]}{herdado ? ` · pelo(a) ${herdado}` : ""}
    </span>
  );
}

function SemVinculoCard({ itens }: { itens: SemVinculo[] }) {
  return (
    <section className="card" style={{ borderColor: "#F0D58A", background: "#FFFCF2", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h2 className="h2">Chegando sem vínculo</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Anúncios que mandaram lead no período mas não estão em nenhuma conta do Meta conectada. Geralmente é uma conta que ainda não liberou o usuário do sistema.
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl" style={{ minWidth: 560 }}>
          <thead><tr><th>ID do anúncio</th><th>Campanha (ID)</th><th>Provável dono (final do ID)</th><th className="num">Leads</th><th>Último</th></tr></thead>
          <tbody>
            {itens.slice(0, 30).map((x) => (
              <tr key={x.adId}>
                <td className="mono" style={{ fontSize: 12 }}>{x.adId}</td>
                <td className="mono" style={{ fontSize: 12 }}>{x.campanhaId ?? "—"}</td>
                <td><span className="dot" style={{ background: ADV[x.provavel].cor }} />{ADV[x.provavel].nome}</td>
                <td className="num">{fmt(x.leads)}</td>
                <td style={{ fontSize: 12 }}>{new Date(x.ultimo * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Previa({ det, onClose, onTipo, onLimpar, pend }: { det: Detalhe; onClose: () => void; onTipo: (t: Tipo) => void; onLimpar: (id: string) => void; pend: boolean }) {
  const [formato, setFormato] = useState("MOBILE_FEED_STANDARD");
  const chave = det.ad.id + "|" + formato;
  const [dados, setDados] = useState<{ k: string; previa: string | null; erroPrevia: string | null; leads: LeadRec[] } | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/anuncios/${det.ad.id}?formato=${formato}`)
      .then((r) => r.json())
      .then((j) => vivo && setDados({ k: chave, ...j }))
      .catch(() => vivo && setDados({ k: chave, previa: null, erroPrevia: "Falha ao carregar.", leads: [] }));
    return () => { vivo = false; };
  }, [chave, det.ad.id, formato]);
  const pronto = dados?.k === chave ? dados : null;
  const { ad, camp, set, conta } = det;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Prévia de ${ad.nome}`} onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(23,32,51,.55)", zIndex: 30, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 1080, display: "flex", flexWrap: "wrap", gap: 24, padding: 24 }}>
        <div style={{ flex: "0 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field">Formato da prévia
            <select className="input" value={formato} onChange={(e) => setFormato(e.target.value)}>
              {FORMATOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div style={{ background: "#F4F6FA", borderRadius: 12, minHeight: 560, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {!pronto ? <span className="muted">Carregando prévia…</span>
              : pronto.previa ? <iframe title={`Prévia de ${ad.nome}`} src={pronto.previa} style={{ width: "100%", height: 620, border: 0 }} sandbox="allow-scripts allow-same-origin allow-popups" referrerPolicy="no-referrer" />
              : <span className="muted" style={{ padding: 20, textAlign: "center" }}>{pronto.erroPrevia}</span>}
          </div>
        </div>
        <div style={{ flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="h2" style={{ fontSize: 19 }}>{ad.nome}</h2>
              {ad.titulo && <p className="muted" style={{ marginTop: 4 }}>{ad.titulo}</p>}
            </div>
            <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>Fechar</button>
          </div>
          <table className="tbl"><tbody>
            <tr><td className="muted">Dono</td><td><span className="dot" style={{ background: ADV[conta.anunciante].cor }} /><strong>{ADV[conta.anunciante].nome}</strong> <span className="muted">(pela conta do Meta)</span></td></tr>
            <tr><td className="muted">Conta</td><td>{conta.nome} <span className="mono muted" style={{ fontSize: 11 }}>{conta.id}</span></td></tr>
            <tr><td className="muted">Campanha</td><td>{camp.nome} <span className="mono muted" style={{ fontSize: 11 }}>{camp.id}</span></td></tr>
            <tr><td className="muted">Conjunto</td><td>{set.nome} <span className="mono muted" style={{ fontSize: 11 }}>{set.id}</span></td></tr>
            <tr><td className="muted">Anúncio</td><td className="mono" style={{ fontSize: 12 }}>{ad.id}</td></tr>
            <tr><td className="muted">Situação</td><td><StatusPill s={ad.status} /></td></tr>
            <tr><td className="muted">Tipo</td><td><TipoPill tipo={ad.tipo} herdado={ad.tipoNivel && ad.tipoNivel !== "anuncio" ? ad.tipoNivel : null} /></td></tr>
          </tbody></table>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#5B6576" }}>Marcar este anúncio:</span>
            {(["motor", "peca", "misto"] as Tipo[]).map((t) => <button key={t} type="button" className="btn" style={{ height: 34 }} disabled={pend} onClick={() => onTipo(t)}>{TIPO_NOME[t]}</button>)}
            {ad.tipoNivel === "anuncio" && <button type="button" className="linkbtn" style={{ fontSize: 12 }} disabled={pend} onClick={() => onLimpar(ad.id)}>usar o tipo da campanha</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {[["Leads", fmt(ad.n.leads)], ["Cotações", fmt(ad.n.cot)], ["Vendas", fmt(ad.n.vendas)], ["Investido", money(ad.n.gasto)]].map(([l, v]) => (
              <div key={l} style={{ background: "#F4F6FA", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "#5B6576" }}>{l}</div><div style={{ fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Últimos leads que chegaram deste anúncio</div>
            {!pronto ? <p className="muted">Carregando…</p> : pronto.leads.length === 0 ? <p className="muted">Nenhum lead deste anúncio no Kommo.</p> : (
              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                <table className="tbl">
                  <thead><tr><th>Chegou</th><th>Etapa agora</th><th>Vendedor</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    {pronto.leads.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          <a href={`https://comafeoficial.kommo.com/leads/detail/${l.id}`} target="_blank" rel="noreferrer">
                            {new Date(l.em * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </a>
                        </td>
                        <td style={{ fontSize: 12 }}>{l.etapa}</td>
                        <td style={{ fontSize: 12 }}>{l.vendedor}</td>
                        <td className="num" style={{ fontSize: 12 }}>{l.valor ? money(l.valor) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => abrirGerenciador(conta.id, ad.id)}>Abrir no Gerenciador de Anúncios ↗</button>
        </div>
      </div>
    </div>
  );
}
