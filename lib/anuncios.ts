import "server-only";
import { advPeloSufixo, type RegistroMin } from "./atribuicao";
import { COTACAO, ST, type AdvKey } from "./constantes";
import { prisma } from "./db";

export type Numeros = { leads: number; cot: number; vendas: number; fat: number; gasto: number; ultimo: number | null };
export type AnuncioView = {
  id: string; nome: string; status: string | null; thumb: string | null; titulo: string | null; texto: string | null;
  video: boolean; tipo: string | null; tipoNivel: "anuncio" | "conjunto" | "campanha" | null; n: Numeros;
};
export type ConjuntoView = { id: string; nome: string; status: string | null; tipo: string | null; anuncios: AnuncioView[]; n: Numeros };
export type CampanhaView = { id: string; nome: string; status: string | null; objetivo: string | null; tipo: string | null; conjuntos: ConjuntoView[]; n: Numeros };
export type ContaView = { id: string; nome: string; anunciante: AdvKey; ultimaSync: number | null; erro: string | null; campanhas: CampanhaView[]; n: Numeros };
export type SemVinculo = { adId: string; campanhaId: string | null; leads: number; ultimo: number; provavel: AdvKey };

const zero = (): Numeros => ({ leads: 0, cot: 0, vendas: 0, fat: 0, gasto: 0, ultimo: null });
const somar = (a: Numeros, b: Numeros) => {
  a.leads += b.leads; a.cot += b.cot; a.vendas += b.vendas; a.fat += b.fat; a.gasto += b.gasto;
  a.ultimo = Math.max(a.ultimo ?? 0, b.ultimo ?? 0) || null;
};

