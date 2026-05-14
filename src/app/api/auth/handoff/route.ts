import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Browser calls this once after OAuth completes. The route reads the
 * Auth.js JWT, returns the access/refresh tokens to the browser, then
 * clears the session cookies. After this call the server holds nothing.
 */
export async function POST(req: Request) {
  if (!env.AUTH_SECRET) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 501 });
  }
  const token = await getToken({
    req: req as unknown as Parameters<typeof getToken>[0]["req"],
    secret: env.AUTH_SECRET,
  });
  if (!token) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const payload = {
    provider: token.providerId,
    email: token.email,
    accessToken: (token as { accessToken?: string }).accessToken,
    refreshToken: (token as { refreshToken?: string }).refreshToken,
    expiresAt: (token as { expiresAt?: number }).expiresAt,
    scope: (token as { scope?: string }).scope,
  };

  const c = await cookies();
  for (const cookie of c.getAll()) {
    if (cookie.name.startsWith("authjs.") || cookie.name.startsWith("__Secure-authjs.")) {
      c.delete(cookie.name);
    }
  }

  return NextResponse.json(payload);
}
