import { createHash } from "node:crypto";
import { prisma } from "./db";
import { avisarAtualizacao } from "./eventos";

// Sincronização Kommo → banco. Só LÊ o Kommo; nunca grava nada no CRM.

const BASE = (process.env.KOMMO_BASE_URL ?? "https://comafeoficial.kommo.com").replace(/\/$/, "") + "/api/v4";
const PIPELINE = Number(process.env.KOMMO_PIPELINE_ID ?? 14542159);
const F_AD = 627039, F_ADSET = 627041, F_CAMPAIGN = 627043;
const F_FECHAMENTO = 631353; // campo "Data de Fechamento": quando preenchido, é a data real da venda

type KLead = {
  id: number; pipeline_id: number; status_id: number; price: number | null; responsible_user_id: number;
  created_at: number; updated_at: number; closed_at: number | null; source_id?: number | null;
  custom_fields_values: { field_id: number; values: { value: unknown }[] }[] | null;
  _embedded?: { tags?: { name: string }[]; contacts?: { id: number; is_main?: boolean }[]; loss_reason?: { name: string }[] };
};

async function kommo<T>(path: string): Promise<T | null> {
  const token = process.env.KOMMO_TOKEN;
  if (!token) throw new Error("KOMMO_TOKEN não configurado no .env");
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (r.status === 204) return null;
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (tentativa + 1))); continue; }
    if (r.status === 401) throw new Error("O Kommo recusou o token (401). Ele pode ter expirado: gere outro em Configurações > Integrações e atualize KOMMO_TOKEN.");
    if (!r.ok) throw new Error(`O Kommo respondeu ${r.status} em ${path.split("?")[0]}`);
    return (await r.json()) as T;
  }
  throw new Error("O Kommo limitou as requisições (429). Tente de novo em alguns minutos.");
}

const campo = (l: KLead, id: number) => {
  const v = l.custom_fields_values?.find((f) => f.field_id === id)?.values?.[0]?.value;
  return v == null || v === "" ? null : String(v);
};
const data = (s: number) => new Date(s * 1000);
// data em que o lead fechou: o campo "Data de Fechamento" vale mais que o closed_at do Kommo (que é quando mudaram a etapa)
const fechouEm = (l: KLead) => {
  const v = campo(l, F_FECHAMENTO);
  const s = v == null ? NaN : /^\d+$/.test(v) ? Number(v) : Math.floor(Date.parse(v) / 1000);
  return Number.isFinite(s) && s > 0 ? s : l.closed_at;
};

