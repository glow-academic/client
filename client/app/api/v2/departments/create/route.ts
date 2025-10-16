import { getApiBase } from "@/lib/api-base";
import { CreateDepartmentRequestSchema } from "@/lib/api/v2/schemas/departments";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const createRequest = CreateDepartmentRequestSchema.parse(body);

    const response = await fetch(`${getApiBase()}/api/v2/departments/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(createRequest),
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
    log.error("departments.v2.create.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
