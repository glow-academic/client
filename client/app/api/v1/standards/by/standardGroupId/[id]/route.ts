import { handle } from "@/lib/api/route-factory";
import { standardRepo } from "@/lib/repos/standardRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => standardRepo.listByStandardGroup(id),
    (e: unknown) =>
      log.error("api.standards.by.standardGroupId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "standards" },
        context: { foreignKey: "standardGroupId", id },
        error: e,
      })
  );
}
