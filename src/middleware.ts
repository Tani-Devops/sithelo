import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/register",
  "/about",
  "/resources",
  "/for-entrepreneurs",
  "/for-institutions",
  "/terms",
  "/privacy",
  "/auth",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

  if (!user && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Role-correct routing (Layer 1 — coarse and fast, not the security
  // boundary itself; Layer 2 guards.ts and Layer 3 RLS are what actually
  // stop unauthorized data access if this check is ever bypassed).
  if (user) {
    const roleRoutePrefix = path.startsWith("/admin") ? "admin"
      : path.startsWith("/institution") ? "institution"
      : path.startsWith("/entrepreneur") ? "entrepreneur"
      : null;

    if (roleRoutePrefix) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== roleRoutePrefix) {
        const ownDashboard = profile?.role === "admin" ? "/admin/dashboard"
          : profile?.role === "institution" ? "/institution/dashboard"
          : "/entrepreneur/dashboard";
        return NextResponse.redirect(new URL(ownDashboard, request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|llms.txt|icon.png|apple-icon.png|opengraph-image.png|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
