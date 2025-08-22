import { handle } from "@/lib/api/route-factory";
import { cohortRepo, CohortUpdateSchema } from "@/lib/repos/cohortRepo";
import type { CohortUpdate } from "@/lib/repos/cohortRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => cohortRepo.find(id),
    (e: unknown) =>
      log.error("api.cohorts.get.failed", {
        message: "Failed to fetch cohort",
        subject: { entityType: "cohorts", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = CohortUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as CohortUpdate;
  return handle(
    () => cohortRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.cohorts.patch.failed", {
        message: "Failed to update cohort",
        subject: { entityType: "cohorts", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await cohortRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.cohorts.delete.failed", {
        message: "Failed to delete cohort",
        subject: { entityType: "cohorts", entityId: String(id) },
        error: e,
      })
  );
}
