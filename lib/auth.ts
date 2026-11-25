import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";

const URL_PUBLICA = (process.env.APP_URL || process.env.BETTER_AUTH_URL || "").replace(/\/+$/, "") || undefined;

export const auth = betterAuth({
  baseURL: URL_PUBLICA,
  trustedOrigins: URL_PUBLICA ? [URL_PUBLICA] : [],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Sem cadastro aberto: usuários são criados pelo admin no painel.
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 7 },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "gestor", input: false },
      anunciante: { type: "string", required: false, input: false },
    },
  },
  plugins: [nextCookies()],
});

export type Papel = "admin" | "gestor";

/** Cria usuário com senha (usado pelo admin e pelo script de primeiro acesso). */
export async function criarUsuario(dados: { nome: string; email: string; senha: string; papel: Papel; anunciante: string | null }) {
  const ctx = await auth.$context;
  const email = dados.email.trim().toLowerCase();
  if (await ctx.internalAdapter.findUserByEmail(email)) throw new Error("Já existe um usuário com esse e-mail.");
  if (dados.senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
  const hash = await ctx.password.hash(dados.senha);
  const u = await ctx.internalAdapter.createUser({
    email,
    name: dados.nome.trim(),
    emailVerified: true,
    role: dados.papel,
    anunciante: dados.papel === "gestor" ? dados.anunciante : null,
  }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: hash });
  return u;
}
