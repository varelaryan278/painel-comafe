import ContaForm from "@/components/ContaForm";
import { exigirUsuario } from "@/lib/sessao";

export default async function Page() {
  const u = await exigirUsuario();
  return (
    <main className="container" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="h2" style={{ fontSize: 24 }}>Minha conta</h1>
        <p className="muted" style={{ marginTop: 6 }}>{u.nome} · {u.email}</p>
      </div>
      <ContaForm />
    </main>
  );
}
