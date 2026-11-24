import { after, NextResponse } from "next/server";
import { sincronizarUmaVez } from "@/lib/sync";

// Webhook do Kommo: configure em Configurações > Integrações > Webhooks com a URL
//   https://SEU-DOMINIO/api/kommo/webhook?secret=SYNC_SECRET
// nos eventos de lead (adicionado, alterado, mudou de etapa). Responde na hora e sincroniza em seguida.
export async function POST(req: Request) {
  const segredo = process.env.SYNC_SECRET;
  if (!segredo || new URL(req.url).searchParams.get("secret") !== segredo) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  after(async () => {
    try {
      await sincronizarUmaVez();
    } catch (e) {
      console.error("[webhook] sincronização falhou:", (e as Error).message);
    }
  });
  return NextResponse.json({ ok: true });
}
