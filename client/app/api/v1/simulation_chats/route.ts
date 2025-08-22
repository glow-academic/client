import { handle } from "@/lib/api/route-factory";
import { simulationChatRepo, SimulationChatCreateSchema } from "@/lib/repos/simulationChatRepo";
import type { SimulationChatCreate } from "@/lib/repos/simulationChatRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationChatRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_chats.list.failed", {
        message: "Failed to list simulation_chats",
        subject: { entityType: "simulation_chats" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationChatCreate;
  return handle(
    () => simulationChatRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_chats.create.failed", {
        message: "Failed to create simulationChat",
        subject: { entityType: "simulation_chats" },
        context: { body: json },
        error: e,
      })
  );
}
