import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";

/**
 * Browser calls this once after OAuth completes. The route reads the
 * Auth.js session, returns the access/refresh tokens to the browser,
 * then clears the session cookie. After this call the server holds nothing.
 *
 * Phase-1 STUB: returns 501 until provider-agent wires real session token
 * extraction in the per-provider implementation phase.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // STUB: real token extraction lands with provider-agent in Phase 2.
  // The Auth.js session itself doesn't expose tokens by default — we use
  // a custom JWT callback to surface them safely.

  const c = await cookies();
  // Clear all auth cookies so server holds nothing.
  for (const cookie of c.getAll()) {
    if (cookie.name.startsWith("authjs.") || cookie.name.startsWith("__Secure-authjs.")) {
      c.delete(cookie.name);
    }
  }

  return NextResponse.json(
    { error: "stub_not_implemented", message: "Handoff implementation lands in provider-agent phase." },
    { status: 501 },
  );
}
