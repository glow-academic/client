import { handle } from "@/lib/api/route-factory";
import type { RubricUpdate } from "@/lib/repos/rubricRepo";
import { rubricRepo, RubricUpdateSchema } from "@/lib/repos/rubricRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => rubricRepo.find(id),
    (e: unknown) =>
      log.error("api.rubrics.get.failed", {
        message: "Failed to fetch rubric",
        subject: { entityType: "rubrics", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = RubricUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as RubricUpdate;
  return handle(
    () => rubricRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.rubrics.patch.failed", {
        message: "Failed to update rubric",
        subject: { entityType: "rubrics", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    async () => {
      await rubricRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.rubrics.delete.failed", {
        message: "Failed to delete rubric",
        subject: { entityType: "rubrics", entityId: String(id) },
        error: e,
      })
  );
}
