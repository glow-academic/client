import { getApiBase } from "@/lib/api-base";
import {
  UpdateProfileSimpleRequestSchema,
  UpdateProfileSimpleResponseSchema,
} from "@/lib/api/v2/schemas/profile";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = UpdateProfileSimpleRequestSchema.parse(body);

    const url = `${getApiBase()}/api/v2/profile/update-simple`;
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
        `Failed to update simple profile: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    // Validate response schema to ensure type safety
    const validated = UpdateProfileSimpleResponseSchema.parse(result);
    return NextResponse.json(validated);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.update-simple.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
