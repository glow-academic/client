import { handle } from "@/lib/api/route-factory";
import type { DebugInfoUpdate } from "@/lib/repos/debugInfoRepo";
import {
  debugInfoRepo,
  DebugInfoUpdateSchema,
} from "@/lib/repos/debugInfoRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => debugInfoRepo.find(id),
    (e: unknown) =>
      log.error("api.debug_info.get.failed", {
        message: "Failed to fetch debugInfo",
        subject: { entityType: "debug_info", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = DebugInfoUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as DebugInfoUpdate;
  return handle(
    () => debugInfoRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.debug_info.patch.failed", {
        message: "Failed to update debugInfo",
        subject: { entityType: "debug_info", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    async () => {
      await debugInfoRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.debug_info.delete.failed", {
        message: "Failed to delete debugInfo",
        subject: { entityType: "debug_info", entityId: String(id) },
        error: e,
      })
  );
}
