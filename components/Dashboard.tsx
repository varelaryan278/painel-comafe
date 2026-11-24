"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ADV, ADV_KEYS, DDD_REGIAO, DDD_UF, ESTADOS_GRID, ETAPAS, NAVY, SEM, SIT_NOME, TIPO_NOME,
  fmt, money, pct, type AdvKey, type Situacao, type Tipo,
} from "@/lib/constantes";
import type { CampanhaInfo, LeadView } from "@/lib/dados";
import { Seg } from "./Seg";

type FonteFiltro = "todos" | AdvKey | "sem";
type TipoFiltro = "todos" | "motor" | "peca";

const RAMP = ["#E8EEF8", "#C5D5EE", "#8FB0DE", "#4F7FC6", "#1F4E99"];
const DOTS: Record<string, string> = { todos: NAVY, sem: SEM.cor, ...Object.fromEntries(ADV_KEYS.map((k) => [k, ADV[k].cor])) };
const TIPO_STYLE: Record<string, React.CSSProperties> = {
  motor: { background: "#E6EEFB", color: "#1B4C9C" }, peca: { background: "#FDEEE3", color: "#8A3A10" },
  misto: { background: "#EEF0F3", color: "#3B4556" }, definir: { background: "#FFF4F2", color: "#B42318" },
};
const SIT_STYLE: Record<string, React.CSSProperties> = {
  ativa: { background: "#E5F5EC", color: "#146C3A" }, pausada: { background: "#FFF5DB", color: "#7A5A00" }, encerrada: { background: "#EEF0F3", color: "#4B5565" },
};

export type DashboardProps = {
  leads: LeadView[];
  anteriores: LeadView[];
  campanhas: Record<string, CampanhaInfo>;
  vendedores: Record<number, string>;
  periodo: { de: number; ate: number; rotulo: string };
  ultimaSync: number | null;
  publico?: boolean;
};

