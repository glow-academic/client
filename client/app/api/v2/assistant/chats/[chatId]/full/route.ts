/**
 * Assistant chat full data endpoint (BFF)
 * Proxies to FastAPI server
 */

import { getApiBase } from "@/lib/api-base";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const { chatId } = params;
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");

    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id query parameter is required" },
        { status: 400 }
      );
    }

    const url = `${getApiBase()}/api/v2/assistant/chats/${chatId}/full?profile_id=${profileId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || "Server request failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("assistant.v2.chats.full.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
