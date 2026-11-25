import "server-only";
import { atribuir, type RegistroMin } from "./atribuicao";
import { COTACAO, NEGOCIACAO, QUALIFICADO, ST, type AdvKey, type Fonte, type TipoLead } from "./constantes";
import { prisma } from "./db";

/** Lead compacto enviado ao navegador — sem nome nem telefone de cliente. */
export type LeadView = {
  c: number; // criado em (unix s)
  f: Fonte;
  p: boolean; // atribuição provisória
  t: TipoLead;
  q: boolean; // qualificado
  ct: boolean; // chegou à cotação
  ng: boolean; // chegou à negociação
  w: boolean; // ganho
  l: boolean; // perdido
  nr: boolean; // parado em "Não responde primeiro contato"
  v: number; // valor (se ganho)
  r: number | null; // vendedor responsável
  d: string | null; // DDD
  pd: string | null; // motivo de perda
  k: string | null; // chave da campanha (id da campanha, ou do anúncio)
  h: string | null; // hash do telefone (duplicados)
  fr: number | null; // segundos até a 1ª resposta de uma pessoa (null = ninguém respondeu)
  hc: boolean; // chegou em horário comercial
};

/** Horário comercial (America/Sao_Paulo): seg–sex 8h–18h, sáb 8h–12h. */
function emHorarioComercial(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
  const h = Number(p.hour) % 24;
  if (p.weekday === "Sun") return false;
  if (p.weekday === "Sat") return h >= 8 && h < 12;
  return h >= 8 && h < 18;
}

export type CampanhaInfo = { nome: string; tipo: string | null; situacao: string | null; cadastrada: boolean };

export type Periodo = { de: number; ate: number; rotulo: string; chave: string; deStr: string; ateStr: string };

const TZ = "America/Sao_Paulo";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-DD
const inicioDia = (s: string) => Math.floor(new Date(s + "T00:00:00-03:00").getTime() / 1000);

