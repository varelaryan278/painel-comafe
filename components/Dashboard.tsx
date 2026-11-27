"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ADV, ADV_KEYS, DDD_REGIAO, DDD_UF, ESTADOS_GRID, ETAPAS, NAVY, NID, SEM, SIT_NOME, TIPO_NOME,
  fmt, money, pct, type AdvKey, type Situacao, type Tipo,
} from "@/lib/constantes";
import type { CampanhaInfo, GastoView, LeadView } from "@/lib/dados";
import { Seg } from "./Seg";

type FonteFiltro = "todos" | AdvKey | "nid" | "sem";
const nomeFonte = (k: string) => (k === "sem" ? SEM.nome : k === "nid" ? NID.nome : ADV[k as AdvKey]?.nome ?? k);
type TipoFiltro = "todos" | "motor" | "peca";

const RAMP = ["#E8EEF8", "#C5D5EE", "#8FB0DE", "#4F7FC6", "#1F4E99"];
const DOTS: Record<string, string> = { todos: NAVY, sem: SEM.cor, nid: NID.cor, ...Object.fromEntries(ADV_KEYS.map((k) => [k, ADV[k].cor])) };
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
  gastos?: GastoView[];
  gastosAnt?: GastoView[];
  publico?: boolean;
  vendasSemValor?: number[]; // ids de leads ganhos sem valor preenchido (só admin/gestor)
  tv?: boolean; // modo TV: mostra uma tela por vez e troca sozinho
};

/** Telas do modo TV (cada seção do painel pertence a uma). */
const TELAS = ["Resultados e funis", "Vendedores e atendimento", "Motor × peça e evolução", "Campanhas e localidade"];
const TEMPO_TELA = 20_000;

