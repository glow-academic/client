import { handle } from "@/lib/api/route-factory";
import {
  simulationChatGradeRepo,
  SimulationChatGradeUpdateSchema,
} from "@/lib/repos/simulationChatGradeRepo";
import type { SimulationChatGradeUpdate } from "@/lib/repos/simulationChatGradeRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatGradeRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.get.failed", {
        message: "Failed to fetch simulationChatGrade",
        subject: { entityType: "simulation_chat_grades", entityId: String(id) },
        error: e,
      }),
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatGradeUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationChatGradeUpdate;
  return handle(
    () => simulationChatGradeRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.patch.failed", {
        message: "Failed to update simulationChatGrade",
        subject: { entityType: "simulation_chat_grades", entityId: String(id) },
        context: { body: json },
        error: e,
      }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    async () => {
      await simulationChatGradeRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_chat_grades.delete.failed", {
        message: "Failed to delete simulationChatGrade",
        subject: { entityType: "simulation_chat_grades", entityId: String(id) },
        error: e,
      }),
  );
}
