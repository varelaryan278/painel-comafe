import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cifrar } from "@/lib/cripto";
import { prisma } from "@/lib/db";
import { concluirLogin } from "@/lib/meta";

// Volta do login do Facebook: troca o código por um acesso de ~60 dias e guarda criptografado.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ir = (q: string) => NextResponse.redirect(new URL(`/meta/contas?${q}`, req.url));
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.redirect(new URL("/login", req.url));

  const jar = await cookies();
  const esperado = jar.get("meta_oauth_state")?.value;
  jar.delete("meta_oauth_state");
  if (url.searchParams.get("error")) return ir("erro=cancelado");
  const code = url.searchParams.get("code");
  if (!code || !esperado || url.searchParams.get("state") !== esperado) return ir("erro=state");

  try {
    const r = await concluirLogin(code);
    const cx = await prisma.metaConexao.upsert({
      where: { userId_fbUserId: { userId: s.user.id, fbUserId: r.fbUserId } },
      create: { userId: s.user.id, fbUserId: r.fbUserId, fbNome: r.fbNome, tokenCifrado: cifrar(r.token), expiraEm: r.expiraEm, contasDisponiveis: r.contas },
      update: { fbNome: r.fbNome, tokenCifrado: cifrar(r.token), expiraEm: r.expiraEm, contasDisponiveis: r.contas, invalida: false },
    });
    await prisma.auditLog.create({ data: { userId: s.user.id, acao: "meta_conectar", detalhe: `${r.fbNome}: ${r.contas.length} contas liberadas` } });
    return ir(`c=${cx.id}`);
  } catch (e) {
    console.error("[meta callback]", (e as Error).message);
    return ir("erro=troca");
  }
}
