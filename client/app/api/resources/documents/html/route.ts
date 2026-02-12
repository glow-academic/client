import { INTERNAL_HTTP_BASE } from "@/lib/api/config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${INTERNAL_HTTP_BASE}/api/v4/resources/documents/html`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to fetch document HTML" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
