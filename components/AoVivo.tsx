"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Escuta /api/eventos e recarrega os dados da página quando o Kommo muda. */
export default function AoVivo({ token }: { token?: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"on" | "off">("off");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/eventos" + (token ? `?t=${encodeURIComponent(token)}` : ""));
    es.onopen = () => setEstado("on");
    es.onerror = () => setEstado("off");
    es.addEventListener("atualizado", () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 800);
    });
    return () => { es.close(); if (timer.current) clearTimeout(timer.current); };
  }, [router, token]);

  return (
    <span className="aovivo" title={estado === "on" ? "Atualiza sozinho quando o Kommo muda" : "Sem conexão em tempo real; recarregue a página"}>
      <span className="dot" style={{ background: estado === "on" ? "#1A9E5A" : "#9AA6B8", marginRight: 6 }} />
      {estado === "on" ? "Ao vivo" : "Offline"}
    </span>
  );
}
