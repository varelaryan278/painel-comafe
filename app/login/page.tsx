import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { usuarioAtual } from "@/lib/sessao";

export default async function Page() {
  if (await usuarioAtual()) redirect("/painel");
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "72px 16px" }}>
      <LoginForm />
    </div>
  );
}
