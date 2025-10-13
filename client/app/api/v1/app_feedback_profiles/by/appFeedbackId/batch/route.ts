import { handle } from "@/lib/api/route-factory";
import { appFeedbackProfileRepo } from "@/lib/repos/appFeedbackProfileRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.number()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => appFeedbackProfileRepo.listByAppFeedbacks(parsed.data.ids),
    (e: unknown) =>
      log.error("api.app_feedback_profiles.by.appFeedbackId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "app_feedback_profiles" },
        context: { foreignKey: "appFeedbackId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
