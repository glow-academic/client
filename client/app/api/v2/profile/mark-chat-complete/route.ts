import { getApiBase } from "@/lib/api-base";
import { MarkChatCompleteRequestSchema } from "@/lib/api/v2/schemas/profile";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = MarkChatCompleteRequestSchema.parse(body);

    const response = await fetch(
      `${getApiBase()}/api/v2/profile/mark-chat-complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to mark chat complete");
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("profile.v2.mark-chat-complete", {
      message: errorMessage,
      error,
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
