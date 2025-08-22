import { handle } from "@/lib/api/route-factory";
import { modelRunRepo } from "@/lib/repos/modelRunRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => modelRunRepo.listByPersona(id),
    (e: unknown) =>
      log.error("api.model_runs.by.personaId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "model_runs" },
        context: { foreignKey: "personaId", id },
        error: e,
      })
  );
}
