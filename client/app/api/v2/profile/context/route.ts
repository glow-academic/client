import { getApiBase } from "@/lib/api-base";
import { ProfileContextRequestSchema } from "@/lib/api/v2/schemas/profile";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = ProfileContextRequestSchema.parse(body);

    const url = `${getApiBase()}/api/v2/profile/context`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        userId: request.userId,
        effectiveProfileId: request.effectiveProfileId,
        pathname: request.pathname,
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
