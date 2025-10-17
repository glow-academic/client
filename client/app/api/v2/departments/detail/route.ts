import { DepartmentDetailRequestSchema } from "@/lib/api/v2/schemas/departments";
import { fetchDepartmentDetail } from "@/lib/api/v2/server/departments";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = DepartmentDetailRequestSchema.parse(body);

    const result = await fetchDepartmentDetail(
      request.departmentId,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("departments.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
