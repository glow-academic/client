import { handle } from "@/lib/api/route-factory";
import type { StandardGroupUpdate } from "@/lib/repos/standardGroupRepo";
import {
  standardGroupRepo,
  StandardGroupUpdateSchema,
} from "@/lib/repos/standardGroupRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => standardGroupRepo.find(id),
    (e: unknown) =>
      log.error("api.standard_groups.get.failed", {
        message: "Failed to fetch standardGroup",
        subject: { entityType: "standard_groups", entityId: String(id) },
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
  const parsed = StandardGroupUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as StandardGroupUpdate;
  return handle(
    () => standardGroupRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.standard_groups.patch.failed", {
        message: "Failed to update standardGroup",
        subject: { entityType: "standard_groups", entityId: String(id) },
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
      await standardGroupRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.standard_groups.delete.failed", {
        message: "Failed to delete standardGroup",
        subject: { entityType: "standard_groups", entityId: String(id) },
        error: e,
      }),
  );
}
