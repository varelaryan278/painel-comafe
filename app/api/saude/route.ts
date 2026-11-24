import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Verificação de saúde para o Docker/Easypanel: responde 200 se o app e o banco estão de pé.
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, erro: "banco indisponível" }, { status: 503 });
  }
}
