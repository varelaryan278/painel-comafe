"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { situacaoValida, tipoValido } from "@/lib/atribuicao";
import { auth, criarUsuario } from "@/lib/auth";
import { ADV, ADV_KEYS, type AdvKey } from "@/lib/constantes";
import { prisma } from "@/lib/db";
import { avisarAtualizacao } from "@/lib/eventos";
import { exigirAdmin, exigirUsuario, type Usuario } from "@/lib/sessao";
import { sincronizarMeta, sincronizarMetaUmaVez } from "@/lib/meta";
import { sincronizarUmaVez } from "@/lib/sync";

export type Resultado = { ok: boolean; msg: string } | null;

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const advValido = (a: string): a is AdvKey => (ADV_KEYS as string[]).includes(a);

async function registrar(u: Usuario, acao: string, detalhe: string) {
  await prisma.auditLog.create({ data: { userId: u.id, acao, detalhe } });
}
async function aposMudarCadastro(motivo: string) {
  revalidatePath("/", "layout");
  await avisarAtualizacao(motivo);
}

// ---------------------------------------------------------------- login
export async function entrar(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    await auth.api.signInEmail({ body: { email: txt(f, "email").toLowerCase(), password: String(f.get("senha") ?? "") } });
  } catch {
    return { ok: false, msg: "E-mail ou senha incorretos." };
  }
  redirect("/painel");
}

