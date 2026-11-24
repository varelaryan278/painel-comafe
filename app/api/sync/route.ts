import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sincronizarUmaVez } from "@/lib/sync";

// POST /api/sync — admin logado, ou agendador com o cabeçalho x-sync-secret.
export async function POST(req: Request) {
  const segredo = process.env.SYNC_SECRET;
  const porSegredo = !!segredo && req.headers.get("x-sync-secret") === segredo;
  if (!porSegredo) {
    const s = await auth.api.getSession({ headers: await headers() });
    if ((s?.user as { role?: string } | undefined)?.role !== "admin") return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  try {
    const completo = new URL(req.url).searchParams.get("completo") === "1";
    return NextResponse.json(await sincronizarUmaVez({ completo }));
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 502 });
  }
}
