import { handle } from "@/lib/api/route-factory";
import { modelRunPersonaRepo } from "@/lib/repos/modelRunPersonaRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => modelRunPersonaRepo.listByModelRun(id),
    (e: unknown) =>
      log.error("api.model_run_personas.by.modelRunId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "model_run_personas" },
        context: { foreignKey: "modelRunId", id },
        error: e,
      }),
  );
}
