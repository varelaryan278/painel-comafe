import Anuncios from "@/components/Anuncios";
import ConexoesMeta from "@/components/ConexoesMeta";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import { carregarAnuncios } from "@/lib/anuncios";
import { carregarRegistros, resolverPeriodo } from "@/lib/dados";
import { prisma } from "@/lib/db";
import { appConfigurado, metaConfigurado } from "@/lib/meta";
import { exigirUsuario } from "@/lib/sessao";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: PageProps<"/anuncios">) {
  const u = await exigirUsuario();
  const sp = await searchParams;
  const { atual } = resolverPeriodo({ periodo: one(sp.periodo) ?? "30d", de: one(sp.de), ate: one(sp.ate) });
  const regs = await carregarRegistros();
  const isAdmin = u.papel === "admin";
  const [{ arvore, semVinculo }, ult, conexoes, contas, usuarios] = await Promise.all([
    carregarAnuncios(atual.de, atual.ate, isAdmin ? null : u.anunciante, regs),
    prisma.syncState.findUnique({ where: { key: "meta_ultima_sync" } }),
    prisma.metaConexao.findMany({ where: isAdmin ? {} : { userId: u.id }, orderBy: { createdAt: "asc" } }),
    prisma.metaConta.findMany({ orderBy: { nome: "asc" } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nomeUser = new Map(usuarios.map((x) => [x.id, x.name]));
  const conexoesView = conexoes.map((c) => ({
    id: c.id, fbNome: c.fbNome, conectadoPor: nomeUser.get(c.userId) ?? "—", meu: c.userId === u.id,
    expiraEm: c.expiraEm ? Math.floor(c.expiraEm.getTime() / 1000) : null, invalida: c.invalida,
    contas: contas.filter((ct) => ct.conexaoId === c.id).map((ct) => ({ id: ct.id, nome: ct.nome, anunciante: ct.anunciante, erro: ct.erro })),
  }));
  const contasEnv = contas.filter((ct) => !ct.conexaoId && (isAdmin || ct.anunciante === u.anunciante)).map((ct) => ({ id: ct.id, nome: ct.nome, anunciante: ct.anunciante }));
  return (
    <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h1 className="h2" style={{ fontSize: 24 }}>Anúncios</h1>
          <p className="muted" style={{ marginTop: 6 }}>O que está rodando no Meta, de quem é, se é motor ou peça e quantos leads está trazendo · {atual.rotulo}</p>
        </div>
        <FiltroPeriodo chave={atual.chave} de={atual.deStr} ate={atual.ateStr} />
      </div>
      <ConexoesMeta conexoes={conexoesView} appOk={appConfigurado()} isAdmin={isAdmin} contasEnv={contasEnv} />
      <Anuncios arvore={arvore} semVinculo={semVinculo} isAdmin={isAdmin} metaOk={metaConfigurado()}
        ultimaMeta={ult ? new Date(Number(ult.value) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null} />
    </main>
  );
}
