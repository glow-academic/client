import { handle } from "@/lib/api/route-factory";
import { standardGroupRepo } from "@/lib/repos/standardGroupRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => standardGroupRepo.listByRubric(id),
    (e: unknown) =>
      log.error("api.standard_groups.by.rubricId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "standard_groups" },
        context: { foreignKey: "rubricId", id },
        error: e,
      }),
  );
}
