import AppHeader from "@/components/AppHeader";
import AvisoKommo from "@/components/AvisoKommo";
import { exigirUsuario } from "@/lib/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  return (
    <>
      <AppHeader nome={u.nome} papel={u.papel} anunciante={u.anunciante} />
      {u.papel === "admin" && <AvisoKommo />}
      {children}
    </>
  );
}
