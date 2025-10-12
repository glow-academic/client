import { handle } from "@/lib/api/route-factory";
import { attemptProfileRepo, AttemptProfileCreateSchema } from "@/lib/repos/attemptProfileRepo";
import type { AttemptProfileCreate } from "@/lib/repos/attemptProfileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => attemptProfileRepo.list(),
    (e: unknown) =>
      log.error("api.attempt_profiles.list.failed", {
        message: "Failed to list attempt_profiles",
        subject: { entityType: "attempt_profiles" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AttemptProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AttemptProfileCreate;
  return handle(
    () => attemptProfileRepo.create(payload),
    (e: unknown) =>
      log.error("api.attempt_profiles.create.failed", {
        message: "Failed to create attemptProfile",
        subject: { entityType: "attempt_profiles" },
        context: { body: json },
        error: e,
      })
  );
}
