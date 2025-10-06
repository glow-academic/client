import { handle } from "@/lib/api/route-factory";
import { parameterItemRepo } from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => parameterItemRepo.listByParameter(id),
    (e: unknown) =>
      log.error("api.parameter_items.by.parameterId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "parameter_items" },
        context: { foreignKey: "parameterId", id },
        error: e,
      }),
  );
}
