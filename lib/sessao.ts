import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { AdvKey } from "./constantes";

export type Usuario = { id: string; nome: string; email: string; papel: "admin" | "gestor"; anunciante: AdvKey | null };

export async function usuarioAtual(): Promise<Usuario | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string; anunciante?: string | null };
  return {
    id: u.id,
    nome: u.name,
    email: u.email,
    papel: u.role === "admin" ? "admin" : "gestor",
    anunciante: (u.anunciante as AdvKey | null) ?? null,
  };
}

export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  return u;
}

export async function exigirAdmin() {
  const u = await exigirUsuario();
  if (u.papel !== "admin") redirect("/painel");
  return u;
}
