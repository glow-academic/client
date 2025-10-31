import { auth } from "@/auth";
import { getApiBase } from "@/lib/api-base";
import { ProfileFiltersSchema } from "@/lib/api/v2/schemas/profile";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    // Get session to derive the actual user's profile ID
    const session = await auth();
    if (!session?.user?.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    // Override profileId from session (security)
    const filters = ProfileFiltersSchema.parse({
      ...body,
      profileId: session.user.profileId,
    });

    const url = `${getApiBase()}/api/v2/profile/list`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch profile list: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.list.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
