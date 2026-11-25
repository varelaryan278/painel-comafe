import { notFound } from "next/navigation";
import { AcoesRelatorio, BarraTv } from "@/components/AcoesRelatorio";
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
  const tv = one(sp.tv) === "1";
  const { atual, anterior } = resolverPeriodo({ periodo: one(sp.periodo), de: one(sp.de), ate: one(sp.ate) });
  const [regs, donos] = await Promise.all([carregarRegistros(), carregarDonosMeta()]);
  const [{ leads, campanhas }, ant, vendedores, sync, gastos, gastosAnt] = await Promise.all([
    carregarLeads(atual.de, atual.ate, regs, donos),
    carregarLeads(anterior.de, anterior.ate, regs, donos),
    carregarVendedores(false), // nomes completos dos vendedores (equipe da Comafe); dados de clientes continuam fora
    ultimaSync(),
    carregarGastos(atual.de, atual.ate, regs),
    carregarGastos(anterior.de, anterior.ate, regs),
  ]);

  // Links que mantêm o período escolhido
  const q = new URLSearchParams();
  for (const k of ["periodo", "de", "ate"]) { const v = one(sp[k]); if (v) q.set(k, v); }
  const comTv = new URLSearchParams(q); comTv.set("tv", "1");
  const base = `/relatorio/${token}`;
  const hrefTv = `${base}?${comTv}`;
  const hrefSair = q.size ? `${base}?${q}` : base;
  const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  return (
    <div className={tv ? "modo-tv" : undefined}>
      <header className="cabecalho-relatorio" style={{ background: "#0E2A52", color: "#fff" }}>
        <div className={tv ? undefined : "container"} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 24px", padding: tv ? "18px 32px" : "16px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: "6px 10px", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/comafe-logo.png" alt="Comafe Autopeças" style={{ height: tv ? 44 : 30, width: "auto" }} />
          </div>
          <div>
            <div className="display" style={{ fontSize: tv ? 28 : 20, fontWeight: 600 }}>Relatório de tráfego pago</div>
            <div style={{ fontSize: tv ? 16 : 13, color: "#C9D6EA", textTransform: tv ? "capitalize" : undefined }}>
              {tv ? atual.rotulo : <><span className="no-print">Somente leitura · sem dados de clientes</span><span className="so-print">{atual.rotulo} · gerado em {geradoEm}</span></>}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <span className="no-print"><AoVivo token={token} /></span>
            {tv && <BarraTv hrefSair={hrefSair} />}
          </div>
        </div>
      </header>
      <main className={tv ? undefined : "container"} style={{ padding: tv ? "24px 32px" : 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {!tv && (
          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "flex-end", gap: 12 }}>
            <AcoesRelatorio hrefTv={hrefTv} />
            <FiltroPeriodo chave={atual.chave} de={atual.deStr} ate={atual.ateStr} />
          </div>
        )}
        <Dashboard publico tv={tv} leads={leads} anteriores={ant.leads} campanhas={campanhas} vendedores={vendedores} gastos={gastos} gastosAnt={gastosAnt}
          periodo={{ de: atual.de, ate: atual.ate, rotulo: atual.rotulo }} ultimaSync={sync} />
        <footer className="so-print" style={{ fontSize: 11, color: "#5B6576", borderTop: "2px solid #0E2A52", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span><strong style={{ color: "#0E2A52" }}>Comafe Autopeças</strong> · Relatório de tráfego pago · {atual.rotulo}</span>
          <span>Dados do Kommo e do Meta · sem dados pessoais de clientes · gerado em {geradoEm}</span>
        </footer>
      </main>
    </div>
  );
}
