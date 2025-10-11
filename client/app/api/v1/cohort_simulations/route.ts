import { handle } from "@/lib/api/route-factory";
import { cohortSimulationRepo, CohortSimulationCreateSchema } from "@/lib/repos/cohortSimulationRepo";
import type { CohortSimulationCreate } from "@/lib/repos/cohortSimulationRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => cohortSimulationRepo.list(),
    (e: unknown) =>
      log.error("api.cohort_simulations.list.failed", {
        message: "Failed to list cohort_simulations",
        subject: { entityType: "cohort_simulations" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = CohortSimulationCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as CohortSimulationCreate;
  return handle(
    () => cohortSimulationRepo.create(payload),
    (e: unknown) =>
      log.error("api.cohort_simulations.create.failed", {
        message: "Failed to create cohortSimulation",
        subject: { entityType: "cohort_simulations" },
        context: { body: json },
        error: e,
      })
  );
}
