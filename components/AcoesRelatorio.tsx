"use client";

import { useEffect, useState } from "react";

/** Botões do relatório público: modo TV, tela cheia e exportar em PDF (impressão do navegador). */
export function AcoesRelatorio({ hrefTv }: { hrefTv: string }) {
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a className="btn" href={hrefTv} style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M3 5h18v12H3zM8 21h8M12 17v4" /></svg>
        Modo TV
      </a>
      <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2" d="M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3" /></svg>
        Exportar PDF
      </button>
    </div>
  );
}

/** Barra do modo TV: relógio, tela cheia e saída. */
export function BarraTv({ hrefSair }: { hrefSair: string }) {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setAgora(new Date());
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      {agora && (
        <span className="display" style={{ fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
        </span>
      )}
      <button type="button" className="btn tv-discreto" onClick={telaCheia}>Tela cheia</button>
      <a className="btn tv-discreto" href={hrefSair} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Sair do modo TV</a>
    </div>
  );
}
