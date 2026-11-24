import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { leadsRecentes } from "@/lib/anuncios";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORMATOS_PREVIA, previaAnuncio, type FormatoPrevia } from "@/lib/meta";

// GET /api/anuncios/:id?formato=MOBILE_FEED_STANDARD — prévia do Meta + últimos leads do Kommo.
export async function GET(req: Request, ctx: RouteContext<"/api/anuncios/[id]">) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const user = s.user as typeof s.user & { role?: string; anunciante?: string | null };
  const { id } = await ctx.params;

  const ad = await prisma.metaAnuncio.findUnique({ where: { id } });
  const conta = ad ? await prisma.metaConta.findUnique({ where: { id: ad.contaId } }) : null;
  if (user.role !== "admin" && conta && conta.anunciante !== user.anunciante) {
    return NextResponse.json({ erro: "Este anúncio é de outro anunciante." }, { status: 403 });
  }

  const f = new URL(req.url).searchParams.get("formato") ?? "MOBILE_FEED_STANDARD";
  const formato = (f in FORMATOS_PREVIA ? f : "MOBILE_FEED_STANDARD") as FormatoPrevia;
  let previa: string | null = null, erroPrevia: string | null = null;
  if (ad) {
    try { previa = await previaAnuncio(id, formato); } catch (e) { erroPrevia = (e as Error).message; }
  } else erroPrevia = "Este anúncio não está em nenhuma conta do Meta conectada.";

  return NextResponse.json({ previa, erroPrevia, leads: await leadsRecentes(id) });
}