/** Catálogo do Meta + o que chegou no Kommo por anúncio no período. */
export async function carregarAnuncios(de: number, ate: number, filtroAdv: AdvKey | null, regs: Map<string, RegistroMin>) {
  const [contas, camps, sets, ads, leads, gastos] = await Promise.all([
    prisma.metaConta.findMany({ where: filtroAdv ? { anunciante: filtroAdv } : {}, orderBy: { nome: "asc" } }),
    prisma.metaCampanha.findMany({ orderBy: { criadoEm: "desc" } }),
    prisma.metaConjunto.findMany({ orderBy: { nome: "asc" } }),
    prisma.metaAnuncio.findMany({ orderBy: { criadoEm: "desc" } }),
    prisma.lead.findMany({
      where: { createdAt: { gte: new Date(de * 1000), lt: new Date(ate * 1000) }, adId: { not: null } },
      select: { adId: true, campaignId: true, statusId: true, stages: true, price: true, createdAt: true },
    }),
    prisma.metaGasto.groupBy({
      by: ["adId"], _sum: { gasto: true },
      where: { data: { gte: new Date(de * 1000).toISOString().slice(0, 10), lt: new Date(ate * 1000).toISOString().slice(0, 10) } },
    }),
  ]);

  const porAd = new Map<string, Numeros>();
  for (const l of leads) {
    const n = porAd.get(l.adId!) ?? zero();
    const s = new Set([...l.stages, l.statusId]);
    n.leads++;
    if (COTACAO.some((x) => s.has(x))) n.cot++;
    if (l.statusId === ST.GANHO) { n.vendas++; n.fat += l.price; }
    n.ultimo = Math.max(n.ultimo ?? 0, Math.floor(l.createdAt.getTime() / 1000));
    porAd.set(l.adId!, n);
  }
  for (const g of gastos) {
    const n = porAd.get(g.adId) ?? zero();
    n.gasto += g._sum.gasto ?? 0;
    porAd.set(g.adId, n);
  }

  const contaIds = new Set(contas.map((c) => c.id));
  const adsPorSet = new Map<string, typeof ads>();
  for (const a of ads) if (contaIds.has(a.contaId)) adsPorSet.set(a.conjuntoId, [...(adsPorSet.get(a.conjuntoId) ?? []), a]);
  const setsPorCamp = new Map<string, typeof sets>();
  for (const s of sets) if (contaIds.has(s.contaId)) setsPorCamp.set(s.campanhaId, [...(setsPorCamp.get(s.campanhaId) ?? []), s]);

  const arvore: ContaView[] = contas.map((c) => {
    const nc = zero();
    const campanhas: CampanhaView[] = camps.filter((x) => x.contaId === c.id).map((cp) => {
      const ncp = zero();
      const regCamp = regs.get(cp.id);
      const conjuntos: ConjuntoView[] = (setsPorCamp.get(cp.id) ?? []).map((st) => {
        const ns = zero();
        const regSet = regs.get(st.id);
        const anuncios: AnuncioView[] = (adsPorSet.get(st.id) ?? []).map((a) => {
          const n = porAd.get(a.id) ?? zero();
          somar(ns, n);
          const regAd = regs.get(a.id);
          const reg = regAd ?? regSet ?? regCamp;
          return {
            id: a.id, nome: a.nome, status: a.effectiveStatus ?? a.status, thumb: a.thumbnail ?? a.imagem, titulo: a.titulo, texto: a.texto,
            video: !!a.videoId, tipo: reg?.tipo ?? null, tipoNivel: regAd ? "anuncio" : regSet ? "conjunto" : regCamp ? "campanha" : null, n,
          };
        });
        somar(ncp, ns);
        return { id: st.id, nome: st.nome, status: st.effectiveStatus ?? st.status, tipo: (regSet ?? regCamp)?.tipo ?? null, anuncios, n: ns };
      });
      somar(nc, ncp);
      return { id: cp.id, nome: cp.nome, status: cp.effectiveStatus ?? cp.status, objetivo: cp.objetivo, tipo: regCamp?.tipo ?? null, conjuntos, n: ncp };
    });
    // Campanhas, conjuntos e anúncios que mais trazem leads primeiro
    const porLeads = <T extends { n: Numeros }>(a: T, b: T) => b.n.leads - a.n.leads || b.n.gasto - a.n.gasto;
    campanhas.sort(porLeads);
    for (const cp of campanhas) { cp.conjuntos.sort(porLeads); for (const st of cp.conjuntos) st.anuncios.sort(porLeads); }
    return {
      id: c.id, nome: c.nome, anunciante: c.anunciante as AdvKey, ultimaSync: c.ultimaSync ? Math.floor(c.ultimaSync.getTime() / 1000) : null,
      erro: c.erro, campanhas, n: nc,
    };
  });

  // Leads que chegam de anúncios que não estão em nenhuma conta conectada
  const todosAds = new Set(ads.map((a) => a.id));
  const sv = new Map<string, SemVinculo>();
  for (const l of leads) {
    if (todosAds.has(l.adId!)) continue;
    const x = sv.get(l.adId!) ?? { adId: l.adId!, campanhaId: l.campaignId, leads: 0, ultimo: 0, provavel: advPeloSufixo(l.adId!) };
    x.leads++;
    x.ultimo = Math.max(x.ultimo, Math.floor(l.createdAt.getTime() / 1000));
    sv.set(l.adId!, x);
  }
  const semVinculo = [...sv.values()].filter((x) => !filtroAdv || x.provavel === filtroAdv).sort((a, b) => b.leads - a.leads);

  arvore.sort((a, b) => b.n.leads - a.n.leads);
  return { arvore, semVinculo };
}

/** Últimos leads de um anúncio (sem dados pessoais): data, etapa, vendedor, valor. */
export async function leadsRecentes(adId: string, limite = 15) {
  const [ls, sts, us] = await Promise.all([
    prisma.lead.findMany({ where: { adId }, orderBy: { createdAt: "desc" }, take: limite, select: { id: true, createdAt: true, statusId: true, responsibleUserId: true, price: true } }),
    prisma.kommoStatus.findMany(),
    prisma.kommoUser.findMany(),
  ]);
  const st = new Map(sts.map((s) => [s.id, s.name]));
  st.set(ST.GANHO, "Fechado - ganho");
  st.set(ST.PERDIDO, "Fechado - perdido");
  const u = new Map(us.map((x) => [x.id, x.name]));
  return ls.map((l) => ({
    id: l.id, em: Math.floor(l.createdAt.getTime() / 1000), etapa: st.get(l.statusId) ?? String(l.statusId),
    vendedor: l.responsibleUserId ? u.get(l.responsibleUserId) ?? "—" : "—", valor: l.statusId === ST.GANHO ? l.price : 0,
  }));
}
