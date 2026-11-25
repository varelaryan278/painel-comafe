import { notFound } from "next/navigation";
import AoVivo from "@/components/AoVivo";
import Dashboard from "@/components/Dashboard";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import { carregarDonosMeta, carregarGastos, carregarLeads, carregarRegistros, carregarVendedores, resolverPeriodo } from "@/lib/dados";
import { prisma } from "@/lib/db";
import { ultimaSync } from "@/lib/sync";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ params, searchParams }: PageProps<"/relatorio/[token]">) {
  const { token } = await params;
  const link = await prisma.publicLink.findFirst({ where: { token, active: true } });
  if (!link) notFound();
  const sp = await searchParams;
  const { atual, anterior } = resolverPeriodo({ periodo: one(sp.periodo), de: one(sp.de), ate: one(sp.ate) });
  const [regs, donos] = await Promise.all([carregarRegistros(), carregarDonosMeta()]);
  const [{ leads, campanhas }, ant, vendedores, sync, gastos, gastosAnt] = await Promise.all([
    carregarLeads(atual.de, atual.ate, regs, donos),
    carregarLeads(anterior.de, anterior.ate, regs, donos),
    carregarVendedores(true),
    ultimaSync(),
    carregarGastos(atual.de, atual.ate, regs),
    carregarGastos(anterior.de, anterior.ate, regs),
  ]);
  return (
    <>
      <header style={{ background: "#0E2A52", color: "#fff" }}>
        <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 24px", padding: "16px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "6px 10px", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/comafe-logo.png" alt="Comafe Autopeças" style={{ height: 30, width: "auto" }} />
          </div>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 600 }}>Relatório de tráfego pago</div>
            <div style={{ fontSize: 13, color: "#C9D6EA" }}>Somente leitura · sem dados de clientes</div>
          </div>
          <div style={{ marginLeft: "auto" }}><AoVivo token={token} /></div>
        </div>
      </header>
      <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <FiltroPeriodo chave={atual.chave} de={atual.deStr} ate={atual.ateStr} />
        </div>
        <Dashboard publico leads={leads} anteriores={ant.leads} campanhas={campanhas} vendedores={vendedores} gastos={gastos} gastosAnt={gastosAnt}
          periodo={{ de: atual.de, ate: atual.ate, rotulo: atual.rotulo }} ultimaSync={sync} />
      </main>
    </>
  );
}
