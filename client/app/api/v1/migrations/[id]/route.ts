import { handle } from "@/lib/api/route-factory";
import { migrationRepo, MigrationUpdateSchema } from "@/lib/repos/migrationRepo";
import type { MigrationUpdate } from "@/lib/repos/migrationRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => migrationRepo.find(+id),
    (e: unknown) =>
      log.error("api.migrations.get.failed", {
        message: "Failed to fetch migration",
        subject: { entityType: "migrations", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = MigrationUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as MigrationUpdate;
  return handle(
    () => migrationRepo.update(+id, patch),
    (e: unknown) =>
      log.error("api.migrations.patch.failed", {
        message: "Failed to update migration",
        subject: { entityType: "migrations", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await migrationRepo.remove(+id); return {}; },
    (e: unknown) =>
      log.error("api.migrations.delete.failed", {
        message: "Failed to delete migration",
        subject: { entityType: "migrations", entityId: String(id) },
        error: e,
      })
  );
}