export function resolverPeriodo(p: { periodo?: string; de?: string; ate?: string }): { atual: Periodo; anterior: Periodo } {
  const hoje = ymd(new Date());
  const [Y, M] = hoje.split("-").map(Number);
  const mesStr = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
  const somaDias = (s: string, n: number) => ymd(new Date(inicioDia(s) * 1000 + n * 86400000 + 12 * 3600000));
  const nomeMes = (s: string) => new Date(s + "T12:00:00-03:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: TZ });
  const mk = (chave: string, deStr: string, ateExcl: string, rotulo: string): Periodo => ({
    chave, deStr, ateStr: somaDias(ateExcl, -1), de: inicioDia(deStr), ate: inicioDia(ateExcl), rotulo,
  });
  const chave = p.periodo ?? "mes";
  let atual: Periodo;
  if (chave === "mes-anterior") {
    const [y, m] = M === 1 ? [Y - 1, 12] : [Y, M - 1];
    atual = mk(chave, mesStr(y, m), mesStr(Y, M), nomeMes(mesStr(y, m)));
  } else if (chave === "7d" || chave === "30d") {
    const n = chave === "7d" ? 7 : 30;
    atual = mk(chave, somaDias(hoje, -(n - 1)), somaDias(hoje, 1), `Últimos ${n} dias`);
  } else if (chave === "custom" && p.de && p.ate && /^\d{4}-\d{2}-\d{2}$/.test(p.de) && /^\d{4}-\d{2}-\d{2}$/.test(p.ate) && p.de <= p.ate) {
    atual = mk(chave, p.de, somaDias(p.ate, 1), `${p.de.split("-").reverse().join("/")} a ${p.ate.split("-").reverse().join("/")}`);
  } else {
    const [y2, m2] = M === 12 ? [Y + 1, 1] : [Y, M + 1];
    atual = mk("mes", mesStr(Y, M), somaDias(hoje, 1) < mesStr(y2, m2) ? somaDias(hoje, 1) : mesStr(y2, m2), nomeMes(mesStr(Y, M)));
  }
  const dur = atual.ate - atual.de;
  const anterior: Periodo = { ...atual, de: atual.de - dur, ate: atual.de, rotulo: "período anterior" };
  return { atual, anterior };
}

export async function carregarRegistros() {
  const regs = await prisma.metaRegistro.findMany();
  return new Map<string, RegistroMin>(regs.map((r) => [r.metaId, r]));
}

/** metaId (anúncio, conjunto ou campanha) → anunciante, pela conta do Meta conectada. */
export async function carregarDonosMeta() {
  const contas = await prisma.metaConta.findMany({ select: { id: true, anunciante: true } });
  const dono = new Map(contas.map((c) => [c.id, c.anunciante as AdvKey]));
  const m = new Map<string, AdvKey>();
  const [ads, sets, camps] = await Promise.all([
    prisma.metaAnuncio.findMany({ select: { id: true, contaId: true } }),
    prisma.metaConjunto.findMany({ select: { id: true, contaId: true } }),
    prisma.metaCampanha.findMany({ select: { id: true, contaId: true } }),
  ]);
  for (const x of [...ads, ...sets, ...camps]) { const a = dono.get(x.contaId); if (a) m.set(x.id, a); }
  return m;
}

export async function carregarLeads(de: number, ate: number, regs: Map<string, RegistroMin>, donos?: Map<string, AdvKey>) {
  const rows = await prisma.lead.findMany({ where: { createdAt: { gte: new Date(de * 1000), lt: new Date(ate * 1000) } } });
  const chaves = [...new Set(rows.map((l) => l.campaignId ?? l.adId).filter((x): x is string => !!x))];
  const [nomesCamp, nomesAd] = await Promise.all([
    prisma.metaCampanha.findMany({ where: { id: { in: chaves } }, select: { id: true, nome: true, effectiveStatus: true } }),
    prisma.metaAnuncio.findMany({ where: { id: { in: chaves } }, select: { id: true, nome: true, effectiveStatus: true } }),
  ]);
  const nomeMeta = new Map([...nomesCamp, ...nomesAd].map((x) => [x.id, x]));
  const campanhas: Record<string, CampanhaInfo> = {};
  const leads: LeadView[] = rows.map((l) => {
    const a = atribuir({ adId: l.adId, adsetId: l.adsetId, campaignId: l.campaignId, tags: l.tags }, regs, donos);
    const st = new Set<number>(l.stages);
    st.add(l.statusId);
    const has = (lista: number[]) => lista.some((x) => st.has(x));
    const k = l.campaignId ?? l.adId ?? null;
    if (k && !campanhas[k]) {
      const reg = (l.campaignId && regs.get(l.campaignId)) || (l.adId && regs.get(l.adId)) || null;
      const nm = nomeMeta.get(k);
      const sitMeta = nm?.effectiveStatus === "ACTIVE" ? "ativa" : nm?.effectiveStatus ? "pausada" : null;
      campanhas[k] = {
        nome: nm?.nome ?? (reg && reg.nome !== "(dar um nome)" ? reg.nome : (l.campaignId ? "Campanha " : "Anúncio ") + "…" + k.slice(-6)),
        tipo: reg?.tipo ?? null,
        situacao: sitMeta ?? reg?.situacao ?? null,
        cadastrada: !!(nm || reg),
      };
    }
    return {
      c: Math.floor(l.createdAt.getTime() / 1000), f: a.fonte, p: a.provisorio, t: a.tipo,
      q: has(QUALIFICADO), ct: has(COTACAO), ng: has(NEGOCIACAO),
      w: l.statusId === ST.GANHO, l: l.statusId === ST.PERDIDO, nr: l.statusId === ST.NAO_RESPONDE,
      v: l.statusId === ST.GANHO ? l.price : 0, r: l.responsibleUserId, d: l.ddd, pd: l.statusId === ST.PERDIDO ? l.lossReason : null,
      k, h: l.phoneHash && l.phoneHash !== "sem-telefone" ? l.phoneHash : null,
      fr: l.primeiraResposta ? Math.max(0, Math.round((l.primeiraResposta.getTime() - l.createdAt.getTime()) / 1000)) : null,
      hc: emHorarioComercial(l.createdAt),
    };
  });
  return { leads, campanhas };
}

/** Investimento no Meta (contas conectadas) no período, por anúncio, já com dono e tipo. */
export type GastoView = { f: AdvKey; t: TipoLead; k: string; v: number };

export async function carregarGastos(de: number, ate: number, regs: Map<string, RegistroMin>): Promise<GastoView[]> {
  const dia = (s: number) => new Date(s * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [somas, ads, contas] = await Promise.all([
    prisma.metaGasto.groupBy({ by: ["adId"], _sum: { gasto: true }, where: { data: { gte: dia(de), lt: dia(ate) } } }),
    prisma.metaAnuncio.findMany({ select: { id: true, conjuntoId: true, campanhaId: true, contaId: true } }),
    prisma.metaConta.findMany({ select: { id: true, anunciante: true } }),
  ]);
  const ad = new Map(ads.map((a) => [a.id, a]));
  const dono = new Map(contas.map((c) => [c.id, c.anunciante as AdvKey]));
  const out: GastoView[] = [];
  for (const g of somas) {
    const a = ad.get(g.adId), v = g._sum.gasto ?? 0;
    if (!a || !v) continue;
    const f = dono.get(a.contaId);
    if (!f) continue;
    const reg = regs.get(a.id) ?? regs.get(a.conjuntoId) ?? regs.get(a.campanhaId);
    const t: TipoLead = reg?.tipo === "motor" || reg?.tipo === "peca" ? reg.tipo : "?";
    out.push({ f, t, k: a.campanhaId, v });
  }
  return out;
}

export async function carregarVendedores(anonimizar: boolean) {
  const us = await prisma.kommoUser.findMany({ orderBy: { name: "asc" } });
  return Object.fromEntries(us.map((u, i) => [u.id, anonimizar ? `Vendedor ${i + 1}` : u.name])) as Record<number, string>;
}

/** IDs do Meta que aparecem nos leads e não têm cadastro (fila "sem dono"). */
export async function idsSemDono(regs: Map<string, RegistroMin>, donos?: Map<string, AdvKey>) {
  const rows = await prisma.lead.findMany({ select: { adId: true, adsetId: true, campaignId: true, createdAt: true } });
  const fila = new Map<string, { metaId: string; nivel: "campanha" | "anuncio"; leads: number; desde: number; adExemplo: string | null }>();
  for (const l of rows) {
    if ([l.adId, l.adsetId, l.campaignId].some((x) => x && (regs.has(x) || donos?.has(x)))) continue;
    const metaId = l.campaignId ?? l.adId;
    if (!metaId) continue;
    const c = Math.floor(l.createdAt.getTime() / 1000);
    const it = fila.get(metaId) ?? { metaId, nivel: l.campaignId ? "campanha" : "anuncio", leads: 0, desde: c, adExemplo: l.adId };
    it.leads++;
    it.desde = Math.min(it.desde, c);
    fila.set(metaId, it);
  }
  return [...fila.values()].sort((a, b) => b.leads - a.leads);
}

export async function contarLeadsPorMetaId(regs: Map<string, RegistroMin>) {
  const rows = await prisma.lead.findMany({ select: { adId: true, adsetId: true, campaignId: true } });
  const n = new Map<string, number>();
  for (const l of rows) for (const id of [l.adId, l.adsetId, l.campaignId]) if (id && regs.has(id)) n.set(id, (n.get(id) ?? 0) + 1);
  return n;
}

export async function linkPublicoAtivo() {
  return (await prisma.publicLink.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } }))?.token ?? null;
}
