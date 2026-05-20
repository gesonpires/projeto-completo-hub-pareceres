import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth";

export async function GET(req: Request) {
  await clearSessionCookie();
  const url = new URL(req.url);
  url.pathname = "/login";
  url.search = "";
  url.hash = "";
  return NextResponse.redirect(url);
}

