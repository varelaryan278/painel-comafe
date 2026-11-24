// Cria o primeiro usuário admin. Uso: npm run criar-admin
// Lê ADMIN_NOME, ADMIN_EMAIL e ADMIN_SENHA do .env (apague a senha do .env depois).
import { criarUsuario } from "../lib/auth";
import { prisma } from "../lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL, senha = process.env.ADMIN_SENHA;
  if (!email || !senha) throw new Error("Preencha ADMIN_EMAIL e ADMIN_SENHA no .env");
  const u = await criarUsuario({ nome: process.env.ADMIN_NOME || "Administrador", email, senha, papel: "admin", anunciante: null });
  console.log(`Admin criado: ${u.email}. Agora apague ADMIN_SENHA do .env.`);
}
main().catch((e) => { console.error(e.message ?? e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
