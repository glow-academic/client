import { handle } from "@/lib/api/route-factory";
import {
  simulationChatRepo,
  SimulationChatUpdateSchema,
} from "@/lib/repos/simulationChatRepo";
import type { SimulationChatUpdate } from "@/lib/repos/simulationChatRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_chats.get.failed", {
        message: "Failed to fetch simulationChat",
        subject: { entityType: "simulation_chats", entityId: String(id) },
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
  const parsed = SimulationChatUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationChatUpdate;
  return handle(
    () => simulationChatRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_chats.patch.failed", {
        message: "Failed to update simulationChat",
        subject: { entityType: "simulation_chats", entityId: String(id) },
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
      await simulationChatRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_chats.delete.failed", {
        message: "Failed to delete simulationChat",
        subject: { entityType: "simulation_chats", entityId: String(id) },
        error: e,
      }),
  );
}
