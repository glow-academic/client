import { BreadcrumbsRequestSchema } from "@/lib/api/v2/schemas/breadcrumbs";
import { fetchBreadcrumbs } from "@/lib/api/v2/server/breadcrumbs";
import { log } from "@/lib/api/v2/server/logs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = BreadcrumbsRequestSchema.parse(body);

    const result = await fetchBreadcrumbs(request.pathname);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("breadcrumbs.v2.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

