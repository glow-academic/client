import { handle } from "@/lib/api/route-factory";
import { appFeedbackRepo, AppFeedbackCreateSchema } from "@/lib/repos/appFeedbackRepo";
import type { AppFeedbackCreate } from "@/lib/repos/appFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => appFeedbackRepo.list(),
    (e: unknown) =>
      log.error("api.app_feedback.list.failed", {
        message: "Failed to list app_feedback",
        subject: { entityType: "app_feedback" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AppFeedbackCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as AppFeedbackCreate;
  return handle(
    () => appFeedbackRepo.create(payload),
    (e: unknown) =>
      log.error("api.app_feedback.create.failed", {
        message: "Failed to create appFeedback",
        subject: { entityType: "app_feedback" },
        context: { body: json },
        error: e,
      })
  );
}
