import AppHeader from "@/components/AppHeader";
import { exigirUsuario } from "@/lib/sessao";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  return (
    <>
      <AppHeader nome={u.nome} papel={u.papel} anunciante={u.anunciante} />
      {children}
    </>
  );
}
