"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { EstadoFonte, StatusSync } from "@/lib/statusSync";

/** "agora", "há 4 min", "há 2 h 10 min", "há 3 dias". */
function ha(s: number) {
  const m = Math.floor(s / 60);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

function Fonte({ nome, e, agora }: { nome: string; e: EstadoFonte; agora: number }) {
  const idade = e.ultima ? agora - e.ultima : null;
  // atrasada = passou 3 ciclos sem atualizar (ou a última tentativa falhou)
  const atrasada = !!e.erro || idade == null || (e.intervaloMin > 0 && idade > e.intervaloMin * 60 * 3);
  const quando = e.ultima ? new Date(e.ultima * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nunca";
  const titulo = e.rodando ? `${nome}: atualizando agora…` : `${nome}: última atualização ${quando}` + (e.erro ? ` · última tentativa falhou: ${e.erro}` : "") + (e.intervaloMin > 0 ? ` · atualiza a cada ${e.intervaloMin} min` : "");
  return (
    <span className="sync-fonte" title={titulo}>
      {e.rodando ? <span className="rodinha" aria-hidden="true" /> : <span className="dot" style={{ background: atrasada ? "#E0A100" : "#1A9E5A", margin: 0 }} />}
      <span>{nome}</span>
      <span className="sync-quando" style={atrasada && !e.rodando ? { color: "#C27C00" } : undefined}>
        {e.rodando ? "atualizando…" : idade == null ? "nunca" : ha(idade)}
      </span>
    </span>
  );
}

/** Escuta /api/eventos: recarrega os dados quando mudam e mostra o estado das sincronizações (Kommo e Meta). */
export default function AoVivo({ token }: { token?: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"on" | "off">("off");
  const [status, setStatus] = useState<StatusSync | null>(null);
  const [agora, setAgora] = useState(() => Math.floor(Date.now() / 1000));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/eventos" + (token ? `?t=${encodeURIComponent(token)}` : ""));
    es.onopen = () => setEstado("on");
    es.onerror = () => setEstado("off");
    es.addEventListener("atualizado", () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 800);
    });
    es.addEventListener("status", (ev) => {
      try { setStatus(JSON.parse((ev as MessageEvent).data)); } catch {}
    });
    return () => { es.close(); if (timer.current) clearTimeout(timer.current); };
  }, [router, token]);

  // relógio para o "há X min" andar sozinho
  useEffect(() => {
    const id = setInterval(() => setAgora(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="aovivo" style={{ gap: 14, flexWrap: "wrap" }}>
      <span title={estado === "on" ? "Atualiza sozinho quando os dados mudam" : "Sem conexão em tempo real; recarregue a página"} style={{ display: "inline-flex", alignItems: "center" }}>
        <span className="dot" style={{ background: estado === "on" ? "#1A9E5A" : "#9AA6B8", marginRight: 6 }} />
        {estado === "on" ? "Ao vivo" : "Offline"}
      </span>
      {status && <Fonte nome="Kommo" e={status.kommo} agora={agora} />}
      {status?.meta && <Fonte nome="Meta" e={status.meta} agora={agora} />}
    </span>
  );
}
