import { DepartmentDetailDefaultRequestSchema } from "@/lib/api/v2/schemas/departments";
import { fetchDepartmentDetailDefault } from "@/lib/api/v2/server/departments";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = DepartmentDetailDefaultRequestSchema.parse(body);

    const result = await fetchDepartmentDetailDefault(request.profileId);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("departments.v2.detail-default.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
