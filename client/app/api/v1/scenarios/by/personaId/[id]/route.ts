import { handle } from "@/lib/api/route-factory";
import { scenarioRepo } from "@/lib/repos/scenarioRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => scenarioRepo.listByPersona(id),
    (e: unknown) =>
      log.error("api.scenarios.by.personaId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenarios" },
        context: { foreignKey: "personaId", id },
        error: e,
      })
  );
}
