import { getApiBase } from "@/lib/api-base";
import { BulkUpdateProfileRequestSchema } from "@/lib/api/v2/schemas/profile";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = BulkUpdateProfileRequestSchema.parse(body);

    const url = `${getApiBase()}/api/v2/profile/bulk-update`;
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
        `Failed to bulk update profiles: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.bulk-update.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
