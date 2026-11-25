import { ADV_KEYS, type AdvKey } from "./constantes";
import { decifrar, provaSegredo } from "./cripto";
import { prisma } from "./db";
import { avisarAtualizacao } from "./eventos";
import { urlPublica } from "./url";

// Leitura do Meta (Graph API) — somente leitura.
// Acesso por duas vias:
//  1) "Conectar com Facebook" (popup OAuth): token do usuário guardado criptografado em meta_conexoes;
//     cada conta escolhida fica ligada a um anunciante em meta_contas.
//  2) Tokens fixos no .env (usuário do sistema): META_TOKEN_<NOME> + META_CONTAS_<NOME>.

const VERSAO = process.env.META_GRAPH_VERSION || "v24.0";
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

export const appConfigurado = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
export function tokenDe(adv: AdvKey) {
  return process.env[`META_TOKEN_${adv.toUpperCase()}`]?.trim() || null;
}
export const metaConfigurado = () => appConfigurado() || ADV_KEYS.some((a) => tokenDe(a));

type Pagina<T> = { data: T[]; paging?: { next?: string } };
type ErroMeta = { error?: { message: string; code: number; error_subcode?: number } };
type Acesso = { token: string; doApp: boolean; conexaoId: number | null };

export class TokenInvalido extends Error {}

async function graph<T>(url: string, ac: Acesso): Promise<T> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const u = new URL(url.startsWith("http") ? url : GRAPH + url);
    u.searchParams.set("access_token", ac.token);
    if (ac.doApp && process.env.META_APP_SECRET) u.searchParams.set("appsecret_proof", provaSegredo(ac.token, process.env.META_APP_SECRET));
    const r = await fetch(u, { cache: "no-store" });
    const j = (await r.json()) as T & ErroMeta;
    if (j.error) {
      if ([4, 17, 32, 613, 80004].includes(j.error.code)) { await new Promise((ok) => setTimeout(ok, 5000 * (tentativa + 1))); continue; }
      if (j.error.code === 190) throw new TokenInvalido("O acesso ao Facebook expirou ou foi removido. Clique em “Reconectar”.");
      throw new Error(`Meta: ${j.error.message} (${j.error.code})`);
    }
    return j;
  }
  throw new Error("O Meta limitou as requisições. Tente de novo em alguns minutos.");
}

async function todas<T>(path: string, ac: Acesso, limite = 5000): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  while (next && out.length < limite) {
    const p: Pagina<T> = await graph<Pagina<T>>(next, ac);
    out.push(...p.data);
    next = p.paging?.next;
  }
  return out;
}

// ---------------------------------------------------------------- OAuth (popup)
/** Endereço de volta do login do Facebook — precisa estar em "URIs de redirecionamento do OAuth válidos" no app da Meta. */
export async function urlRetorno() {
  return (await urlPublica()) + "/api/meta/callback";
}

export async function urlLogin(state: string) {
  const u = new URL(`https://www.facebook.com/${VERSAO}/dialog/oauth`);
  u.searchParams.set("client_id", process.env.META_APP_ID!);
  u.searchParams.set("redirect_uri", await urlRetorno());
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("display", "popup");
  // App do tipo "Empresa" usa Login do Facebook para Empresas (config_id); senão, escopo clássico.
  if (process.env.META_LOGIN_CONFIG_ID) u.searchParams.set("config_id", process.env.META_LOGIN_CONFIG_ID);
  else u.searchParams.set("scope", "ads_read");
  return u.toString();
}

/** Troca o código do popup por um token de ~60 dias e lista as contas de anúncio liberadas. */
export async function concluirLogin(code: string) {
  const id = process.env.META_APP_ID!, segredo = process.env.META_APP_SECRET!;
  const curto = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({ client_id: id, client_secret: segredo, redirect_uri: await urlRetorno(), code }), { cache: "no-store" })
    .then((r) => r.json() as Promise<{ access_token?: string } & ErroMeta>);
  if (!curto.access_token) throw new Error(curto.error?.message ?? "O Facebook não devolveu o acesso.");
  const longo = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({ grant_type: "fb_exchange_token", client_id: id, client_secret: segredo, fb_exchange_token: curto.access_token }), { cache: "no-store" })
    .then((r) => r.json() as Promise<{ access_token?: string; expires_in?: number } & ErroMeta>);
  const token = longo.access_token ?? curto.access_token;
  const ac: Acesso = { token, doApp: true, conexaoId: null };
  const eu = await graph<{ id: string; name: string }>("/me?fields=id,name", ac);
  const contas = await todas<{ id: string; name: string; account_status?: number }>("/me/adaccounts?fields=id,name,account_status&limit=100", ac);
  return {
    token, fbUserId: eu.id, fbNome: eu.name,
    expiraEm: longo.expires_in ? new Date(Date.now() + longo.expires_in * 1000) : new Date(Date.now() + 60 * 86400000),
    contas: contas.map((c) => ({ id: c.id, name: c.name, ativa: c.account_status === 1 })),
  };
}

