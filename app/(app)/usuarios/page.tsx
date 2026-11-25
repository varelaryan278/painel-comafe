import Usuarios from "@/components/Usuarios";
import { linkPublicoAtivo } from "@/lib/dados";
import { prisma } from "@/lib/db";
import { exigirAdmin } from "@/lib/sessao";
import { ultimaSync } from "@/lib/sync";
import { urlPublica } from "@/lib/url";

export default async function Page() {
  const eu = await exigirAdmin();
  const [users, link, sync] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    linkPublicoAtivo(),
    ultimaSync(),
  ]);
  const origem = await urlPublica();
  return (
    <Usuarios
      origem={origem}
      usuarios={users.map((u) => ({ id: u.id, nome: u.name, email: u.email, papel: u.role ?? "gestor", anunciante: u.anunciante, eu: u.id === eu.id }))}
      link={link}
      ultimaSync={sync ? new Date(sync * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null}
      webhookPath={`/api/kommo/webhook?secret=${process.env.SYNC_SECRET ?? ""}`}
    />
  );
}
