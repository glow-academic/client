import { handle } from "@/lib/api/route-factory";
import { parameterItemRepo, ParameterItemUpdateSchema } from "@/lib/repos/parameterItemRepo";
import type { ParameterItemUpdate } from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => parameterItemRepo.find(id),
    (e: unknown) =>
      log.error("api.parameter_items.get.failed", {
        message: "Failed to fetch parameterItem",
        subject: { entityType: "parameter_items", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ParameterItemUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as ParameterItemUpdate;
  return handle(
    () => parameterItemRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.parameter_items.patch.failed", {
        message: "Failed to update parameterItem",
        subject: { entityType: "parameter_items", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await parameterItemRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.parameter_items.delete.failed", {
        message: "Failed to delete parameterItem",
        subject: { entityType: "parameter_items", entityId: String(id) },
        error: e,
      })
  );
}
