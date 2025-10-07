import { handle } from "@/lib/api/route-factory";
import { modelRepo } from "@/lib/repos/modelRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => modelRepo.listByProvider(id),
    (e: unknown) =>
      log.error("api.models.by.providerId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "models" },
        context: { foreignKey: "providerId", id },
        error: e,
      }),
  );
}
