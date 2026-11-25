// Sincroniza o Kommo pela linha de comando. Uso: npm run sync  (ou: npm run sync -- --completo)
import { prisma } from "../lib/db";
import { sincronizar } from "../lib/sync";

sincronizar({ completo: process.argv.includes("--completo") })
  .then((r) => console.log(`Leads: ${r.leads} · etapas atualizadas: ${r.etapas} · contatos: ${r.contatos} · primeiras respostas: ${r.respostas} · ${r.fim - r.inicio}s`))
  .catch((e) => { console.error(e.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
