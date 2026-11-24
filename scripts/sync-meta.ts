// Lê o catálogo e o investimento do Meta. Uso: npm run sync:meta
import { prisma } from "../lib/db";
import { sincronizarMeta } from "../lib/meta";

sincronizarMeta()
  .then((r) => {
    console.log(`Contas: ${r.contas} · campanhas: ${r.campanhas} · conjuntos: ${r.conjuntos} · anúncios: ${r.anuncios} · dias de investimento: ${r.gastos}`);
    r.erros.forEach((e) => console.error("Erro:", e));
  })
  .catch((e) => { console.error(e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
