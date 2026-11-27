import { CANAL_DONO, type AdvKey, type Fonte, type Situacao, type Tipo, type TipoLead } from "./constantes";

export type RegistroMin = { metaId: string; nivel: string; nome: string; anunciante: string; tipo: string; situacao: string };
export type LeadMin = { adId: string | null; adsetId: string | null; campaignId: string | null; tags: string[]; sourceId?: number | null };

export type Atribuicao = {
  fonte: Fonte;
  provisorio: boolean; // true = tem ID do Meta que ninguém cadastrou (regra do final do ID); dá para corrigir em /ids
  tipo: TipoLead;
  registro: RegistroMin | null; // cadastro do gestor (anúncio > conjunto > campanha)
  origem: "meta" | "cadastro" | "sufixo" | "tag" | "canal" | "nenhuma";
};

/** Regra antiga (provisória): final do ID do anúncio do Meta. */
export function advPeloSufixo(adId: string): AdvKey {
  if (adId.endsWith("0194")) return "marcos";
  if (adId.endsWith("0508")) return "matra";
  return "alex";
}

function advPelasTags(tags: string[]): AdvKey | null {
  const t = new Set(tags.map((x) => x.toUpperCase()));
  if (t.has("CAMPANHA MARCOS")) return "marcos";
  if (t.has("CAMPANHA MATRA")) return "matra";
  if (t.has("CAMPANHA ALEX")) return "alex";
  return null;
}

function tipoPelasTags(tags: string[]): TipoLead {
  const t = tags.map((x) => x.toLowerCase());
  if (t.some((x) => x === "motor")) return "motor";
  if (t.some((x) => x.startsWith("pe") && x.length <= 5)) return "peca";
  return "?";
}

/**
 * Decide anunciante e tipo de um lead.
 * Dono: 1) conta do Meta conectada (certo)  2) cadastro do gestor  3) regra provisória (final do ID / tags).
 * Tipo: cadastro do gestor (anúncio > conjunto > campanha), senão tags do robô.
 */
export function atribuir(lead: LeadMin, regs: Map<string, RegistroMin>, donosMeta?: Map<string, AdvKey>): Atribuicao {
  const ids = [lead.adId, lead.adsetId, lead.campaignId];
  const reg = ids.map((id) => (id ? regs.get(id) : undefined)).find(Boolean) ?? null;
  const tipo: TipoLead = reg && (reg.tipo === "motor" || reg.tipo === "peca") ? reg.tipo : tipoPelasTags(lead.tags);
  const meta = donosMeta ? ids.map((id) => (id ? donosMeta.get(id) : undefined)).find(Boolean) : undefined;
  if (meta) return { fonte: meta, provisorio: false, tipo, registro: reg, origem: "meta" };
  if (reg) return { fonte: reg.anunciante as AdvKey, provisorio: false, tipo, registro: reg, origem: "cadastro" };
  if (lead.adId) return { fonte: advPeloSufixo(lead.adId), provisorio: true, tipo, registro: null, origem: "sufixo" };
  // sem ID do anúncio: o número de WhatsApp por onde entrou diz de quem é (mais confiável que as tags do robô)
  const porCanal = lead.sourceId ? CANAL_DONO[lead.sourceId] : undefined;
  if (porCanal) return { fonte: porCanal, provisorio: false, tipo, registro: null, origem: "canal" };
  const porTag = advPelasTags(lead.tags);
  if (porTag) return { fonte: porTag, provisorio: false, tipo, registro: null, origem: "tag" };
  // entrou por um canal (WhatsApp) desconhecido sem ID do anúncio: conta como anúncio, sem saber de quem
  if (lead.sourceId) return { fonte: "nid", provisorio: false, tipo, registro: null, origem: "canal" };
  // criado à mão pelo vendedor: venda por fora
  return { fonte: "sem", provisorio: false, tipo, registro: null, origem: "nenhuma" };
}

export const tipoValido = (t: string): t is Tipo => ["motor", "peca", "misto", "definir"].includes(t);
export const situacaoValida = (s: string): s is Situacao => ["ativa", "pausada", "encerrada"].includes(s);
