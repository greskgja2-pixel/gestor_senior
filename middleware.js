import { NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/shopee/callback"]);

export function middleware(request) {
  const { pathname } = request.nextUrl;
  if (pathname === "/shopeeos.html") return NextResponse.redirect(new URL("/", request.url));
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const sessionSecret = process.env.APP_SESSION_SECRET;
  const password = process.env.APP_ADMIN_PASSWORD;
  if (!sessionSecret || !password) {
    return new NextResponse("Acesso privado não configurado.", { status: 503 });
  }
  if (request.cookies.get("gs_session")?.value === sessionSecret) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|gestor-senior-logo.jpg|leather-navy.png).*)"],
};
