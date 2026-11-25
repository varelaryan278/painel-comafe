import { headers } from "next/headers";

/**
 * Endereço público do painel (ex.: https://painel.comafe.com.br), usado em links e redirecionamentos.
 * Ordem: APP_URL → BETTER_AUTH_URL → cabeçalhos do proxy (Easypanel/Traefik mandam x-forwarded-host).
 * Dentro do Docker o endereço da requisição é interno (0.0.0.0/localhost), por isso nunca usamos req.url.
 */
export function urlConfigurada() {
  const v = process.env.APP_URL || process.env.BETTER_AUTH_URL;
  return v ? v.replace(/\/+$/, "") : null;
}

export async function urlPublica() {
  const fixa = urlConfigurada();
  if (fixa) return fixa;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** URL absoluta de um caminho do painel (para NextResponse.redirect). */
export async function urlDe(caminho: string) {
  return new URL(caminho, (await urlPublica()) + "/");
}
