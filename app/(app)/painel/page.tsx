import Dashboard from "@/components/Dashboard";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import { carregarDonosMeta, carregarLeads, carregarRegistros, carregarVendedores, resolverPeriodo } from "@/lib/dados";
import { exigirUsuario } from "@/lib/sessao";
import { ultimaSync } from "@/lib/sync";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: PageProps<"/painel">) {
  await exigirUsuario();
  const sp = await searchParams;
  const { atual, anterior } = resolverPeriodo({ periodo: one(sp.periodo), de: one(sp.de), ate: one(sp.ate) });
  const [regs, donos] = await Promise.all([carregarRegistros(), carregarDonosMeta()]);
  const [{ leads, campanhas }, ant, vendedores, sync] = await Promise.all([
    carregarLeads(atual.de, atual.ate, regs, donos),
    carregarLeads(anterior.de, anterior.ate, regs, donos),
    carregarVendedores(false),
    ultimaSync(),
  ]);
  return (
    <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h1 className="h2" style={{ fontSize: 24 }}>Painel de vendas e tráfego</h1>
          <p className="muted" style={{ marginTop: 6 }}>Dados do Kommo · funil de vendas principal</p>
        </div>
        <FiltroPeriodo chave={atual.chave} de={atual.deStr} ate={atual.ateStr} />
      </div>
      <Dashboard leads={leads} anteriores={ant.leads} campanhas={campanhas} vendedores={vendedores}
        periodo={{ de: atual.de, ate: atual.ate, rotulo: atual.rotulo }} ultimaSync={sync} />
    </main>
  );
}
