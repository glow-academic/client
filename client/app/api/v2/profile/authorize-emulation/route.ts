import { auth } from "@/auth";
import { getApiBase } from "@/lib/api/v2/api-base";
import { AuthorizeEmulationRequestSchema } from "@/lib/api/v2/schemas/profile";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Get session to derive the actual requester's profile ID
    const session = await auth();
    if (!session?.user?.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Parse the request but override requesterProfileId with session value
    // to prevent privilege escalation via client-supplied ID
    const request = AuthorizeEmulationRequestSchema.parse({
      ...body,
      requesterProfileId: session.user.profileId,
    });

    const url = `${getApiBase()}/api/v2/profile/authorize-emulation`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to authorize emulation: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.authorize-emulation.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
