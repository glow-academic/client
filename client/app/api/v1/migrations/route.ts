import { handle } from "@/lib/api/route-factory";
import type { MigrationCreate } from "@/lib/repos/migrationRepo";
import {
  MigrationCreateSchema,
  migrationRepo,
} from "@/lib/repos/migrationRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => migrationRepo.list(),
    (e: unknown) =>
      log.error("api.migrations.list.failed", {
        message: "Failed to list migrations",
        subject: { entityType: "migrations" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = MigrationCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as MigrationCreate;
  return handle(
    () => migrationRepo.create(payload),
    (e: unknown) =>
      log.error("api.migrations.create.failed", {
        message: "Failed to create migration",
        subject: { entityType: "migrations" },
        context: { body: json },
        error: e,
      })
  );
}
