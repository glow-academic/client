import { NextRequest, NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  // Simple middleware that doesn't use database operations
  // Auth will be handled in API routes and server components

  // Allow all requests to pass through for now
  // You can add route protection logic here that doesn't require database access
  // For example, checking for auth cookies or JWT tokens

  return NextResponse.next();
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
