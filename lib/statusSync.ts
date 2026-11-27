import { prisma } from "./db";
import { avisarStatus } from "./eventos";

// Estado das sincronizações (Kommo e Meta) para o indicador "ao vivo" dos painéis.

export type FonteSync = "kommo" | "meta";
export type EstadoFonte = { ultima: number | null; rodando: boolean; erro: string | null; intervaloMin: number };
export type StatusSync = { kommo: EstadoFonte; meta: EstadoFonte | null };

const TRAVADA_MS = 30 * 60_000; // marca de "rodando" mais velha que isso = processo caiu no meio

async function ler(keys: string[]) {
  const rows = await prisma.syncState.findMany({ where: { key: { in: keys } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function statusSync(): Promise<StatusSync> {
  const v = await ler(["ultima_sync", "meta_ultima_sync", "kommo_rodando", "meta_rodando", "kommo_ultimo_erro", "meta_ultimo_erro"]);
  const rodando = (k: string) => { const t = Number(v.get(k)); return Number.isFinite(t) && Date.now() - t < TRAVADA_MS; };
  const erro = (k: string) => { try { const e = v.get(k); return e ? (JSON.parse(e).msg as string) : null; } catch { return null; } };
  const num = (k: string) => (v.get(k) ? Number(v.get(k)) : null);
  const kommo: EstadoFonte = { ultima: num("ultima_sync"), rodando: rodando("kommo_rodando"), erro: erro("kommo_ultimo_erro"), intervaloMin: Number(process.env.SYNC_INTERVALO_MIN ?? 10) };
  const temMeta = v.has("meta_ultima_sync") || v.has("meta_rodando");
  const meta: EstadoFonte | null = temMeta
    ? { ultima: num("meta_ultima_sync"), rodando: rodando("meta_rodando"), erro: erro("meta_ultimo_erro"), intervaloMin: Number(process.env.META_INTERVALO_MIN ?? 60) }
    : null;
  return { kommo, meta };
}

async function publicar() {
  try { await avisarStatus(await statusSync()); } catch (e) { console.error("[status] falhou:", (e as Error).message); }
}

/** Envolve uma sincronização: marca "rodando", grava erro/sucesso e avisa os painéis abertos. */
export async function comStatus<T>(fonte: FonteSync, fn: () => Promise<T>): Promise<T> {
  const k = `${fonte}_rodando`;
  await prisma.syncState.upsert({ where: { key: k }, create: { key: k, value: String(Date.now()) }, update: { value: String(Date.now()) } }).catch(() => {});
  await publicar();
  try {
    const r = await fn();
    await prisma.syncState.deleteMany({ where: { key: `${fonte}_ultimo_erro` } }).catch(() => {});
    return r;
  } catch (e) {
    const v = JSON.stringify({ msg: (e as Error).message, em: new Date().toISOString() });
    await prisma.syncState.upsert({ where: { key: `${fonte}_ultimo_erro` }, create: { key: `${fonte}_ultimo_erro`, value: v }, update: { value: v } }).catch(() => {});
    throw e;
  } finally {
    await prisma.syncState.deleteMany({ where: { key: k } }).catch(() => {});
    await publicar();
  }
}
