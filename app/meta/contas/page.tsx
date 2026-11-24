import { redirect } from "next/navigation";
import EscolherContas from "@/components/EscolherContas";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/sessao";

const ERROS: Record<string, string> = {
  app: "O app do Facebook ainda não foi configurado no painel (META_APP_ID e META_APP_SECRET no .env).",
  cancelado: "A conexão foi cancelada na janela do Facebook.",
  state: "A conexão expirou ou veio de outra janela. Tente de novo.",
  troca: "O Facebook não confirmou o acesso. Tente de novo; se continuar, verifique se você é testador do app.",
};

// Janela do popup: depois do login do Facebook, escolhe quais contas ligar e a quem pertencem.
export default async function Page({ searchParams }: PageProps<"/meta/contas">) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  const sp = await searchParams;
  const erro = typeof sp.erro === "string" ? ERROS[sp.erro] ?? "Não foi possível conectar." : null;
  const id = Number(sp.c);
  const cx = id ? await prisma.metaConexao.findUnique({ where: { id } }) : null;
  const permitido = cx && (cx.userId === u.id || u.papel === "admin");
  const ids = permitido ? (cx.contasDisponiveis as { id: string }[]).map((c) => c.id) : [];
  const existentes = ids.length ? await prisma.metaConta.findMany({ where: { id: { in: ids } }, select: { id: true, anunciante: true, conexaoId: true } }) : [];
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <EscolherContas
        erro={erro ?? (sp.c && !permitido ? "Conexão não encontrada." : null)}
        conexao={permitido ? { id: cx.id, fbNome: cx.fbNome, contas: cx.contasDisponiveis as { id: string; name: string; ativa: boolean }[] } : null}
        existentes={Object.fromEntries(existentes.map((e) => [e.id, { anunciante: e.anunciante, conexaoId: e.conexaoId }]))}
        isAdmin={u.papel === "admin"}
        meuAnunciante={u.anunciante}
      />
    </main>
  );
}