// ---------------------------------------------------------------- sincronização
type Alvo = { contaId: string; anunciante: AdvKey; ac: Acesso; nome?: string };

async function alvos(erros: string[]): Promise<Alvo[]> {
  const lista = new Map<string, Alvo>();
  // 1) contas ligadas a conexões do popup
  const conexoes = await prisma.metaConexao.findMany({ where: { invalida: false } });
  const tokenConexao = new Map<number, string>();
  for (const c of conexoes) { try { tokenConexao.set(c.id, decifrar(c.tokenCifrado)); } catch { erros.push(`Conexão de ${c.fbNome}: não deu para ler o acesso guardado; reconecte.`); } }
  for (const conta of await prisma.metaConta.findMany({ where: { conexaoId: { not: null } } })) {
    const tk = tokenConexao.get(conta.conexaoId!);
    if (tk) lista.set(conta.id, { contaId: conta.id, anunciante: conta.anunciante as AdvKey, ac: { token: tk, doApp: true, conexaoId: conta.conexaoId }, nome: conta.nome });
  }
  // 2) tokens do .env
  for (const adv of ADV_KEYS) {
    const token = tokenDe(adv);
    if (!token) continue;
    const ac: Acesso = { token, doApp: false, conexaoId: null };
    try {
      const fixas = process.env[`META_CONTAS_${adv.toUpperCase()}`]?.split(",").map((s) => s.trim()).filter(Boolean);
      const contas = fixas?.length ? fixas.map((id) => ({ id: id.startsWith("act_") ? id : "act_" + id, name: undefined as string | undefined }))
        : await todas<{ id: string; name: string }>("/me/adaccounts?fields=id,name&limit=100", ac);
      for (const c of contas) if (!lista.has(c.id)) lista.set(c.id, { contaId: c.id, anunciante: adv, ac, nome: c.name });
    } catch (e) { erros.push(`${adv} (.env): ${(e as Error).message}`); }
  }
  return [...lista.values()];
}

const dataOuNull = (s?: string) => (s ? new Date(s) : null);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

type Ad = {
  id: string; name: string; adset_id: string; campaign_id: string; status?: string; effective_status?: string;
  created_time?: string; updated_time?: string;
  creative?: { id: string; thumbnail_url?: string; image_url?: string; video_id?: string; title?: string; body?: string };
};

export type ResultadoMeta = { contas: number; campanhas: number; conjuntos: number; anuncios: number; gastos: number; erros: string[] };

