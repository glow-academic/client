import { handle } from "@/lib/api/route-factory";
import { providerRepo, ProviderUpdateSchema } from "@/lib/repos/providerRepo";
import type { ProviderUpdate } from "@/lib/repos/providerRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => providerRepo.find(id),
    (e: unknown) =>
      log.error("api.providers.get.failed", {
        message: "Failed to fetch provider",
        subject: { entityType: "providers", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ProviderUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as ProviderUpdate;
  return handle(
    () => providerRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.providers.patch.failed", {
        message: "Failed to update provider",
        subject: { entityType: "providers", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await providerRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.providers.delete.failed", {
        message: "Failed to delete provider",
        subject: { entityType: "providers", entityId: String(id) },
        error: e,
      })
  );
}
