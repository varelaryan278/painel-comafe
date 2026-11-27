import { EventEmitter } from "node:events";
import Redis from "ioredis";

// Aviso "os dados mudaram" para os painéis abertos (tempo real).
// Com REDIS_URL: funciona entre vários processos/servidores (pub/sub).
// Sem REDIS_URL: funciona dentro de um único processo (bom para desenvolvimento).

const CANAL = "comafe:painel:atualizado";
const g = globalThis as unknown as { __bus?: EventEmitter; __redisPub?: Redis; __redisSub?: Redis };

const bus = g.__bus ?? (g.__bus = new EventEmitter().setMaxListeners(0));
const url = process.env.REDIS_URL;

function pub() {
  if (!url) return null;
  if (!g.__redisPub) {
    g.__redisPub = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    // conexão longa (ex.: sync de vários minutos) pode cair; o ioredis reconecta sozinho, só registramos
    g.__redisPub.on("error", (e) => console.error("[eventos] Redis:", e.message));
  }
  return g.__redisPub;
}

/** Fecha as conexões com o Redis (para scripts de linha de comando terminarem sozinhos). */
export async function fecharEventos() {
  await Promise.all([g.__redisPub, g.__redisSub].map((r) => r?.quit().catch(() => r.disconnect())));
  g.__redisPub = g.__redisSub = undefined;
}

function iniciarAssinatura() {
  if (!url || g.__redisSub) return;
  const sub = (g.__redisSub = new Redis(url, { maxRetriesPerRequest: null }));
  sub.subscribe(CANAL).catch((e) => console.error("[eventos] falha ao assinar Redis:", e.message));
  sub.on("message", (_c, msg) => bus.emit("atualizado", msg));
  sub.on("error", (e) => console.error("[eventos] Redis:", e.message));
}

export async function avisarAtualizacao(motivo: string) {
  const msg = JSON.stringify({ motivo, em: Date.now() });
  const r = pub();
  if (r) {
    try {
      await r.publish(CANAL, msg);
      return;
    } catch (e) {
      console.error("[eventos] publish falhou, usando aviso local:", (e as Error).message);
    }
  }
  bus.emit("atualizado", msg);
}

/** Estado das sincronizações (rodando / última / erro) para o indicador dos painéis. */
export async function avisarStatus(status: unknown) {
  const msg = JSON.stringify({ tipo: "status", status });
  const r = pub();
  if (r) {
    try { await r.publish(CANAL, msg); return; } catch (e) { console.error("[eventos] publish falhou, usando aviso local:", (e as Error).message); }
  }
  bus.emit("atualizado", msg);
}

export function ouvirAtualizacoes(fn: (msg: string) => void) {
  iniciarAssinatura();
  bus.on("atualizado", fn);
  return () => bus.off("atualizado", fn);
}
