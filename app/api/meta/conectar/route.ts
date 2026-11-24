import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appConfigurado, urlLogin } from "@/lib/meta";

// Abre (dentro do popup) o login do Facebook pedindo acesso de leitura às contas de anúncio.
export async function GET(req: Request) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  if (!appConfigurado()) return NextResponse.redirect(new URL("/meta/contas?erro=app", req.url));
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("meta_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(urlLogin(state));
}
