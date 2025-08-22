import { handle } from "@/lib/api/route-factory";
import { debugInfoRepo } from "@/lib/repos/debugInfoRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => debugInfoRepo.listByModelRun(id),
    (e: unknown) =>
      log.error("api.debug_info.by.modelRunId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "debug_info" },
        context: { foreignKey: "modelRunId", id },
        error: e,
      })
  );
}
