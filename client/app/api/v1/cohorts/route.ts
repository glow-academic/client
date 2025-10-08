import { handle } from "@/lib/api/route-factory";
import type { CohortCreate } from "@/lib/repos/cohortRepo";
import { CohortCreateSchema, cohortRepo } from "@/lib/repos/cohortRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => cohortRepo.list(),
    (e: unknown) =>
      log.error("api.cohorts.list.failed", {
        message: "Failed to list cohorts",
        subject: { entityType: "cohorts" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = CohortCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as CohortCreate;
  return handle(
    () => cohortRepo.create(payload),
    (e: unknown) =>
      log.error("api.cohorts.create.failed", {
        message: "Failed to create cohort",
        subject: { entityType: "cohorts" },
        context: { body: json },
        error: e,
      })
  );
}
