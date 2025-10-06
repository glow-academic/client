import { handle } from "@/lib/api/route-factory";
import { agentRepo } from "@/lib/repos/agentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => agentRepo.listByModel(id),
    (e: unknown) =>
      log.error("api.agents.by.modelId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "agents" },
        context: { foreignKey: "modelId", id },
        error: e,
      }),
  );
}