/** Duração legível: 45 s, 12 min, 3 h 05 min, 2 d 4 h. */
export function duracao(s: number | null) {
  if (s == null) return "—";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const RAPIDO = 15 * 60; // meta: responder em até 15 minutos
type Atend = { base: number; resp: number; med: number | null; rapido: number; sem: number };
const atendimento = (ls: LeadView[]): Atend => {
  const base = ls.filter((l) => l.hc);
  const tempos = base.filter((l) => l.fr != null).map((l) => l.fr!);
  return { base: base.length, resp: tempos.length, med: mediana(tempos), rapido: tempos.filter((t) => t <= RAPIDO).length, sem: base.length - tempos.length };
};

const roas = (fat: number, gasto: number) => (gasto > 0 ? (fat / gasto).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "x" : "—");

const dia = (s: number) => new Date(s * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export default function Dashboard({ leads, anteriores, campanhas, vendedores, periodo, ultimaSync, gastos = [], gastosAnt = [], publico = false, tv = false, vendasSemValor = [] }: DashboardProps) {
  const [fonte, setFonte] = useState<FonteFiltro>("todos");
  const [tipo, setTipo] = useState<TipoFiltro>("todos");
  const [mapa, setMapa] = useState<"leads" | "fat">("leads");
  const [tela, setTela] = useState(0);
  useEffect(() => {
    if (!tv) return;
    const id = setInterval(() => setTela((t) => (t + 1) % TELAS.length), TEMPO_TELA);
    return () => clearInterval(id);
  }, [tv]);
  const ver = (n: number) => !tv || tela === n;

  const filtrar = (ls: LeadView[], f: FonteFiltro) =>
    ls.filter((l) => (f === "todos" ? l.f !== "sem" : l.f === f) && (tipo === "todos" || l.t === tipo));

  const filtrarG = (gs: GastoView[], f: FonteFiltro) =>
    gs.filter((g) => (f === "todos" ? true : g.f === f) && (tipo === "todos" || g.t === tipo));
  const somaG = (gs: GastoView[]) => gs.reduce((t, g) => t + g.v, 0);

  const d = useMemo(() => {
    const sel = filtrar(leads, fonte);
    const gasto = somaG(filtrarG(gastos, fonte)), gastoAnt = somaG(filtrarG(gastosAnt, fonte));
    const gastoPorCamp = new Map<string, number>();
    for (const g of filtrarG(gastos, fonte)) gastoPorCamp.set(g.k, (gastoPorCamp.get(g.k) ?? 0) + g.v);
    const ant = filtrar(anteriores, fonte);
    const tot = (ls: LeadView[]) => ({
      n: ls.filter((l) => !l.x).length, q: ls.filter((l) => l.q && !l.x).length, ct: ls.filter((l) => l.ct && !l.x).length, ng: ls.filter((l) => l.ng && !l.x).length,
      w: ls.filter((l) => l.w).length, fat: ls.reduce((t, l) => t + l.v, 0),
      fatEst: ls.reduce((t, l) => t + (l.e ? l.v : 0), 0), // sem ID: dono pelo número de WhatsApp
      fatCruz: ls.reduce((t, l) => t + (l.oa ? l.v : 0), 0), wCruz: ls.filter((l) => l.w && l.oa).length, // já tinha vindo por outro anunciante
    });
    const T = tot(sel), A = tot(ant);

    const funis = [
      ...ADV_KEYS.map((k) => ({ id: k as FonteFiltro, nome: ADV[k].nome, cor: ADV[k].cor, t: tot(filtrar(leads, k)), gasto: somaG(filtrarG(gastos, k)) })),
      { id: "todos" as FonteFiltro, nome: "Todos", cor: NAVY, t: tot(filtrar(leads, "todos")), gasto: somaG(filtrarG(gastos, "todos")) },
    ];
    const semAnuncioLs = leads.filter((l) => l.f === "sem" && (tipo === "todos" || l.t === tipo));
    const semAnuncio = semAnuncioLs.filter((l) => !l.x).length;
    const fatSemAnuncio = semAnuncioLs.reduce((t, l) => t + l.v, 0), vendasSemAnuncio = semAnuncioLs.filter((l) => l.w).length;
    const anuncio = leads.filter((l) => l.f !== "sem" && !l.x);
    // tudo que fechou ganho no funil do Kommo no período, com ou sem anúncio (não depende dos filtros)
    const fatKommo = leads.reduce((t, l) => t + l.v, 0), vendasKommo = leads.filter((l) => l.w).length;
    const fatKommoAnt = anteriores.reduce((t, l) => t + l.v, 0);
    const provisorio = anuncio.filter((l) => l.p).length;
    const semTipo = sel.filter((l) => l.t === "?" && !l.x).length;

    // vendedores
    const vmap = new Map<string, { nome: string; n: number; w: number; fat: number; porAdv: Record<string, number> }>();
    for (const l of sel) {
      const key = String(l.r ?? "x");
      const nome = l.r != null ? vendedores[l.r] ?? "Usuário removido" : "Sem responsável";
      const v = vmap.get(key) ?? { nome, n: 0, w: 0, fat: 0, porAdv: {} };
      if (!l.x) { v.n++; v.porAdv[l.f] = (v.porAdv[l.f] ?? 0) + 1; }
      if (l.w) { v.w++; v.fat += l.v; }
      vmap.set(key, v);
    }
    const vend = [...vmap.values()].sort((a, b) => b.fat - a.fat || b.w - a.w || b.n - a.n);
    const maxV = Math.max(1, ...vend.map((v) => v.n));

    // mapa
    const porUf = new Map<string, number>(), porDdd = new Map<string, number>();
    let semDdd = 0;
    for (const l of sel) {
      if (mapa === "leads" && l.x) continue;
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
      // uma linha por anunciante: "por fora" e "anúncio sem ID" não têm dono, ficam fora deste gráfico
      const m = porDia[l.f as AdvKey];
      if (!m || l.x || (tipo !== "todos" && l.t !== tipo)) continue;
      const k = dia(l.c);
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
      if (!l.x) { c.n++; c.adv[l.f] = (c.adv[l.f] ?? 0) + 1; }
      if (l.w) { c.w++; c.fat += l.v; }
      cmap.set(l.k, c);
    }
    const camps = [...cmap.values()].filter((c) => c.n > 0 || c.w > 0).sort((a, b) => b.n - a.n).slice(0, 25).map((c) => ({
      ...c, info: campanhas[c.k], adv: Object.entries(c.adv).sort((a, b) => b[1] - a[1])[0]?.[0] as AdvKey, gasto: gastoPorCamp.get(c.k) ?? 0,
    }));

    // duplicados (mesmo telefone)
    const porTel = new Map<string, Set<string>>(), contTel = new Map<string, number>();
    for (const l of leads) if (l.h && !l.x) {
      contTel.set(l.h, (contTel.get(l.h) ?? 0) + 1);
      porTel.set(l.h, (porTel.get(l.h) ?? new Set()).add(l.f));
    }
    const dupPessoas = [...contTel.values()].filter((n) => n > 1).length;
    const dupExtras = [...contTel.values()].reduce((t, n) => t + Math.max(0, n - 1), 0);
    const dupCruzados = [...porTel.entries()].filter(([h, s]) => (contTel.get(h) ?? 0) > 1 && [...s].filter((x) => x !== "sem").length > 1).length;

    // atendimento (1ª resposta de uma pessoa, leads que chegaram em horário comercial)
    const atTotal = atendimento(sel.filter((l) => !l.x));
    const atAdv = ADV_KEYS.map((k) => ({ k, a: atendimento(filtrar(leads, k).filter((l) => !l.x)) }));
    const amap = new Map<string, { nome: string; ls: LeadView[] }>();
    for (const l of sel) {
      if (l.x) continue;
      const key = String(l.r ?? "x");
      const it = amap.get(key) ?? { nome: l.r != null ? vendedores[l.r] ?? "Usuário removido" : "Sem responsável", ls: [] };
      it.ls.push(l);
      amap.set(key, it);
    }
    const atVend = [...amap.values()].map((v) => ({ nome: v.nome, a: atendimento(v.ls) })).filter((v) => v.a.base > 0)
      .sort((a, b) => (a.a.med ?? Infinity) - (b.a.med ?? Infinity));
    const atForaHorario = mediana(sel.filter((l) => !l.x && !l.hc && l.fr != null).map((l) => l.fr!));

    // motor × peça (respeita o anunciante, ignora o filtro de tipo)
    const selF = leads.filter((l) => (fonte === "todos" ? l.f !== "sem" : l.f === fonte));
    const gF = gastos.filter((g) => fonte === "todos" || g.f === fonte);
    const porTipo = (["motor", "peca", "?"] as const).map((t) => {
      const ls = selF.filter((l) => l.t === t);
      return {
        t, n: ls.filter((l) => !l.x).length, ct: ls.filter((l) => l.ct && !l.x).length, w: ls.filter((l) => l.w).length, fat: ls.reduce((s, l) => s + l.v, 0),
        gasto: gF.filter((g) => g.t === t).reduce((s, g) => s + g.v, 0),
      };
    });

    return { fatKommo, vendasKommo, fatKommoAnt, fatSemAnuncio, vendasSemAnuncio, atTotal, atAdv, atVend, atForaHorario, porTipo, gasto, gastoAnt, T, A, funis, semAnuncio, anuncio: anuncio.length, provisorio, semTipo, vend, maxV, porUf, maxUf, ddds, semDdd, dias, linhas, ticksX, ticksY, X, perdas, maxP, camps, dupPessoas, dupExtras, dupCruzados };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, anteriores, fonte, tipo, mapa, campanhas, vendedores, periodo, gastos, gastosAnt]);

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
    // card duplo: faturamento dos anúncios ao lado do faturamento total no Kommo
    { label: fonte === "todos" ? "Faturamento dos anúncios" : fonte === "sem" ? "Faturamento por fora" : fonte === "nid" ? "Faturamento de anúncio sem ID" : "Faturamento de " + ADV[fonte].nome, valor: money(d.T.fat),
      sub: `${fmt(d.T.w)} vendas · ${pct(d.T.fat, d.fatKommo)} do Kommo`,
      lado: { label: "Faturamento no Kommo", valor: money(d.fatKommo), sub: `${fmt(d.vendasKommo)} vendas · todas as origens` },
      rodape: `Anúncios ${delta(d.T.fat, d.A.fat, true)}` + (d.T.fat && fonte !== "sem" && fonte !== "nid" ? ` · ${money(d.T.fat - d.T.fatEst)} confirmado por ID do anúncio · ${money(d.T.fatEst)} estimado pelo número de WhatsApp` + (d.T.fatCruz ? ` · ${money(d.T.fatCruz)} (${fmt(d.T.wCruz)} venda${d.T.wCruz === 1 ? "" : "s"}) de clientes que antes vieram por outro anunciante` : "") : "") },
    { label: "Ticket médio", valor: d.T.w ? money(d.T.fat / d.T.w) : "—", sub: "por venda" },
    ...(gastos.length && fonte !== "sem" && fonte !== "nid" ? [
      { label: "Investido no Meta", valor: money(d.gasto), sub: delta(d.gasto, d.gastoAnt, true) },
      { label: "Custo por lead", valor: d.T.n ? money(d.gasto / d.T.n) : "—", sub: "investido ÷ leads" },
      { label: "Custo por venda", valor: d.T.w ? money(d.gasto / d.T.w) : "—", sub: "investido ÷ vendas" },
      { label: "Retorno (ROAS)", valor: roas(d.T.fat, d.gasto), sub: d.gasto ? "faturamento ÷ investido" : "sem investimento no período" },
    ] : []),
  ];
  const fontes: [FonteFiltro, string][] = [["todos", "Todos"], ...ADV_KEYS.map((k) => [k, ADV[k].nome] as [FonteFiltro, string]), ["nid", "Anúncio sem ID"], ["sem", "Por fora"]];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!publico && d.anuncio > 0 && d.provisorio > 0 && (
        <div className="aviso">
          <strong>{pct(d.provisorio, d.anuncio)} dos leads de anúncio com atribuição provisória</strong>
          <span>Vieram de IDs do Meta que nenhum gestor cadastrou ainda; o painel usou a regra do final do ID.</span>
          <Link href="/ids" className="btn" style={{ marginLeft: "auto", height: 34, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Ver IDs sem dono</Link>
        </div>
      )}

      {!publico && vendasSemValor.length > 0 && (
        <div className="aviso">
          <strong>{fmt(vendasSemValor.length)} venda{vendasSemValor.length === 1 ? "" : "s"} sem valor no Kommo</strong>
          <span>Marcada{vendasSemValor.length === 1 ? "" : "s"} como ganho sem “Valor de venda”, então não entra{vendasSemValor.length === 1 ? "" : "m"} no faturamento:</span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {vendasSemValor.map((id) => <a key={id} href={`https://comafeoficial.kommo.com/leads/detail/${id}`} target="_blank" rel="noreferrer" className="mono">#{id}</a>)}
          </span>
        </div>
      )}

      {tv && (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 className="display" style={{ fontSize: 26, margin: 0, color: NAVY }}>{TELAS[tela]}</h2>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }} aria-label={`Tela ${tela + 1} de ${TELAS.length}`}>
            {TELAS.map((t, i) => (
              <button key={t} type="button" onClick={() => setTela(i)} title={t} aria-label={t}
                style={{ width: i === tela ? 34 : 12, height: 12, borderRadius: 999, border: 0, cursor: "pointer", background: i === tela ? NAVY : "#C9D1DE", transition: "width .3s" }} />
            ))}
          </div>
        </div>
      )}

      <div className="card filtros" style={{ display: tv ? "none" : "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "16px 24px" }}>
        <div className="field">Anunciante<Seg<FonteFiltro> label="Anunciante" options={fontes} value={fonte} onChange={setFonte} dots={DOTS} /></div>
        <div className="field">Tipo<Seg<TipoFiltro> label="Tipo" options={[["todos", "Peça e motor"], ["motor", "Motor"], ["peca", "Peça"]]} value={tipo} onChange={setTipo} /></div>
        <p className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {periodo.rotulo}{ultimaSync ? ` · Kommo sincronizado às ${new Date(ultimaSync * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} de ${new Date(ultimaSync * 1000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : " · ainda não sincronizado"}
        </p>
      </div>

      {ver(0) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        {kpis.map((k: { label: string; valor: string; sub: string; lado?: { label: string; valor: string; sub: string }; rodape?: string }) => {
          const bloco = (x: { label: string; valor: string; sub: string }) => (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 170px", minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "#5B6576", fontWeight: 500 }}>{x.label}</div>
              <div className="display" style={{ fontSize: x.valor.length > 9 ? 25 : 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{x.valor}</div>
              <div style={{ fontSize: 12, color: "#3B4556" }}>{x.sub}</div>
            </div>
          );
          if (!k.lado) return <div key={k.label} className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>{bloco(k)}</div>;
          return (
            <div key={k.label} className="card kpi-duplo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px" }}>
                {bloco(k)}
                <div aria-hidden="true" style={{ width: 1, background: "#E3E8F0", alignSelf: "stretch" }} />
                {bloco(k.lado)}
              </div>
              {k.rodape && <div style={{ fontSize: 12, color: "#5B6576", borderTop: "1px solid #E3E8F0", paddingTop: 8 }}>{k.rodape}</div>}
            </div>
          );
        })}
      </div>}
      {tipo !== "todos" && d.semTipo === 0 && leads.some((l) => l.t === "?") && (
        <p className="muted" style={{ marginTop: -8 }}>Leads sem tipo definido (sem cadastro e sem tag peça/motor) ficam fora deste filtro.</p>
      )}

      {ver(0) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
              <Funil3D key={fu.nome} nome={fu.nome} cor={fu.cor} f={[fu.t.n, fu.t.q, fu.t.ct, fu.t.ng, fu.t.w]} fat={fu.t.fat} gasto={gastos.length ? fu.gasto : null}
                on={fonte === "todos" || fonte === fu.id} />
            ))}
          </div>
        </div>
        {d.funis.some((fu) => fu.id !== "todos" && fu.t.fat) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 12, color: "#3B4556" }}>
            <strong>Faturamento:</strong>
            {d.funis.filter((fu) => fu.id !== "todos").map((fu) => (
              <span key={fu.nome}>
                <span className="dot" style={{ background: fu.cor }} />{fu.nome}: {money(fu.t.fat - fu.t.fatEst)} por ID + {money(fu.t.fatEst)} estimado pelo número
                {fu.t.fatCruz ? <> · {money(fu.t.fatCruz)} com contato prévio de outro anunciante</> : null}
              </span>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Fora dos funis: <strong>{fmt(d.semAnuncio)}</strong> leads criados à mão pelos vendedores (vendas por fora: balcão, telefone, indicação). Leads que entraram pelo WhatsApp sem ID do anúncio contam para o dono do número (estimado).
        </p>
      </section>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))", gap: 20 }}>
        {ver(1) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                              <div key={k} title={`${nomeFonte(k)}: ${n}`} style={{ height: "100%", background: DOTS[k], flex: `${n} 1 0` }} />
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
        </section>}

        {ver(1) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h2 className="h2">Tempo da primeira resposta</h2>
            <p className="muted" style={{ marginTop: 4 }}>
              Do lead entrar até a 1ª mensagem de uma pessoa (o robô não conta). Só leads que chegaram em horário comercial: seg a sex 8h–18h, sáb 8h–12h.
            </p>
          </div>
          {d.atTotal.base === 0 ? <Vazio /> : (<>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
              <Stat valor={duracao(d.atTotal.med)} rotulo="tempo mediano" />
              <Stat valor={pct(d.atTotal.rapido, d.atTotal.base)} rotulo="respondidos em até 15 min" cor={d.atTotal.rapido / d.atTotal.base >= 0.7 ? "#146C3A" : "#B42318"} />
              <Stat valor={fmt(d.atTotal.sem)} rotulo="sem resposta de uma pessoa" />
              <Stat valor={duracao(d.atForaHorario)} rotulo="mediana fora do horário" />
            </div>
            {fonte === "todos" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {d.atAdv.map(({ k, a }) => (
                  <div key={k} style={{ border: "1px solid #E2E7EF", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}><span className="dot" style={{ background: ADV[k].cor }} />{ADV[k].nome}</div>
                    <div className="display" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{duracao(a.med)}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{pct(a.rapido, a.base)} em até 15 min</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="tbl" style={{ minWidth: 420 }}>
                <thead><tr><th>Vendedor</th><th className="num">Leads</th><th className="num">Mediana</th><th className="num">Até 15 min</th><th className="num">Sem resposta</th></tr></thead>
                <tbody>
                  {d.atVend.slice(0, tv ? 8 : 50).map((v) => (
                    <tr key={v.nome}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{v.nome}</td>
                      <td className="num">{fmt(v.a.base)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{duracao(v.a.med)}</td>
                      <td className="num">{pct(v.a.rapido, v.a.base)}</td>
                      <td className="num">{fmt(v.a.sem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>)}
        </section>}

        {ver(2) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14, gridColumn: "1 / -1" }}>
          <div>
            <h2 className="h2">Motor × peça</h2>
            <p className="muted" style={{ marginTop: 4 }}>Resultado de cada tipo de campanha{fonte !== "todos" && fonte !== "sem" && fonte !== "nid" ? ` de ${ADV[fonte].nome}` : ""} · tipo marcado pelo gestor (ou pela tag do robô)</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead><tr><th>Tipo</th><th className="num">Leads</th><th className="num">Cotações</th><th className="num">Vendas</th><th className="num">Conversão</th><th className="num">Faturamento</th><th className="num">Ticket médio</th>
                {gastos.length > 0 && <><th className="num">Investido</th><th className="num">Custo/lead</th><th className="num">Custo/venda</th><th className="num">ROAS</th></>}</tr></thead>
              <tbody>
                {d.porTipo.map((r) => (
                  <tr key={r.t}>
                    <td>{r.t === "?" ? <span className="muted">Sem tipo definido</span> : <span className="pill" style={{ ...TIPO_STYLE[r.t], cursor: "default" }}>{TIPO_NOME[r.t as Tipo]}</span>}</td>
                    <td className="num">{fmt(r.n)}</td>
                    <td className="num">{fmt(r.ct)}</td>
                    <td className="num">{fmt(r.w)}</td>
                    <td className="num">{pct(r.w, r.n)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{money(r.fat)}</td>
                    <td className="num">{r.w ? money(r.fat / r.w) : "—"}</td>
                    {gastos.length > 0 && <>
                      <td className="num">{r.gasto ? money(r.gasto) : "—"}</td>
                      <td className="num">{r.gasto && r.n ? money(r.gasto / r.n) : "—"}</td>
                      <td className="num">{r.gasto && r.w ? money(r.gasto / r.w) : "—"}</td>
                      <td className="num" style={{ fontWeight: 600, color: r.gasto && r.fat >= r.gasto ? "#146C3A" : undefined }}>{roas(r.fat, r.gasto)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}

        {ver(3) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </section>}

        {ver(2) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        </section>}

        {ver(2) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        </section>}
      </div>

      {ver(3) && <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h2 className="h2">Campanhas e anúncios</h2>
          <p className="muted" style={{ marginTop: 4 }}>Nome, tipo e situação vêm do cadastro feito pelo gestor de tráfego</p>
        </div>
        {d.camps.length === 0 ? <Vazio /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: 980 }}>
              <thead><tr><th>Campanha / anúncio</th><th>Anunciante</th><th>Tipo</th><th>Situação</th><th className="num">Leads</th><th className="num">Vendas</th><th className="num">Faturamento</th>{gastos.length > 0 && <><th className="num">Investido</th><th className="num">Custo/lead</th><th className="num">ROAS</th></>}</tr></thead>
              <tbody>
                {d.camps.slice(0, tv ? 8 : 25).map((c) => (
                  <tr key={c.k}>
                    <td style={{ fontWeight: 500 }}>
                      {c.info?.nome ?? c.k}
                      {!c.info?.cadastrada && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>(sem cadastro)</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}><span className="dot" style={{ background: DOTS[c.adv] }} />{c.adv === ("sem" as string) ? "—" : nomeFonte(c.adv)}</td>
                    <td>{c.info?.tipo ? <span className="pill" style={{ ...TIPO_STYLE[c.info.tipo], cursor: "default" }}>{TIPO_NOME[c.info.tipo as Tipo]}</span> : <span className="muted">—</span>}</td>
                    <td>{c.info?.situacao ? <span className="pill" style={{ ...SIT_STYLE[c.info.situacao], cursor: "default" }}>{SIT_NOME[c.info.situacao as Situacao]}</span> : <span className="muted">—</span>}</td>
                    <td className="num">{fmt(c.n)}</td>
                    <td className="num">{fmt(c.w)}</td>
                    <td className="num">{money(c.fat)}</td>
                    {gastos.length > 0 && <>
                      <td className="num">{c.gasto ? money(c.gasto) : "—"}</td>
                      <td className="num">{c.gasto && c.n ? money(c.gasto / c.n) : "—"}</td>
                      <td className="num" style={{ fontWeight: 600, color: c.gasto && c.fat >= c.gasto ? "#146C3A" : undefined }}>{roas(c.fat, c.gasto)}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>}

      {!tv && <section className="card" style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px", alignItems: "center" }}>
        <div>
          <h2 className="h2">Leads que entraram mais de uma vez</h2>
          <p className="muted" style={{ marginTop: 4 }}>Mesma pessoa (mesmo telefone) no período, em qualquer anunciante</p>
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginLeft: "auto" }}>
          <Num valor={d.dupPessoas} rotulo="pessoas repetidas" />
          <Num valor={d.dupExtras} rotulo="leads a mais" />
          <Num valor={d.dupCruzados} rotulo="vieram por 2+ anunciantes" />
        </div>
      </section>}
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

function Stat({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <div>
      <div className="display" style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, color: "#5B6576" }}>{rotulo}</div>
    </div>
  );
}

function Vazio() {
  return <p className="muted" style={{ padding: "12px 0" }}>Sem dados neste período.</p>;
}

const ALTURA_ETAPA = 56;

function Funil3D({ nome, cor, f, fat, gasto, on }: { nome: string; cor: string; f: number[]; fat: number; gasto: number | null; on: boolean }) {
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
      {gasto !== null && (
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#5B6576" }}>
          <span>Investido <strong style={{ color: "#172033" }}>{money(gasto)}</strong></span>
          <span>ROAS <strong style={{ color: "#172033" }}>{roas(fat, gasto)}</strong></span>
        </div>
      )}
    </div>
  );
}
