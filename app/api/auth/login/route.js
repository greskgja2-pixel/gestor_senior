import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function matches(value, expected) {
  const left = Buffer.from(value || "");
  const right = Buffer.from(expected || "");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  const configuredPassword = process.env.APP_ADMIN_PASSWORD;
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!configuredPassword || !sessionSecret) {
    return NextResponse.json({ error: "O acesso privado ainda não foi configurado." }, { status: 503 });
  }

  const form = await request.formData();
  if (!matches(String(form.get("password") || ""), configuredPassword)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set({
    name: "gs_session",
    value: sessionSecret,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
