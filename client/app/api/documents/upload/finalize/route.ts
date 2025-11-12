import { api } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const data = await api.post("/documents/upload/finalize", {
      body,
    });

    return NextResponse.json(data);
  } catch (error) {
    // Handle API errors
    if (error instanceof Error && error.message.includes(" ")) {
      const [status, ...rest] = error.message.split(" ");
      const statusCode = parseInt(status || "500", 10);
      if (!isNaN(statusCode)) {
        return NextResponse.json(
          { error: rest.join(" ") },
          { status: statusCode }
        );
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
