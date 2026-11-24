import IdsMeta from "@/components/IdsMeta";
import { advPeloSufixo } from "@/lib/atribuicao";
import { carregarDonosMeta, carregarRegistros, contarLeadsPorMetaId, idsSemDono } from "@/lib/dados";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/sessao";

const dia = (s: number) => new Date(s * 1000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export default async function Page() {
  const u = await exigirUsuario();
  const isAdmin = u.papel === "admin";
  const [regs, donos] = await Promise.all([carregarRegistros(), carregarDonosMeta()]);
  const [todos, fila, contagem, disputas] = await Promise.all([
    prisma.metaRegistro.findMany({ orderBy: [{ anunciante: "asc" }, { createdAt: "desc" }] }),
    idsSemDono(regs, donos),
    contarLeadsPorMetaId(regs),
    isAdmin ? prisma.disputa.findMany({ where: { status: "aberta" }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
  ]);
  return (
    <IdsMeta
      isAdmin={isAdmin}
      meuAnunciante={u.anunciante}
      registros={todos.filter((r) => isAdmin || r.anunciante === u.anunciante).map((r) => ({
        id: r.id, nivel: r.nivel, metaId: r.metaId, nome: r.nome, anunciante: r.anunciante, tipo: r.tipo, situacao: r.situacao,
        leads: contagem.get(r.metaId) ?? 0,
      }))}
      fila={fila.slice(0, 200).map((f) => ({
        metaId: f.metaId, nivel: f.nivel, leads: f.leads, desde: dia(f.desde), sugestao: f.adExemplo ? advPeloSufixo(f.adExemplo) : null,
      }))}
      disputas={disputas.map((d) => {
        const r = regs.get(d.metaId);
        return { id: d.id, metaId: d.metaId, pedidoPor: d.anunciante, donoAtual: r?.anunciante ?? null, nome: r?.nome ?? null };
      })}
    />
  );
}
