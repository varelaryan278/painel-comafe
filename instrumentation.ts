// Roda uma vez quando o servidor sobe: agenda as sincronizações periódicas
// (garantia caso algum webhook se perca).
//   SYNC_INTERVALO_MIN  — Kommo (padrão 10 min; 0 desliga)
//   META_INTERVALO_MIN  — catálogo e investimento do Meta (padrão 60 min; 0 desliga)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;

  // Primeiro acesso (útil no Docker, que não tem o script criar-admin): com o banco sem usuários
  // e ADMIN_EMAIL + ADMIN_SENHA definidos, cria o admin. Depois apague ADMIN_SENHA do ambiente.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_SENHA) {
    try {
      const { prisma } = await import("./lib/db");
      if ((await prisma.user.count()) === 0) {
        const { criarUsuario } = await import("./lib/auth");
        await criarUsuario({ nome: process.env.ADMIN_NOME || "Administrador", email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_SENHA, papel: "admin", anunciante: null });
        console.log("[painel] admin inicial criado. Apague ADMIN_SENHA do ambiente.");
      }
    } catch (e) {
      console.error("[painel] não foi possível criar o admin inicial:", (e as Error).message);
    }
  }

  const kommoMin = Number(process.env.SYNC_INTERVALO_MIN ?? 10);
  if (kommoMin && process.env.KOMMO_TOKEN) {
    const { sincronizarUmaVez } = await import("./lib/sync");
    const kommo = () => sincronizarUmaVez().catch((e) => console.error("[sync agendada] falhou:", (e as Error).message));
    setTimeout(kommo, 15_000);
    setInterval(kommo, kommoMin * 60_000);
  }

  const metaMin = Number(process.env.META_INTERVALO_MIN ?? 60);
  const { metaConfigurado, sincronizarMetaUmaVez } = await import("./lib/meta");
  if (metaMin && metaConfigurado()) {
    const meta = () => sincronizarMetaUmaVez().catch((e) => console.error("[meta agendada] falhou:", (e as Error).message));
    setTimeout(meta, 30_000);
    setInterval(meta, metaMin * 60_000);
  }
}
