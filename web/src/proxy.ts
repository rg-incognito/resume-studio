import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// UX-only: redirects signed-out visits away from /dashboard before the shell
// renders. This is NOT the security boundary — every /api route independently
// verifies the real Firebase ID token via getCurrentUser() (see src/lib/auth.ts).
// Next.js docs explicitly warn against relying on Proxy alone for auth.
export function proxy(request: NextRequest) {
  const hasAuthHint = request.cookies.has("auth-hint");
  if (!hasAuthHint) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
