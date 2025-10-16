import { getApiBase } from "@/lib/api-base";
import { UpdateChatCreatedAtRequestSchema } from "@/lib/api/v2/schemas/attempts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = UpdateChatCreatedAtRequestSchema.parse(body);

    const url = `${getApiBase()}/api/v2/attempts/chats/update-created-at`;
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
        `Failed to update chat createdAt: ${response.status} ${errorText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("attempts.v2.chats.update-created-at.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