const dia = (s: number) => new Date(s * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export default function Dashboard({ leads, anteriores, campanhas, vendedores, periodo, ultimaSync, publico = false }: DashboardProps) {
  const [fonte, setFonte] = useState<FonteFiltro>("todos");
  const [tipo, setTipo] = useState<TipoFiltro>("todos");
  const [mapa, setMapa] = useState<"leads" | "fat">("leads");

  const filtrar = (ls: LeadView[], f: FonteFiltro) =>
    ls.filter((l) => (f === "todos" ? l.f !== "sem" : l.f === f) && (tipo === "todos" || l.t === tipo));

  const d = useMemo(() => {
    const sel = filtrar(leads, fonte);
    const ant = filtrar(anteriores, fonte);
    const tot = (ls: LeadView[]) => ({
      n: ls.length, q: ls.filter((l) => l.q).length, ct: ls.filter((l) => l.ct).length, ng: ls.filter((l) => l.ng).length,
      w: ls.filter((l) => l.w).length, fat: ls.reduce((t, l) => t + l.v, 0),
    });
    const T = tot(sel), A = tot(ant);

    const funis = [
      ...ADV_KEYS.map((k) => ({ id: k as FonteFiltro, nome: ADV[k].nome, cor: ADV[k].cor, t: tot(filtrar(leads, k)) })),
      { id: "todos" as FonteFiltro, nome: "Todos", cor: NAVY, t: tot(filtrar(leads, "todos")) },
    ];
    const semAnuncio = leads.filter((l) => l.f === "sem" && (tipo === "todos" || l.t === tipo)).length;
    const anuncio = leads.filter((l) => l.f !== "sem");
    const provisorio = anuncio.filter((l) => l.p).length;
    const semTipo = sel.filter((l) => l.t === "?").length;

    // vendedores
    const vmap = new Map<string, { nome: string; n: number; w: number; fat: number; porAdv: Record<string, number> }>();
    for (const l of sel) {
      const key = String(l.r ?? "x");
      const nome = l.r != null ? vendedores[l.r] ?? "Usuário removido" : "Sem responsável";
      const v = vmap.get(key) ?? { nome, n: 0, w: 0, fat: 0, porAdv: {} };
      v.n++; if (l.w) { v.w++; v.fat += l.v; }
      v.porAdv[l.f] = (v.porAdv[l.f] ?? 0) + 1;
      vmap.set(key, v);
    }
    const vend = [...vmap.values()].sort((a, b) => b.fat - a.fat || b.w - a.w || b.n - a.n);
    const maxV = Math.max(1, ...vend.map((v) => v.n));

    // mapa
    const porUf = new Map<string, number>(), porDdd = new Map<string, number>();
    let semDdd = 0;
    for (const l of sel) {
      const val = mapa === "leads" ? 1 : l.v;
      const uf = l.d ? DDD_UF[l.d] : undefined;
      if (!uf) { semDdd++; continue; }
      porUf.set(uf, (porUf.get(uf) ?? 0) + val);
      porDdd.set(l.d!, (porDdd.get(l.d!) ?? 0) + val);
    }
    const maxUf = Math.max(1, ...porUf.values());
    const ddds = [...porDdd.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // leads por dia
    const dias: string[] = [];
    for (let s = periodo.de; s < periodo.ate; s += 86400) dias.push(dia(s + 43200));
    const porDia = Object.fromEntries(ADV_KEYS.map((k) => [k, new Map<string, number>()])) as Record<AdvKey, Map<string, number>>;
    for (const l of leads) {
      if (l.f === "sem" || (tipo !== "todos" && l.t !== tipo)) continue;
      const m = porDia[l.f as AdvKey]; const k = dia(l.c);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    const maxDia = Math.max(5, ...ADV_KEYS.flatMap((k) => dias.map((x) => porDia[k].get(x) ?? 0)));
    const topo = Math.ceil(maxDia / 5) * 5;
    const X = (i: number) => 40 + (dias.length > 1 ? (i * 550) / (dias.length - 1) : 275);
    const Y = (v: number) => 160 - (v / topo) * 140;
    const linhas = ADV_KEYS.map((k) => ({ k, pts: dias.map((x, i) => `${X(i).toFixed(1)},${Y(porDia[k].get(x) ?? 0).toFixed(1)}`).join(" ") }));
    const ticksX = dias.length <= 1 ? [0] : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (dias.length - 1)));
    const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * topo));

    // perdas
    const pmap = new Map<string, number>();
    sel.filter((l) => l.l).forEach((l) => pmap.set(l.pd ?? "Sem motivo informado", (pmap.get(l.pd ?? "Sem motivo informado") ?? 0) + 1));
    const perdas = [...pmap.entries()].sort((a, b) => b[1] - a[1]);
    const maxP = Math.max(1, ...perdas.map((p) => p[1]));

    // campanhas
    const cmap = new Map<string, { k: string; n: number; w: number; fat: number; adv: Record<string, number> }>();
    for (const l of sel) {
      if (!l.k) continue;
      const c = cmap.get(l.k) ?? { k: l.k, n: 0, w: 0, fat: 0, adv: {} };
      c.n++; if (l.w) { c.w++; c.fat += l.v; }
      c.adv[l.f] = (c.adv[l.f] ?? 0) + 1;
      cmap.set(l.k, c);
    }
    const camps = [...cmap.values()].sort((a, b) => b.n - a.n).slice(0, 25).map((c) => ({
      ...c, info: campanhas[c.k], adv: Object.entries(c.adv).sort((a, b) => b[1] - a[1])[0]?.[0] as AdvKey,
    }));

    // duplicados (mesmo telefone)
    const porTel = new Map<string, Set<string>>(), contTel = new Map<string, number>();
    for (const l of leads) if (l.h) {
      contTel.set(l.h, (contTel.get(l.h) ?? 0) + 1);
      porTel.set(l.h, (porTel.get(l.h) ?? new Set()).add(l.f));
    }
    const dupPessoas = [...contTel.values()].filter((n) => n > 1).length;
    const dupExtras = [...contTel.values()].reduce((t, n) => t + Math.max(0, n - 1), 0);
    const dupCruzados = [...porTel.entries()].filter(([h, s]) => (contTel.get(h) ?? 0) > 1 && [...s].filter((x) => x !== "sem").length > 1).length;

    return { T, A, funis, semAnuncio, anuncio: anuncio.length, provisorio, semTipo, vend, maxV, porUf, maxUf, ddds, semDdd, dias, linhas, ticksX, ticksY, X, perdas, maxP, camps, dupPessoas, dupExtras, dupCruzados };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, anteriores, fonte, tipo, mapa, campanhas, vendedores, periodo]);

  const delta = (a: number, b: number, dinheiro = false) => {
    if (!b) return a ? "sem base no período anterior" : "igual ao período anterior";
    const diff = a - b;
    const s = diff >= 0 ? "+" : "−";
    return dinheiro ? `${s}${money(Math.abs(diff))} vs. período anterior` : `${s}${pct(Math.abs(diff), b)} vs. período anterior`;
  };
  const kpis = [
    { label: "Leads", valor: fmt(d.T.n), sub: delta(d.T.n, d.A.n) },
    { label: "Qualificados", valor: fmt(d.T.q), sub: pct(d.T.q, d.T.n) + " dos leads" },
    { label: "Chegaram à cotação", valor: fmt(d.T.ct), sub: pct(d.T.ct, d.T.n) + " dos leads" },
    { label: "Vendas", valor: fmt(d.T.w), sub: "conversão " + pct(d.T.w, d.T.n) },
    { label: "Faturamento", valor: money(d.T.fat), sub: delta(d.T.fat, d.A.fat, true) },
    { label: "Ticket médio", valor: d.T.w ? money(d.T.fat / d.T.w) : "—", sub: "por venda" },
  ];
  const fontes: [FonteFiltro, string][] = [["todos", "Todos"], ...ADV_KEYS.map((k) => [k, ADV[k].nome] as [FonteFiltro, string]), ["sem", "Sem anúncio"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!publico && d.anuncio > 0 && d.provisorio > 0 && (
        <div className="aviso">
          <strong>{pct(d.provisorio, d.anuncio)} dos leads de anúncio com atribuição provisória</strong>
          <span>Vieram de IDs do Meta que nenhum gestor cadastrou ainda; o painel usou a regra do final do ID.</span>
          <Link href="/ids" className="btn" style={{ marginLeft: "auto", height: 34, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Ver IDs sem dono</Link>
        </div>
      )}

      <div className="card" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "16px 24px" }}>
        <div className="field">Anunciante<Seg<FonteFiltro> label="Anunciante" options={fontes} value={fonte} onChange={setFonte} dots={DOTS} /></div>
        <div className="field">Tipo<Seg<TipoFiltro> label="Tipo" options={[["todos", "Peça e motor"], ["motor", "Motor"], ["peca", "Peça"]]} value={tipo} onChange={setTipo} /></div>
        <p className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {periodo.rotulo}{ultimaSync ? ` · Kommo sincronizado às ${new Date(ultimaSync * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} de ${new Date(ultimaSync * 1000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : " · ainda não sincronizado"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 13, color: "#5B6576", fontWeight: 500 }}>{k.label}</div>
            <div className="display" style={{ fontSize: k.valor.length > 9 ? 25 : 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{k.valor}</div>
            <div style={{ fontSize: 12, color: "#3B4556" }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {tipo !== "todos" && d.semTipo === 0 && leads.some((l) => l.t === "?") && (
        <p className="muted" style={{ marginTop: -8 }}>Leads sem tipo definido (sem cadastro e sem tag peça/motor) ficam fora deste filtro.</p>
      )}

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
          <h2 className="h2">Funil por anunciante</h2>
          <p className="muted">Cada etapa conta os leads que já passaram por ela. Dentro: quantidade e % que seguiu da etapa anterior.</p>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "110px repeat(4, minmax(190px, 1fr))", gap: 16, minWidth: 980 }}>
            <div>
              <div style={{ height: 56 }} />
              {ETAPAS.map((e) => (
                <div key={e} style={{ height: ALTURA_ETAPA, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: "#3B4556" }}>{e}</div>
              ))}
            </div>
            {d.funis.map((fu) => (
              <Funil3D key={fu.nome} nome={fu.nome} cor={fu.cor} f={[fu.t.n, fu.t.q, fu.t.ct, fu.t.ng, fu.t.w]} fat={fu.t.fat}
                on={fonte === "todos" || fonte === fu.id} />
            ))}
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Fora dos funis: <strong>{fmt(d.semAnuncio)}</strong> leads sem anúncio identificado (contato direto, indicação ou anúncio que o Kommo não registrou).
        </p>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: 20 }}>
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h2 className="h2">Vendas por vendedor</h2>
            <p className="muted" style={{ marginTop: 4 }}>Barra = leads recebidos, dividida pela cor do anunciante</p>
          </div>
          {d.vend.length === 0 ? <Vazio /> : (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ minWidth: 420 }}>
                <thead><tr><th>Vendedor</th><th style={{ width: "40%" }}>Leads</th><th className="num">Vendas</th><th className="num">Faturamento</th><th className="num">Conversão</th></tr></thead>
                <tbody>
                  {d.vend.map((v) => (
                    <tr key={v.nome}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{v.nome}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", gap: 2, height: 14, borderRadius: 4, overflow: "hidden", width: `${((v.n / d.maxV) * 78).toFixed(1)}%`, minWidth: 4 }}>
                            {Object.entries(v.porAdv).map(([k, n]) => (
                              <div key={k} title={`${k === "sem" ? SEM.nome : ADV[k as AdvKey].nome}: ${n}`} style={{ height: "100%", background: DOTS[k], flex: `${n} 1 0` }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 12, color: "#5B6576", fontVariantNumeric: "tabular-nums" }}>{fmt(v.n)}</span>
                        </div>
                      </td>
                      <td className="num">{fmt(v.w)}</td>
                      <td className="num">{money(v.fat)}</td>
                      <td className="num">{pct(v.w, v.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "8px 16px" }}>
            <div>
              <h2 className="h2">Mapa por localidade</h2>
              <p className="muted" style={{ marginTop: 4 }}>Estado pelo DDD do telefone · cada quadrado é um estado</p>
            </div>
            <div style={{ marginLeft: "auto" }}><Seg<"leads" | "fat"> label="Medida do mapa" options={[["leads", "Leads"], ["fat", "Faturamento"]]} value={mapa} onChange={setMapa} /></div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            <div role="img" aria-label="Mapa em blocos dos estados" style={{ display: "grid", gridTemplateColumns: "repeat(7, 42px)", gridTemplateRows: "repeat(7, 42px)", gap: 4 }}>
              {ESTADOS_GRID.map(([uf, c, r]) => {
                const v = d.porUf.get(uf) ?? 0;
                const idx = v <= 0 ? 0 : Math.min(4, 1 + Math.floor(Math.sqrt(v / d.maxUf) * 4));
                const label = mapa === "leads" ? fmt(v) : v >= 1000 ? Math.round(v / 1000) + "k" : fmt(v);
                return (
                  <div key={uf} title={`${uf}: ${mapa === "leads" ? fmt(v) + " leads" : money(v)}`}
                    style={{ gridColumn: c + 1, gridRow: r + 1, background: RAMP[idx], color: idx >= 3 ? "#fff" : "#172033", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.15 }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{uf}</span>
                    <span style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}>{label}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: "1 1 200px", minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#5B6576", marginBottom: 6 }}>Regiões (DDD) que mais {mapa === "leads" ? "trazem leads" : "compram"}</div>
              {d.ddds.length === 0 ? <Vazio /> : (
                <table className="tbl"><tbody>
                  {d.ddds.map(([ddd, v]) => (
                    <tr key={ddd}><td style={{ width: 34, fontWeight: 700, color: "#1F4E99" }}>{ddd}</td><td>{DDD_REGIAO[ddd] ?? DDD_UF[ddd]}</td><td className="num">{mapa === "leads" ? fmt(v) : money(v)}</td></tr>
                  ))}
                </tbody></table>
              )}
              {mapa === "leads" && d.semDdd > 0 && <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{fmt(d.semDdd)} leads sem telefone brasileiro identificado.</p>}
            </div>
          </div>
        </section>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
            <h2 className="h2">Leads por dia</h2>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#3B4556", marginLeft: "auto" }}>
              {ADV_KEYS.map((k) => <span key={k}><span className="dot" style={{ background: ADV[k].cor }} />{ADV[k].nome}</span>)}
            </div>
          </div>
          <svg viewBox="0 0 600 200" role="img" aria-label="Leads por dia de cada anunciante" style={{ width: "100%", height: "auto" }}>
            {d.ticksY.map((t, i) => {
              const y = 160 - (i / 4) * 140;
              return <g key={i}><line x1={40} x2={590} y1={y} y2={y} stroke={i === 0 ? "#C9D1DE" : "#EEF1F5"} /><text x={32} y={y + 4} textAnchor="end" fontSize={11} fill="#5B6576">{t}</text></g>;
            })}
            {d.ticksX.map((i) => (
              <text key={i} x={d.X(i)} y={182} textAnchor={i === 0 ? "start" : i === d.dias.length - 1 ? "end" : "middle"} fontSize={11} fill="#5B6576">{d.dias[i]?.slice(8, 10)}/{d.dias[i]?.slice(5, 7)}</text>
            ))}
            {d.linhas.map((l) => (
              <polyline key={l.k} points={l.pts} fill="none" stroke={ADV[l.k].cor} strokeWidth={fonte === l.k ? 3 : 2} strokeLinejoin="round"
                opacity={fonte === "todos" || fonte === l.k ? 1 : 0.18} />
            ))}
          </svg>
        </section>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h2 className="h2">Motivos de perda</h2>
            <p className="muted" style={{ marginTop: 4 }}>Leads em Fechado - perdido, pelo motivo escolhido no Kommo</p>
          </div>
          {d.perdas.length === 0 ? <Vazio /> : d.perdas.map(([nome, v]) => (
            <div key={nome} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 190px) minmax(0, 1fr) 44px", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span>{nome}</span>
              <div style={{ background: "#EEF1F5", borderRadius: 4, height: 14 }}><div style={{ height: 14, borderRadius: 4, background: "#5B6576", width: `${((v / d.maxP) * 100).toFixed(1)}%` }} /></div>
              <span className="num">{fmt(v)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h2 className="h2">Campanhas e anúncios</h2>
          <p className="muted" style={{ marginTop: 4 }}>Nome, tipo e situação vêm do cadastro feito pelo gestor de tráfego</p>
        </div>
        {d.camps.length === 0 ? <Vazio /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead><tr><th>Campanha / anúncio</th><th>Anunciante</th><th>Tipo</th><th>Situação</th><th className="num">Leads</th><th className="num">Vendas</th><th className="num">Faturamento</th></tr></thead>
              <tbody>
                {d.camps.map((c) => (
                  <tr key={c.k}>
                    <td style={{ fontWeight: 500 }}>
                      {c.info?.nome ?? c.k}
                      {!c.info?.cadastrada && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>(sem cadastro)</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}><span className="dot" style={{ background: DOTS[c.adv] }} />{c.adv === ("sem" as string) ? "—" : ADV[c.adv]?.nome}</td>
                    <td>{c.info?.tipo ? <span className="pill" style={{ ...TIPO_STYLE[c.info.tipo], cursor: "default" }}>{TIPO_NOME[c.info.tipo as Tipo]}</span> : <span className="muted">—</span>}</td>
                    <td>{c.info?.situacao ? <span className="pill" style={{ ...SIT_STYLE[c.info.situacao], cursor: "default" }}>{SIT_NOME[c.info.situacao as Situacao]}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{fmt(c.n)}</td>
                    <td className="num">{fmt(c.w)}</td>
                    <td className="num">{money(c.fat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px", alignItems: "center" }}>
        <div>
          <h2 className="h2">Leads que entraram mais de uma vez</h2>
          <p className="muted" style={{ marginTop: 4 }}>Mesma pessoa (mesmo telefone) no período, em qualquer anunciante</p>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginLeft: "auto" }}>
          <Num valor={d.dupPessoas} rotulo="pessoas repetidas" />
          <Num valor={d.dupExtras} rotulo="leads a mais" />
          <Num valor={d.dupCruzados} rotulo="vieram por 2+ anunciantes" />
        </div>
      </section>
    </div>
  );
}

function Num({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div>
      <div className="display" style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(valor)}</div>
      <div style={{ fontSize: 12, color: "#5B6576" }}>{rotulo}</div>
    </div>
  );
}

function Vazio() {
  return <p className="muted" style={{ padding: "12px 0" }}>Sem dados neste período.</p>;
}

const ALTURA_ETAPA = 56;

function Funil3D({ nome, cor, f, fat, on }: { nome: string; cor: string; f: number[]; fat: number; on: boolean }) {
  // Largura mínima de 36% para o número sempre caber dentro da etapa; raiz quadrada para as etapas pequenas aparecerem.
  const width = (n: number) => (f[0] > 0 ? 36 + 64 * Math.sqrt(n / f[0]) : 36);
  const texto = { color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.45)", fontVariantNumeric: "tabular-nums" as const, lineHeight: 1.1 };
  return (
    <div style={{ transition: "opacity .2s", opacity: on ? 1 : 0.3 }}>
      <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span className="dot" style={{ background: cor }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{nome}</span>
      </div>
      {f.map((n, i) => {
        const w = width(n);
        const wn = i < 4 ? width(f[i + 1]) : w * 0.78;
        const inset = Math.max(0, ((1 - wn / w) / 2) * 100);
        const passagem = i === 0 ? null : pct(n, f[i - 1]);
        return (
          <div key={i} style={{ height: ALTURA_ETAPA, display: "flex", alignItems: "center" }}>
            <div title={`${ETAPAS[i]}: ${fmt(n)}${passagem ? ` (${passagem} da etapa anterior)` : ""}`}
              style={{ position: "relative", height: 44, margin: "0 auto", width: `${w.toFixed(1)}%` }}>
              <div style={{
                position: "absolute", inset: 0, clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`,
                background: `linear-gradient(90deg, rgba(0,0,0,.32) 0%, rgba(255,255,255,.14) 40%, rgba(255,255,255,.02) 60%, rgba(0,0,0,.36) 100%), ${cor}`,
              }} />
              <div style={{
                position: "absolute", left: 0, right: 0, top: -5, height: 10, borderRadius: "50%",
                background: `linear-gradient(rgba(255,255,255,.42), rgba(255,255,255,.42)), ${cor}`, boxShadow: "inset 0 -1px 0 rgba(0,0,0,.18)",
              }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 3 }}>
                <span style={{ ...texto, fontWeight: 700, fontSize: 16 }}>{fmt(n)}</span>
                {passagem && <span style={{ ...texto, fontSize: 10.5, fontWeight: 600, opacity: 0.95 }}>{passagem}</span>}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EEF1F5", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
        <span style={{ color: "#5B6576" }}>Lead → venda <strong style={{ color: "#172033" }}>{pct(f[4], f[0])}</strong></span>
        <strong>{money(fat)}</strong>
      </div>
    </div>
  );
}