/** Lê contas, campanhas, conjuntos, anúncios (com criativo) e investimento dos últimos N dias. */
export async function sincronizarMeta(opcoes: { somenteContas?: string[] } = {}): Promise<ResultadoMeta> {
  const dias = Number(process.env.META_DIAS_GASTO ?? 90);
  const res: ResultadoMeta = { contas: 0, campanhas: 0, conjuntos: 0, anuncios: 0, gastos: 0, erros: [] };
  const ate = new Date(), desde = new Date(Date.now() - dias * 86400000);
  const invalidas = new Set<number>();

  for (const a of await alvos(res.erros)) {
    if (opcoes.somenteContas && !opcoes.somenteContas.includes(a.contaId)) continue;
    if (a.ac.conexaoId && invalidas.has(a.ac.conexaoId)) continue;
    const c = a.contaId;
    try {
      const info = await graph<{ id: string; name: string; currency?: string; account_status?: number }>(`/${c}?fields=id,name,currency,account_status`, a.ac);
      await prisma.metaConta.upsert({
        where: { id: c },
        create: { id: c, nome: info.name, anunciante: a.anunciante, moeda: info.currency, status: info.account_status, conexaoId: a.ac.conexaoId },
        update: { nome: info.name, moeda: info.currency, status: info.account_status, erro: null },
      });
      res.contas++;

      const camps = await todas<{ id: string; name: string; objective?: string; status?: string; effective_status?: string; created_time?: string }>(
        `/${c}/campaigns?fields=id,name,objective,status,effective_status,created_time&limit=200`, a.ac);
      for (const x of camps) {
        const d = { contaId: c, nome: x.name, objetivo: x.objective, status: x.status, effectiveStatus: x.effective_status, criadoEm: dataOuNull(x.created_time) };
        await prisma.metaCampanha.upsert({ where: { id: x.id }, create: { id: x.id, ...d }, update: d });
      }
      res.campanhas += camps.length;

      const sets = await todas<{ id: string; name: string; campaign_id: string; status?: string; effective_status?: string }>(
        `/${c}/adsets?fields=id,name,campaign_id,status,effective_status&limit=200`, a.ac);
      for (const x of sets) {
        const d = { contaId: c, campanhaId: x.campaign_id, nome: x.name, status: x.status, effectiveStatus: x.effective_status };
        await prisma.metaConjunto.upsert({ where: { id: x.id }, create: { id: x.id, ...d }, update: d });
      }
      res.conjuntos += sets.length;

      const ads = await todas<Ad>(
        `/${c}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time,creative{id,thumbnail_url,image_url,video_id,title,body}&thumbnail_width=320&thumbnail_height=320&limit=100`, a.ac);
      for (const x of ads) {
        const d = {
          contaId: c, campanhaId: x.campaign_id, conjuntoId: x.adset_id, nome: x.name, status: x.status, effectiveStatus: x.effective_status,
          criadoEm: dataOuNull(x.created_time), atualizadoEm: dataOuNull(x.updated_time),
          criativoId: x.creative?.id ?? null, thumbnail: x.creative?.thumbnail_url ?? null, imagem: x.creative?.image_url ?? null,
          videoId: x.creative?.video_id ?? null, titulo: x.creative?.title ?? null, texto: x.creative?.body?.slice(0, 2000) ?? null,
        };
        await prisma.metaAnuncio.upsert({ where: { id: x.id }, create: { id: x.id, ...d }, update: d });
      }
      res.anuncios += ads.length;

      const tr = encodeURIComponent(JSON.stringify({ since: ymd(desde), until: ymd(ate) }));
      const ins = await todas<{ ad_id: string; date_start: string; spend?: string; impressions?: string; clicks?: string }>(
        `/${c}/insights?level=ad&fields=ad_id,spend,impressions,clicks&time_increment=1&time_range=${tr}&limit=500`, a.ac, 100000);
      for (const g of ins) {
        const d = { contaId: c, gasto: Number(g.spend ?? 0), impressoes: Number(g.impressions ?? 0), cliques: Number(g.clicks ?? 0) };
        await prisma.metaGasto.upsert({ where: { adId_data: { adId: g.ad_id, data: g.date_start } }, create: { adId: g.ad_id, data: g.date_start, ...d }, update: d });
      }
      res.gastos += ins.length;
      await prisma.metaConta.update({ where: { id: c }, data: { ultimaSync: new Date(), erro: null } });
    } catch (e) {
      const msg = (e as Error).message;
      res.erros.push(`${a.nome ?? c}: ${msg}`);
      if (e instanceof TokenInvalido && a.ac.conexaoId) {
        invalidas.add(a.ac.conexaoId);
        await prisma.metaConexao.update({ where: { id: a.ac.conexaoId }, data: { invalida: true } }).catch(() => {});
      }
      await prisma.metaConta.update({ where: { id: c }, data: { erro: msg.slice(0, 300) } }).catch(() => {});
    }
  }
  const agora = String(Math.floor(Date.now() / 1000));
  await prisma.syncState.upsert({ where: { key: "meta_ultima_sync" }, create: { key: "meta_ultima_sync", value: agora }, update: { value: agora } });
  await avisarAtualizacao("meta");
  return res;
}

const g = globalThis as unknown as { __metaSync?: Promise<ResultadoMeta> | null };
export function sincronizarMetaUmaVez() {
  if (!g.__metaSync) g.__metaSync = sincronizarMeta().finally(() => (g.__metaSync = null));
  return g.__metaSync;
}

// ---------------------------------------------------------------- prévia
export const FORMATOS_PREVIA = {
  MOBILE_FEED_STANDARD: "Feed do Facebook",
  INSTAGRAM_STANDARD: "Feed do Instagram",
  INSTAGRAM_STORY: "Stories do Instagram",
  INSTAGRAM_REELS: "Reels do Instagram",
  FACEBOOK_STORY_MOBILE: "Stories do Facebook",
} as const;
export type FormatoPrevia = keyof typeof FORMATOS_PREVIA;

async function acessoDaConta(contaId: string): Promise<Acesso | null> {
  const conta = await prisma.metaConta.findUnique({ where: { id: contaId } });
  if (!conta) return null;
  if (conta.conexaoId) {
    const cx = await prisma.metaConexao.findUnique({ where: { id: conta.conexaoId } });
    if (cx && !cx.invalida) { try { return { token: decifrar(cx.tokenCifrado), doApp: true, conexaoId: cx.id }; } catch { /* reconectar */ } }
  }
  const tk = tokenDe(conta.anunciante as AdvKey);
  return tk ? { token: tk, doApp: false, conexaoId: null } : null;
}

/** Endereço do iframe de prévia que o próprio Meta gera para o anúncio. */
export async function previaAnuncio(adId: string, formato: FormatoPrevia) {
  const ad = await prisma.metaAnuncio.findUnique({ where: { id: adId } });
  if (!ad) throw new Error("Anúncio não encontrado no catálogo do Meta.");
  const ac = await acessoDaConta(ad.contaId);
  if (!ac) throw new Error("A conta deste anúncio não está conectada. Use “Conectar com Facebook”.");
  const r = await graph<Pagina<{ body: string }>>(`/${adId}/previews?ad_format=${formato}`, ac);
  const src = r.data[0]?.body.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  if (!src || !src.startsWith("https://")) throw new Error("O Meta não gerou prévia para este formato.");
  return src;
}
