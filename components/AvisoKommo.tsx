import { statusKommo } from "@/lib/sync";

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

// Aviso para o admin: token do Kommo perto de expirar, expirado ou sincronização falhando.
export default async function AvisoKommo() {
  const s = await statusKommo().catch(() => null);
  if (!s) return null;
  const comoTrocar = "Gere outro em Kommo > Configurações > Integrações (escolha a validade mais longa), atualize KOMMO_TOKEN no Easypanel e reinicie o serviço.";

  let tipo: "erro" | "aviso" | null = null;
  let texto = "";
  if (s.dias !== null && s.dias < 0) {
    tipo = "erro";
    texto = `O token do Kommo expirou em ${fmt(s.expiraEm!)}. O painel parou de atualizar. ${comoTrocar}`;
  } else if (s.erro) {
    tipo = "erro";
    texto = `A última sincronização com o Kommo falhou (${fmt(new Date(s.erro.em))}): ${s.erro.msg}`;
  } else if (s.dias !== null && s.dias <= 30) {
    tipo = "aviso";
    texto = `O token do Kommo expira em ${s.dias} dia${s.dias === 1 ? "" : "s"} (${fmt(s.expiraEm!)}). ${comoTrocar}`;
  }
  if (!tipo) return null;

  return (
    <div className="container" style={{ padding: "12px 24px 0" }}>
      <div className={tipo} role="alert">
        {texto}
        {s.ultimaOk && <span style={{ fontWeight: 400 }}> Última sincronização bem-sucedida: {fmt(s.ultimaOk)}.</span>}
      </div>
    </div>
  );
}
