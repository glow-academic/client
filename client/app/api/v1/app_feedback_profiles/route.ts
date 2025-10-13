import { handle } from "@/lib/api/route-factory";
import {
  appFeedbackProfileRepo,
  AppFeedbackProfileCreateSchema,
} from "@/lib/repos/appFeedbackProfileRepo";
import type { AppFeedbackProfileCreate } from "@/lib/repos/appFeedbackProfileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => appFeedbackProfileRepo.list(),
    (e: unknown) =>
      log.error("api.app_feedback_profiles.list.failed", {
        message: "Failed to list app_feedback_profiles",
        subject: { entityType: "app_feedback_profiles" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AppFeedbackProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AppFeedbackProfileCreate;
  return handle(
    () => appFeedbackProfileRepo.create(payload),
    (e: unknown) =>
      log.error("api.app_feedback_profiles.create.failed", {
        message: "Failed to create appFeedbackProfile",
        subject: { entityType: "app_feedback_profiles" },
        context: { body: json },
        error: e,
      }),
  );
}
