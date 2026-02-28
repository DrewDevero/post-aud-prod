import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sp-user";

export function middleware(req: NextRequest) {
  const user = req.cookies.get(COOKIE_NAME);
  const { pathname } = req.nextUrl;

  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
