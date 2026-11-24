"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function FiltroPeriodo({ chave, de, ate }: { chave: string; de: string; ate: string }) {
  const router = useRouter();
  const path = usePathname();
  const [p, setP] = useState(chave);
  const [d1, setD1] = useState(de);
  const [d2, setD2] = useState(ate);
  const ir = (periodo: string, a = d1, b = d2) => {
    const q = new URLSearchParams({ periodo });
    if (periodo === "custom") { q.set("de", a); q.set("ate", b); }
    router.push(`${path}?${q}`);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
      <label className="field">
        Período
        <select className="input" style={{ minWidth: 170 }} value={p} onChange={(e) => { setP(e.target.value); if (e.target.value !== "custom") ir(e.target.value); }}>
          <option value="mes">Este mês</option>
          <option value="mes-anterior">Mês anterior</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="custom">Personalizado…</option>
        </select>
      </label>
      {p === "custom" && (
        <>
          <label className="field">De<input className="input" type="date" value={d1} onChange={(e) => setD1(e.target.value)} /></label>
          <label className="field">Até<input className="input" type="date" value={d2} onChange={(e) => setD2(e.target.value)} /></label>
          <button type="button" className="btn btn-primary" onClick={() => ir("custom")}>Aplicar</button>
        </>
      )}
    </div>
  );
}
