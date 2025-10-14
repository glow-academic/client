import { StaffDetailBulkRequestSchema } from "@/lib/api/v2/schemas/staff";
import { fetchStaffDetailBulk } from "@/lib/api/v2/server/staff";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = StaffDetailBulkRequestSchema.parse(body);

    const result = await fetchStaffDetailBulk(
      request.profileIds,
      request.currentProfileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("staff.v2.detail-bulk.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