export async function sair() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function trocarSenha(_: Resultado, f: FormData): Promise<Resultado> {
  await exigirUsuario();
  const nova = String(f.get("nova") ?? "");
  if (nova.length < 8) return { ok: false, msg: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (nova !== String(f.get("confirma") ?? "")) return { ok: false, msg: "A confirmação não bate com a nova senha." };
  try {
    await auth.api.changePassword({
      body: { currentPassword: String(f.get("atual") ?? ""), newPassword: nova, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch {
    return { ok: false, msg: "Senha atual incorreta." };
  }
  return { ok: true, msg: "Senha alterada." };
}

// ---------------------------------------------------------------- IDs do Meta
export async function cadastrarId(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await exigirUsuario();
  const metaId = txt(f, "metaId").replace(/\D/g, "");
  const nivel = txt(f, "nivel");
  const nome = txt(f, "nome");
  const tipo = txt(f, "tipo");
  const situacao = txt(f, "situacao") || "ativa";
  const anunciante = u.papel === "admin" ? txt(f, "anunciante") : u.anunciante ?? "";
  if (metaId.length < 10) return { ok: false, msg: "Informe o ID do Meta (só números, como aparece no Gerenciador de Anúncios)." };
  if (!["campanha", "conjunto", "anuncio"].includes(nivel)) return { ok: false, msg: "Escolha o nível." };
  if (!tipoValido(tipo) || !situacaoValida(situacao)) return { ok: false, msg: "Escolha o tipo e a situação." };
  if (!advValido(anunciante)) return { ok: false, msg: "Escolha o anunciante." };

  const existente = await prisma.metaRegistro.findUnique({ where: { metaId } });
  if (existente) {
    if (existente.anunciante === anunciante) return { ok: false, msg: "Esse ID já está cadastrado para você." };
    if (u.papel === "admin") return { ok: false, msg: `Esse ID já é de ${ADV[existente.anunciante as AdvKey]?.nome}. Edite na tabela para trocar.` };
    await prisma.disputa.create({ data: { metaId, anunciante, userId: u.id } });
    await registrar(u, "disputa", `${metaId} pedido por ${anunciante}`);
    return { ok: false, msg: "Esse ID já está cadastrado por outro anunciante. Abrimos uma disputa para o admin decidir." };
  }
  await prisma.metaRegistro.create({ data: { metaId, nivel, nome: nome || "(sem nome)", anunciante, tipo, situacao, createdBy: u.id } });
  await registrar(u, "cadastrar_id", `${metaId} → ${anunciante} (${tipo})`);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: `ID cadastrado para ${ADV[anunciante].nome}. Os leads desse ID já foram recalculados.` };
}

/** "É meu" (gestor) ou "Atribuir a" (admin) para um ID da fila sem dono. */
export async function reivindicar(metaId: string, nivel: string, anuncianteEscolhido?: string): Promise<Resultado> {
  const u = await exigirUsuario();
  const anunciante = u.papel === "admin" ? anuncianteEscolhido ?? "" : u.anunciante ?? "";
  if (!advValido(anunciante)) return { ok: false, msg: "Anunciante inválido." };
  const id = metaId.replace(/\D/g, "");
  const existente = await prisma.metaRegistro.findUnique({ where: { metaId: id } });
  if (existente) {
    if (existente.anunciante === anunciante) return { ok: true, msg: "Esse ID já é seu." };
    if (u.papel !== "admin") {
      await prisma.disputa.create({ data: { metaId: id, anunciante, userId: u.id } });
      return { ok: false, msg: "Outro anunciante cadastrou esse ID antes. Abrimos uma disputa para o admin decidir." };
    }
  }
  await prisma.metaRegistro.upsert({
    where: { metaId: id },
    create: { metaId: id, nivel: nivel === "anuncio" ? "anuncio" : "campanha", nome: "(dar um nome)", anunciante, tipo: "definir", situacao: "ativa", createdBy: u.id },
    update: { anunciante },
  });
  await registrar(u, "reivindicar", `${id} → ${anunciante}`);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: `ID ${id} agora é de ${ADV[anunciante].nome}. Defina o nome e se é motor ou peça na tabela.` };
}

export async function editarRegistro(id: number, campos: { nome?: string; tipo?: string; situacao?: string; anunciante?: string }): Promise<Resultado> {
  const u = await exigirUsuario();
  const r = await prisma.metaRegistro.findUnique({ where: { id } });
  if (!r) return { ok: false, msg: "Cadastro não encontrado." };
  if (u.papel !== "admin" && r.anunciante !== u.anunciante) return { ok: false, msg: "Você só pode editar os seus IDs." };
  const data: { nome?: string; tipo?: string; situacao?: string; anunciante?: string } = {};
  if (campos.nome !== undefined) data.nome = campos.nome.trim().slice(0, 160) || "(sem nome)";
  if (campos.tipo !== undefined && tipoValido(campos.tipo)) data.tipo = campos.tipo;
  if (campos.situacao !== undefined && situacaoValida(campos.situacao)) data.situacao = campos.situacao;
  if (campos.anunciante !== undefined && u.papel === "admin" && advValido(campos.anunciante)) data.anunciante = campos.anunciante;
  await prisma.metaRegistro.update({ where: { id }, data });
  await registrar(u, "editar_id", `${r.metaId}: ${JSON.stringify(data)}`);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: "Atualizado." };
}

export async function removerRegistro(id: number): Promise<Resultado> {
  const u = await exigirUsuario();
  const r = await prisma.metaRegistro.findUnique({ where: { id } });
  if (!r) return { ok: false, msg: "Cadastro não encontrado." };
  if (u.papel !== "admin" && r.anunciante !== u.anunciante) return { ok: false, msg: "Você só pode remover os seus IDs." };
  await prisma.metaRegistro.delete({ where: { id } });
  await registrar(u, "remover_id", r.metaId);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: "Cadastro removido. Os leads desse ID voltam para a regra provisória." };
}

export async function resolverDisputa(disputaId: number, vencedor: string): Promise<Resultado> {
  const u = await exigirAdmin();
  if (!advValido(vencedor)) return { ok: false, msg: "Anunciante inválido." };
  const d = await prisma.disputa.findUnique({ where: { id: disputaId } });
  if (!d) return { ok: false, msg: "Disputa não encontrada." };
  await prisma.metaRegistro.updateMany({ where: { metaId: d.metaId }, data: { anunciante: vencedor } });
  await prisma.disputa.updateMany({ where: { metaId: d.metaId, status: "aberta" }, data: { status: "resolvida" } });
  await registrar(u, "resolver_disputa", `${d.metaId} → ${vencedor}`);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: `Disputa resolvida: ${d.metaId} ficou com ${ADV[vencedor].nome}.` };
}

