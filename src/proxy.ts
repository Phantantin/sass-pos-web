import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const handleIntlRouting = createIntlMiddleware(routing);
const protectedSegments = new Set([
  "dashboard",
  "pos",
  "store",
  "branches",
  "employees",
  "categories",
  "products",
  "inventory",
  "customers",
  "orders",
  "refunds",
  "shifts",
  "reports",
  "subscriptions",
  "audit-logs",
]);

export function proxy(request: NextRequest) {
  const response = handleIntlRouting(request);
  const [, locale, segment] = request.nextUrl.pathname.split("/");
  const isProtected =
    routing.locales.includes(locale as (typeof routing.locales)[number]) && protectedSegments.has(segment);

  if (isProtected && !request.cookies.get("sass_pos_session")) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
