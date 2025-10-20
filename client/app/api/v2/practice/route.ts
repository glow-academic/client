import { AnalyticsFiltersSchema } from "@/lib/api/v2/schemas/base";
import { log } from "@/lib/api/v2/server/logs";
import { fetchPractice } from "@/lib/api/v2/server/practice";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filters = AnalyticsFiltersSchema.parse(body);

    const result = await fetchPractice(filters);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("practice.v2.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