async function lerEstado(key: string) {
  return (await prisma.syncState.findUnique({ where: { key } }))?.value ?? null;
}
async function gravarEstado(key: string, value: string) {
  await prisma.syncState.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export type ResultadoSync = { leads: number; etapas: number; contatos: number; respostas: number; inicio: number; fim: number };

/**
 * Busca no Kommo os leads do funil principal alterados desde a última execução
 * (na primeira vez, desde SYNC_DESDE), o histórico de etapas e o DDD do contato.
 */
export async function sincronizar(opcoes: { completo?: boolean } = {}): Promise<ResultadoSync> {
  const inicio = Math.floor(Date.now() / 1000);
  const desdePadrao = Math.floor(new Date((process.env.SYNC_DESDE ?? "2026-10-01") + "T00:00:00-03:00").getTime() / 1000);
  const ultimo = opcoes.completo ? null : await lerEstado("leads_ate");
  const desde = ultimo ? Number(ultimo) - 300 : desdePadrao;

  // Vendedores e etapas
  const users = await kommo<{ _embedded: { users: { id: number; name: string }[] } }>("/users?limit=250");
  for (const u of users?._embedded.users ?? []) {
    await prisma.kommoUser.upsert({ where: { id: u.id }, create: { id: u.id, name: u.name }, update: { name: u.name } });
  }
  const pipe = await kommo<{ _embedded: { statuses: { id: number; name: string; sort: number }[] } }>(`/leads/pipelines/${PIPELINE}`);
  for (const s of pipe?._embedded.statuses ?? []) {
    await prisma.kommoStatus.upsert({
      where: { id: s.id },
      create: { id: s.id, pipelineId: PIPELINE, name: s.name, sort: s.sort },
      update: { name: s.name, sort: s.sort },
    });
  }

  // 1) Leads alterados
  const alterados: KLead[] = [];
  for (let page = 1; page < 400; page++) {
    const r = await kommo<{ _embedded: { leads: KLead[] } }>(
      `/leads?limit=250&page=${page}&with=contacts,loss_reason,source_id&filter[pipeline_id]=${PIPELINE}&filter[updated_at][from]=${desde}&order[updated_at]=asc`,
    );
    const ls = r?._embedded?.leads ?? [];
    // leads criados desde SYNC_DESDE, e também os mais antigos que fecharam depois disso (a venda conta no mês em que fechou)
    alterados.push(...ls.filter((l) => l.created_at >= desdePadrao || (fechouEm(l) ?? 0) >= desdePadrao));
    if (ls.length < 250) break;
  }
  for (const l of alterados) {
    const contato = l._embedded?.contacts?.find((c) => c.is_main) ?? l._embedded?.contacts?.[0];
    const row = {
      pipelineId: l.pipeline_id, statusId: l.status_id, createdAt: data(l.created_at), updatedAt: data(l.updated_at),
      closedAt: fechouEm(l) ? data(fechouEm(l)!) : null, price: Math.round(l.price ?? 0), responsibleUserId: l.responsible_user_id ?? null,
      adId: campo(l, F_AD), adsetId: campo(l, F_ADSET), campaignId: campo(l, F_CAMPAIGN),
      tags: (l._embedded?.tags ?? []).map((t) => t.name),
      lossReason: l._embedded?.loss_reason?.[0]?.name ?? null,
      contactId: contato?.id ?? null,
      sourceId: l.source_id ?? null,
    };
    await prisma.lead.upsert({ where: { id: l.id }, create: { id: l.id, ...row, stages: [l.status_id] }, update: row });
  }

  // 2) Histórico de etapas (eventos de mudança de etapa)
  const ultimoEv = opcoes.completo ? null : await lerEstado("eventos_ate");
  const desdeEv = ultimoEv ? Number(ultimoEv) - 300 : desdePadrao;
  const passou = new Map<number, Set<number>>();
  for (let page = 1; page < 2000; page++) {
    const r = await kommo<{ _embedded: { events: { entity_id: number; value_after: { lead_status?: { id: number; pipeline_id: number } }[] }[] } }>(
      `/events?limit=100&page=${page}&filter[type]=lead_status_changed&filter[entity]=lead&filter[created_at][from]=${desdeEv}`,
    );
    const evs = r?._embedded?.events ?? [];
    for (const e of evs) {
      const st = e.value_after?.[0]?.lead_status;
      if (!st || st.pipeline_id !== PIPELINE) continue;
      if (!passou.has(e.entity_id)) passou.set(e.entity_id, new Set());
      passou.get(e.entity_id)!.add(st.id);
    }
    if (evs.length < 100) break;
  }
  const ids = Array.from(new Set([...passou.keys(), ...alterados.map((l) => l.id)]));
  let etapas = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const atuais = await prisma.lead.findMany({ where: { id: { in: ids.slice(i, i + 500) } }, select: { id: true, stages: true, statusId: true } });
    for (const a of atuais) {
      const s = new Set<number>(a.stages);
      passou.get(a.id)?.forEach((x) => s.add(x));
      s.add(a.statusId);
      if (s.size !== a.stages.length) await prisma.lead.update({ where: { id: a.id }, data: { stages: [...s] } });
      etapas++;
    }
  }

  // 3) DDD e hash do telefone dos contatos que ainda não têm
  const semDdd = await prisma.lead.findMany({ where: { contactId: { not: null }, phoneHash: null }, select: { id: true, contactId: true } });
  const porContato = new Map<number, number[]>();
  semDdd.forEach((l) => porContato.set(l.contactId!, [...(porContato.get(l.contactId!) ?? []), l.id]));
  const cids = [...porContato.keys()];
  let contatos = 0;
  for (let i = 0; i < cids.length; i += 50) {
    const q = cids.slice(i, i + 50).map((c) => `filter[id][]=${c}`).join("&");
    const r = await kommo<{ _embedded: { contacts: { id: number; custom_fields_values: { field_code?: string; values: { value: string }[] }[] | null }[] } }>(`/contacts?limit=250&${q}`);
    for (const c of r?._embedded?.contacts ?? []) {
      const tel = c.custom_fields_values?.find((f) => f.field_code === "PHONE")?.values?.[0]?.value ?? "";
      let d = String(tel).replace(/\D/g, "");
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      const ddd = d.length >= 10 ? d.slice(0, 2) : null;
      const phoneHash = d.length >= 8 ? createHash("sha256").update(d.slice(-10)).digest("hex").slice(0, 16) : "sem-telefone";
      await prisma.lead.updateMany({ where: { id: { in: porContato.get(c.id) ?? [] } }, data: { ddd, phoneHash } });
      contatos++;
    }
  }

  // 4) Primeira resposta de uma pessoa: mensagens enviadas no chat (created_by 0 = robô/automação, fica de fora)
  const ultimoMsg = opcoes.completo ? null : await lerEstado("respostas_ate");
  const desdeMsg = ultimoMsg ? Number(ultimoMsg) - 300 : desdePadrao;
  const primeira = new Map<number, { t: number; u: number }>();
  for (let page = 1; page < 5000; page++) {
    const r = await kommo<{ _embedded: { events: { entity_id: number; entity_type: string; created_by: number; created_at: number }[] } }>(
      `/events?limit=100&page=${page}&filter[type]=outgoing_chat_message&filter[created_at][from]=${desdeMsg}`,
    );
    const evs = r?._embedded?.events ?? [];
    for (const e of evs) {
      if (e.entity_type !== "lead" || !e.created_by) continue;
      const atual = primeira.get(e.entity_id);
      if (!atual || e.created_at < atual.t) primeira.set(e.entity_id, { t: e.created_at, u: e.created_by });
    }
    if (evs.length < 100) break;
  }
  let respostas = 0;
  const comResposta = [...primeira.keys()];
  for (let i = 0; i < comResposta.length; i += 500) {
    const ls = await prisma.lead.findMany({ where: { id: { in: comResposta.slice(i, i + 500) } }, select: { id: true, primeiraResposta: true } });
    for (const l of ls) {
      const p = primeira.get(l.id)!;
      if (l.primeiraResposta && l.primeiraResposta.getTime() <= p.t * 1000) continue;
      await prisma.lead.update({ where: { id: l.id }, data: { primeiraResposta: data(p.t), respondidoPor: p.u } });
      respostas++;
    }
  }

  const fim = Math.floor(Date.now() / 1000);
  await gravarEstado("respostas_ate", String(inicio));
  await gravarEstado("leads_ate", String(inicio));
  await gravarEstado("eventos_ate", String(inicio));
  await gravarEstado("ultima_sync", String(fim));
  if (alterados.length || etapas || respostas) await avisarAtualizacao("sync");
  return { leads: alterados.length, etapas, contatos, respostas, inicio, fim };
}

export async function ultimaSync() {
  const v = await lerEstado("ultima_sync");
  return v ? Number(v) : null;
}

// Evita duas sincronizações ao mesmo tempo no mesmo processo (webhook + botão + agendador).
const g = globalThis as unknown as { __syncEmAndamento?: Promise<ResultadoSync> | null };
export function sincronizarUmaVez(opcoes: { completo?: boolean } = {}) {
  if (!g.__syncEmAndamento) g.__syncEmAndamento = sincronizar(opcoes).finally(() => (g.__syncEmAndamento = null));
  return g.__syncEmAndamento;
}
