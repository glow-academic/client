import { StaffDetailRequestSchema } from "@/lib/api/v2/schemas/staff";
import { fetchStaffDetail } from "@/lib/api/v2/server/staff";
import { log } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = StaffDetailRequestSchema.parse(body);

    const result = await fetchStaffDetail(
      request.profileId,
      request.currentProfileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("staff.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
