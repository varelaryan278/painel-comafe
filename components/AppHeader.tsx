"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/app/actions";
import { ADV, type AdvKey } from "@/lib/constantes";
import AoVivo from "./AoVivo";

export default function AppHeader({ nome, papel, anunciante }: { nome: string; papel: "admin" | "gestor"; anunciante: AdvKey | null }) {
  const path = usePathname();
  const menu = [
    { href: "/painel", label: "Painel" },
    { href: "/anuncios", label: "Anúncios" },
    { href: "/ids", label: "IDs manuais" },
    ...(papel === "admin" ? [{ href: "/usuarios", label: "Usuários e acesso" }] : []),
  ];
  return (
    <header style={{ background: "#fff", borderBottom: "1px solid #E2E7EF" }}>
      <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 24px", padding: "12px 24px" }}>
        <Link href="/painel" aria-label="Início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/comafe-logo.png" alt="Comafe Autopeças" style={{ height: 36, width: "auto", display: "block" }} />
        </Link>
        <nav aria-label="Menu" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {menu.map((m) => (
            <Link key={m.href} href={m.href} className={"menu-item" + (path.startsWith(m.href) ? " on" : "")}>{m.label}</Link>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <AoVivo />
          <Link href="/conta" style={{ textAlign: "right", textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{nome}</div>
            <div style={{ fontSize: 12, color: "#5B6576" }}>{papel === "admin" ? "Admin" : `Gestor de tráfego · ${anunciante ? ADV[anunciante].nome : "—"}`}</div>
          </Link>
          <form action={sair}><button type="submit" className="btn">Sair</button></form>
        </div>
      </div>
    </header>
  );
}
