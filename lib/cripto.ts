import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

// Criptografa segredos guardados no banco (tokens do Meta). Chave derivada de META_TOKEN_KEY
// ou, se não houver, de BETTER_AUTH_SECRET. Trocar a chave invalida os tokens guardados (é só reconectar).
function chave() {
  const base = process.env.META_TOKEN_KEY || process.env.BETTER_AUTH_SECRET;
  if (!base) throw new Error("Defina BETTER_AUTH_SECRET (ou META_TOKEN_KEY) no .env");
  return createHash("sha256").update("comafe-meta:" + base).digest();
}

export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(pacote: string) {
  const [iv, tag, dados] = pacote.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", chave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
}

/** appsecret_proof exigido pelo Meta quando o app tem "Exigir segredo do app" ligado. */
export const provaSegredo = (token: string, segredo: string) => createHmac("sha256", segredo).update(token).digest("hex");
