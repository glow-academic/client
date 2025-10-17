import { DocumentDetailBulkRequestSchema } from "@/lib/api/v2/schemas/documents";
import { fetchDocumentDetailBulk } from "@/lib/api/v2/server/documents";
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/api/v2/server/logs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = DocumentDetailBulkRequestSchema.parse(body);

    const result = await fetchDocumentDetailBulk(
      request.documentIds,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("documents.v2.detail-bulk.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
