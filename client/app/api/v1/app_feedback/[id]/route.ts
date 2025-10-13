import { handle } from "@/lib/api/route-factory";
import type { AppFeedbackUpdate } from "@/lib/repos/appFeedbackRepo";
import {
  appFeedbackRepo,
  AppFeedbackUpdateSchema,
} from "@/lib/repos/appFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => appFeedbackRepo.find(+id),
    (e: unknown) =>
      log.error("api.app_feedback.get.failed", {
        message: "Failed to fetch appFeedback",
        subject: { entityType: "app_feedback", entityId: String(id) },
        error: e,
      }),
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = AppFeedbackUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as AppFeedbackUpdate;
  return handle(
    () => appFeedbackRepo.update(+id, patch),
    (e: unknown) =>
      log.error("api.app_feedback.patch.failed", {
        message: "Failed to update appFeedback",
        subject: { entityType: "app_feedback", entityId: String(id) },
        context: { body: json },
        error: e,
      }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    async () => {
      await appFeedbackRepo.remove(+id);
      return {};
    },
    (e: unknown) =>
      log.error("api.app_feedback.delete.failed", {
        message: "Failed to delete appFeedback",
        subject: { entityType: "app_feedback", entityId: String(id) },
        error: e,
      }),
  );
}
