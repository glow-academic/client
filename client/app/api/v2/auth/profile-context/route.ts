import { LayoutContextRequestSchema } from "@/lib/api/v2/schemas/auth";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL =
  process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = LayoutContextRequestSchema.parse(body);

    const url = `${FASTAPI_URL}/api/v2/auth/profile-context`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    log.error("auth.v2.profile-context.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
