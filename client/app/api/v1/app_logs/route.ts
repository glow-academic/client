import { handle } from "@/lib/api/route-factory";
import type { AppLogCreate } from "@/lib/repos/appLogRepo";
import { AppLogCreateSchema, appLogRepo } from "@/lib/repos/appLogRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => appLogRepo.list(),
    (e: unknown) =>
      log.error("api.app_logs.list.failed", {
        message: "Failed to list app_logs",
        subject: { entityType: "app_logs" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AppLogCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AppLogCreate;
  return handle(
    () => appLogRepo.create(payload),
    (e: unknown) =>
      log.error("api.app_logs.create.failed", {
        message: "Failed to create appLog",
        subject: { entityType: "app_logs" },
        context: { body: json },
        error: e,
      }),
  );
}
