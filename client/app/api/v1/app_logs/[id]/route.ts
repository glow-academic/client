import { handle } from "@/lib/api/route-factory";
import { appLogRepo, AppLogUpdateSchema } from "@/lib/repos/appLogRepo";
import type { AppLogUpdate } from "@/lib/repos/appLogRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => appLogRepo.find(+id),
    (e: unknown) =>
      log.error("api.app_logs.get.failed", {
        message: "Failed to fetch appLog",
        subject: { entityType: "app_logs", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = AppLogUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as AppLogUpdate;
  return handle(
    () => appLogRepo.update(+id, patch),
    (e: unknown) =>
      log.error("api.app_logs.patch.failed", {
        message: "Failed to update appLog",
        subject: { entityType: "app_logs", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await appLogRepo.remove(+id); return {}; },
    (e: unknown) =>
      log.error("api.app_logs.delete.failed", {
        message: "Failed to delete appLog",
        subject: { entityType: "app_logs", entityId: String(id) },
        error: e,
      })
  );
}
