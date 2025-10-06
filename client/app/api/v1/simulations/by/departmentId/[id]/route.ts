import { handle } from "@/lib/api/route-factory";
import { simulationRepo } from "@/lib/repos/simulationRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.simulations.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulations" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
