import { handle } from "@/lib/api/route-factory";
import { cohortProfileRepo, CohortProfileCreateSchema } from "@/lib/repos/cohortProfileRepo";
import type { CohortProfileCreate } from "@/lib/repos/cohortProfileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => cohortProfileRepo.list(),
    (e: unknown) =>
      log.error("api.cohort_profiles.list.failed", {
        message: "Failed to list cohort_profiles",
        subject: { entityType: "cohort_profiles" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = CohortProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as CohortProfileCreate;
  return handle(
    () => cohortProfileRepo.create(payload),
    (e: unknown) =>
      log.error("api.cohort_profiles.create.failed", {
        message: "Failed to create cohortProfile",
        subject: { entityType: "cohort_profiles" },
        context: { body: json },
        error: e,
      })
  );
}
