import { handle } from "@/lib/api/route-factory";
import { modelRunAgentRepo } from "@/lib/repos/modelRunAgentRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => modelRunAgentRepo.listByModelRun(id),
    (e: unknown) =>
      log.error("api.model_run_agents.by.modelRunId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "model_run_agents" },
        context: { foreignKey: "modelRunId", id },
        error: e,
      })
  );
}
