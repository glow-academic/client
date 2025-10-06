import { handle } from "@/lib/api/route-factory";
import { personaRepo, PersonaUpdateSchema } from "@/lib/repos/personaRepo";
import type { PersonaUpdate } from "@/lib/repos/personaRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => personaRepo.find(id),
    (e: unknown) =>
      log.error("api.personas.get.failed", {
        message: "Failed to fetch persona",
        subject: { entityType: "personas", entityId: String(id) },
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
  const parsed = PersonaUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as PersonaUpdate;
  return handle(
    () => personaRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.personas.patch.failed", {
        message: "Failed to update persona",
        subject: { entityType: "personas", entityId: String(id) },
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
      await personaRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.personas.delete.failed", {
        message: "Failed to delete persona",
        subject: { entityType: "personas", entityId: String(id) },
        error: e,
      }),
  );
}
