import { handle } from "@/lib/api/route-factory";
import type { DocumentCreate } from "@/lib/repos/documentRepo";
import { DocumentCreateSchema, documentRepo } from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => documentRepo.list(),
    (e: unknown) =>
      log.error("api.documents.list.failed", {
        message: "Failed to list documents",
        subject: { entityType: "documents" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = DocumentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as DocumentCreate;
  return handle(
    () => documentRepo.create(payload),
    (e: unknown) =>
      log.error("api.documents.create.failed", {
        message: "Failed to create document",
        subject: { entityType: "documents" },
        context: { body: json },
        error: e,
      }),
  );
}