// ---------------------------------------------------------------- admin
export async function novoUsuario(_: Resultado, f: FormData): Promise<Resultado> {
  const u = await exigirAdmin();
  const papel = txt(f, "papel") === "admin" ? "admin" : "gestor";
  const anunciante = txt(f, "anunciante");
  if (papel === "gestor" && !advValido(anunciante)) return { ok: false, msg: "Escolha o anunciante do gestor." };
  try {
    const novo = await criarUsuario({ nome: txt(f, "nome"), email: txt(f, "email"), senha: String(f.get("senha") ?? ""), papel, anunciante: papel === "gestor" ? anunciante : null });
    await registrar(u, "criar_usuario", `${novo.email} (${papel})`);
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
  revalidatePath("/usuarios");
  return { ok: true, msg: "Usuário criado. Passe o e-mail e a senha para a pessoa e peça para trocar a senha no primeiro acesso." };
}

export async function removerUsuario(userId: string): Promise<Resultado> {
  const u = await exigirAdmin();
  if (userId === u.id) return { ok: false, msg: "Você não pode remover o próprio usuário." };
  const alvo = await prisma.user.findUnique({ where: { id: userId } });
  if (!alvo) return { ok: false, msg: "Usuário não encontrado." };
  await prisma.user.delete({ where: { id: userId } });
  await registrar(u, "remover_usuario", alvo.email);
  revalidatePath("/usuarios");
  return { ok: true, msg: `Acesso de ${alvo.email} removido.` };
}

export async function gerarLinkPublico(): Promise<Resultado> {
  const u = await exigirAdmin();
  const token = randomBytes(12).toString("base64url");
  await prisma.$transaction([
    prisma.publicLink.updateMany({ where: { active: true }, data: { active: false } }),
    prisma.publicLink.create({ data: { token } }),
  ]);
  await registrar(u, "gerar_link_publico", "novo link; anterior desativado");
  revalidatePath("/usuarios");
  return { ok: true, msg: "Novo link gerado. O link anterior parou de funcionar." };
}

export async function desativarLinkPublico(): Promise<Resultado> {
  const u = await exigirAdmin();
  await prisma.publicLink.updateMany({ where: { active: true }, data: { active: false } });
  await registrar(u, "desativar_link_publico", "");
  revalidatePath("/usuarios");
  return { ok: true, msg: "Painel público desligado." };
}

export async function sincronizarAgora(): Promise<Resultado> {
  await exigirAdmin();
  try {
    const r = await sincronizarUmaVez();
    revalidatePath("/", "layout");
    return { ok: true, msg: `Sincronizado: ${r.leads} leads atualizados em ${r.fim - r.inicio}s.` };
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
}

// ---------------------------------------------------------------- anúncios do Meta
/** Marca motor/peça/misto em vários anúncios, conjuntos ou campanhas de uma vez. O dono vem da conta do Meta. */
export async function definirTipoEmLote(itens: { nivel: "campanha" | "conjunto" | "anuncio"; metaId: string }[], tipo: string): Promise<Resultado> {
  const u = await exigirUsuario();
  if (!tipoValido(tipo)) return { ok: false, msg: "Tipo inválido." };
  if (!itens.length) return { ok: false, msg: "Nada selecionado." };
  let feitos = 0, negados = 0;
  for (const it of itens.slice(0, 500)) {
    const fonte =
      it.nivel === "anuncio" ? await prisma.metaAnuncio.findUnique({ where: { id: it.metaId }, select: { nome: true, contaId: true } })
      : it.nivel === "conjunto" ? await prisma.metaConjunto.findUnique({ where: { id: it.metaId }, select: { nome: true, contaId: true } })
      : await prisma.metaCampanha.findUnique({ where: { id: it.metaId }, select: { nome: true, contaId: true } });
    if (!fonte) continue;
    const conta = await prisma.metaConta.findUnique({ where: { id: fonte.contaId } });
    if (!conta || (u.papel !== "admin" && conta.anunciante !== u.anunciante)) { negados++; continue; }
    await prisma.metaRegistro.upsert({
      where: { metaId: it.metaId },
      create: { metaId: it.metaId, nivel: it.nivel, nome: fonte.nome, anunciante: conta.anunciante, tipo, situacao: "ativa", createdBy: u.id },
      update: { tipo, nome: fonte.nome, anunciante: conta.anunciante, nivel: it.nivel },
    });
    feitos++;
  }
  await registrar(u, "tipo_em_lote", `${feitos} itens → ${tipo}`);
  await aposMudarCadastro("cadastro");
  const nomeTipo = { motor: "Motor", peca: "Peça", misto: "Misto", definir: "Definir" }[tipo];
  return { ok: feitos > 0, msg: `${feitos} marcado(s) como ${nomeTipo}.${negados ? ` ${negados} ignorado(s): são de outro anunciante.` : ""}` };
}

/** Tira a marcação de tipo (volta a usar o nível acima ou as tags do robô). */
export async function limparTipo(metaId: string): Promise<Resultado> {
  const u = await exigirUsuario();
  const r = await prisma.metaRegistro.findUnique({ where: { metaId } });
  if (!r) return { ok: true, msg: "Nada para limpar." };
  if (u.papel !== "admin" && r.anunciante !== u.anunciante) return { ok: false, msg: "Este item é de outro anunciante." };
  await prisma.metaRegistro.delete({ where: { metaId } });
  await registrar(u, "limpar_tipo", metaId);
  await aposMudarCadastro("cadastro");
  return { ok: true, msg: "Marcação removida." };
}

export async function sincronizarMetaAgora(): Promise<Resultado> {
  await exigirAdmin();
  try {
    const r = await sincronizarMetaUmaVez();
    revalidatePath("/", "layout");
    if (!r.contas && !r.erros.length) return { ok: false, msg: "Nenhum token do Meta configurado no .env (META_TOKEN_ALEX, META_TOKEN_MARCOS, META_TOKEN_MATRA)." };
    return {
      ok: r.erros.length === 0,
      msg: `Meta: ${r.contas} conta(s), ${r.campanhas} campanhas, ${r.anuncios} anúncios, ${r.gastos} dias de investimento.` + (r.erros.length ? ` Erros: ${r.erros.join(" · ")}` : ""),
    };
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
}

// ---------------------------------------------------------------- conexões "Conectar com Facebook"
/** Liga as contas escolhidas no popup a um anunciante e começa a importar os anúncios. */
export async function salvarContasConexao(conexaoId: number, escolhas: { contaId: string; anunciante: string }[]): Promise<Resultado> {
  const u = await exigirUsuario();
  const cx = await prisma.metaConexao.findUnique({ where: { id: conexaoId } });
  if (!cx || (cx.userId !== u.id && u.papel !== "admin")) return { ok: false, msg: "Conexão não encontrada." };
  const liberadas = new Map((cx.contasDisponiveis as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const ligadas: string[] = [], conflitos: string[] = [];
  for (const e of escolhas) {
    if (!liberadas.has(e.contaId)) continue;
    const anunciante = u.papel === "admin" ? e.anunciante : u.anunciante ?? "";
    if (!advValido(anunciante)) continue;
    const atual = await prisma.metaConta.findUnique({ where: { id: e.contaId } });
    if (atual && atual.anunciante !== anunciante && u.papel !== "admin") { conflitos.push(liberadas.get(e.contaId)!); continue; }
    await prisma.metaConta.upsert({
      where: { id: e.contaId },
      create: { id: e.contaId, nome: liberadas.get(e.contaId)!, anunciante, conexaoId },
      update: { nome: liberadas.get(e.contaId)!, anunciante, conexaoId, erro: null },
    });
    ligadas.push(e.contaId);
  }
  if (!ligadas.length) return { ok: false, msg: conflitos.length ? `Essas contas já são de outro anunciante: ${conflitos.join(", ")}. Fale com o admin.` : "Escolha ao menos uma conta." };
  await registrar(u, "meta_contas", `${ligadas.join(", ")} via ${cx.fbNome}`);
  after(async () => {
    try { await sincronizarMeta({ somenteContas: ligadas }); } catch (e) { console.error("[meta] importação falhou:", (e as Error).message); }
  });
  revalidatePath("/anuncios");
  return {
    ok: true,
    msg: `${ligadas.length} conta(s) conectada(s). Os anúncios estão sendo importados e aparecem em instantes.` + (conflitos.length ? ` Ignoradas (já são de outro anunciante): ${conflitos.join(", ")}.` : ""),
  };
}

export async function desconectarMeta(conexaoId: number): Promise<Resultado> {
  const u = await exigirUsuario();
  const cx = await prisma.metaConexao.findUnique({ where: { id: conexaoId } });
  if (!cx || (cx.userId !== u.id && u.papel !== "admin")) return { ok: false, msg: "Conexão não encontrada." };
  await prisma.metaConta.updateMany({ where: { conexaoId }, data: { conexaoId: null, erro: "Desconectada — reconecte para voltar a atualizar." } });
  await prisma.metaConexao.delete({ where: { id: conexaoId } });
  await registrar(u, "meta_desconectar", cx.fbNome);
  revalidatePath("/anuncios");
  return { ok: true, msg: `Acesso de ${cx.fbNome} removido. Os anúncios já importados continuam no painel, mas param de atualizar.` };
}

export async function reatribuirConta(contaId: string, anunciante: string): Promise<Resultado> {
  const u = await exigirAdmin();
  if (!advValido(anunciante)) return { ok: false, msg: "Anunciante inválido." };
  await prisma.metaConta.update({ where: { id: contaId }, data: { anunciante } });
  await registrar(u, "meta_reatribuir_conta", `${contaId} → ${anunciante}`);
  await aposMudarCadastro("meta");
  return { ok: true, msg: `Conta agora é de ${ADV[anunciante].nome}. Os leads foram recalculados.` };
}

/** Remove uma conta de anúncios do painel (e o catálogo e investimento importados dela). */
export async function removerConta(contaId: string): Promise<Resultado> {
  const u = await exigirUsuario();
  const conta = await prisma.metaConta.findUnique({ where: { id: contaId } });
  if (!conta) return { ok: false, msg: "Conta não encontrada." };
  if (u.papel !== "admin") {
    const cx = conta.conexaoId ? await prisma.metaConexao.findUnique({ where: { id: conta.conexaoId } }) : null;
    if (!cx || cx.userId !== u.id) return { ok: false, msg: "Só quem conectou a conta (ou um admin) pode removê-la." };
  }
  await prisma.$transaction([
    prisma.metaGasto.deleteMany({ where: { contaId } }),
    prisma.metaAnuncio.deleteMany({ where: { contaId } }),
    prisma.metaConjunto.deleteMany({ where: { contaId } }),
    prisma.metaCampanha.deleteMany({ where: { contaId } }),
    prisma.metaConta.delete({ where: { id: contaId } }),
  ]);
  await registrar(u, "meta_remover_conta", `${contaId} (${conta.nome})`);
  await aposMudarCadastro("meta");
  return { ok: true, msg: `Conta ${conta.nome} removida do painel. Os leads dela voltam a ser atribuídos pelos IDs cadastrados ou pela regra provisória.` };
}
