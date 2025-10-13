import { handle } from "@/lib/api/route-factory";
import type { SimulationChatGradeCreate } from "@/lib/repos/simulationChatGradeRepo";
import {
  SimulationChatGradeCreateSchema,
  simulationChatGradeRepo,
} from "@/lib/repos/simulationChatGradeRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationChatGradeRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.list.failed", {
        message: "Failed to list simulation_chat_grades",
        subject: { entityType: "simulation_chat_grades" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatGradeCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationChatGradeCreate;
  return handle(
    () => simulationChatGradeRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.create.failed", {
        message: "Failed to create simulationChatGrade",
        subject: { entityType: "simulation_chat_grades" },
        context: { body: json },
        error: e,
      }),
  );
}
