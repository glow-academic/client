import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const appPrefix = process.env["APP_PREFIX"] || "";

  // Get the session to check user role
  const session = await auth();

  // If user is on Home but has 'guest' role -> Redirect to Practice
  // This catches authenticated guests (users with role='guest') before they reach the home page
  if (
    (path === `${appPrefix}/home` || path.endsWith("/home")) &&
    session?.user?.role === "guest"
  ) {
    const practiceUrl = new URL(
      `${appPrefix}/practice`,
      request.nextUrl.origin,
    );
    return NextResponse.redirect(practiceUrl);
  }

  // Inject pathname into headers so server components can access it
  const response = NextResponse.next();
  response.headers.set("x-pathname", path);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
