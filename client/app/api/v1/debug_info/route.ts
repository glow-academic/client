import { handle } from "@/lib/api/route-factory";
import type { DebugInfoCreate } from "@/lib/repos/debugInfoRepo";
import {
  DebugInfoCreateSchema,
  debugInfoRepo,
} from "@/lib/repos/debugInfoRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => debugInfoRepo.list(),
    (e: unknown) =>
      log.error("api.debug_info.list.failed", {
        message: "Failed to list debug_info",
        subject: { entityType: "debug_info" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = DebugInfoCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as DebugInfoCreate;
  return handle(
    () => debugInfoRepo.create(payload),
    (e: unknown) =>
      log.error("api.debug_info.create.failed", {
        message: "Failed to create debugInfo",
        subject: { entityType: "debug_info" },
        context: { body: json },
        error: e,
      }),
  );
}
