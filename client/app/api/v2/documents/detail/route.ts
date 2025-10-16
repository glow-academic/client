import { DocumentDetailRequestSchema } from "@/lib/api/v2/schemas/documents";
import { fetchDocumentDetail } from "@/lib/api/v2/server/documents";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = DocumentDetailRequestSchema.parse(body);

    const result = await fetchDocumentDetail(
      request.documentId,
      request.profileId
    );
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log.error("documents.v2.detail.error", {
      message: errorMessage,
      error,
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
