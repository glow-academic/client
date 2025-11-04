import { auth } from "@/auth";
import { getApiBase } from "@/lib/api/v2/api-base";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Get session to derive the actual user's identity
    const session = await auth();
    if (!session?.user?.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Extract pathname from request, but derive profile IDs from session
    const pathname = body.pathname || "/";

    const url = `${getApiBase()}/api/v2/profile/context`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        actualProfileId: session.user.profileId, // Server-trusted: logged-in user
        effectiveProfileId: session.effectiveProfileId, // Server-trusted: could be emulated
        pathname: pathname, // Safe metadata for breadcrumbs
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch profile context: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.context.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
