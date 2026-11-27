import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ouvirAtualizacoes } from "@/lib/eventos";
import { statusSync } from "@/lib/statusSync";

// Server-Sent Events: avisa o navegador quando os dados mudaram, para o painel recarregar sozinho.
// Aceita usuário logado ou o token do painel público (?t=...).
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const ok = t
    ? !!(await prisma.publicLink.findFirst({ where: { token: t, active: true } }))
    : !!(await auth.api.getSession({ headers: await headers() }));
  if (!ok) return new Response("não autorizado", { status: 401 });

  const enc = new TextEncoder();
  let parar = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const enviar = (s: string) => { try { ctrl.enqueue(enc.encode(s)); } catch {} };
      enviar(": conectado\n\n");
      // estado atual das sincronizações logo ao conectar (rodinha e "há X min")
      statusSync().then((st) => enviar(`event: status\ndata: ${JSON.stringify(st)}\n\n`)).catch(() => {});
      const sair = ouvirAtualizacoes((msg) => {
        let m: { tipo?: string; status?: unknown } = {};
        try { m = JSON.parse(msg); } catch {}
        if (m.tipo === "status") enviar(`event: status\ndata: ${JSON.stringify(m.status)}\n\n`);
        else enviar(`event: atualizado\ndata: ${msg}\n\n`);
      });
      const ping = setInterval(() => enviar(": ping\n\n"), 25000);
      parar = () => { clearInterval(ping); sair(); };
      req.signal.addEventListener("abort", () => { parar(); try { ctrl.close(); } catch {} });
    },
    cancel() { parar(); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
