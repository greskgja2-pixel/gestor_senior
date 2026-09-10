import { NextResponse } from "next/server";

export async function POST(request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: "gs_session", value: "", path: "/", maxAge: 0 });
  return response;
}
