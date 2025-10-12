import { handle } from "@/lib/api/route-factory";
import { modelRunModelRepo } from "@/lib/repos/modelRunModelRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => modelRunModelRepo.listByModelRun(id),
    (e: unknown) =>
      log.error("api.model_run_models.by.modelRunId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "model_run_models" },
        context: { foreignKey: "modelRunId", id },
        error: e,
      })
  );
}
