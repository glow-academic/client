import { handle } from "@/lib/api/route-factory";
import { agentRepo, AgentUpdateSchema } from "@/lib/repos/agentRepo";
import type { AgentUpdate } from "@/lib/repos/agentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => agentRepo.find(id),
    (e: unknown) =>
      log.error("api.agents.get.failed", {
        message: "Failed to fetch agent",
        subject: { entityType: "agents", entityId: String(id) },
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
  const parsed = AgentUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as AgentUpdate;
  return handle(
    () => agentRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.agents.patch.failed", {
        message: "Failed to update agent",
        subject: { entityType: "agents", entityId: String(id) },
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
      await agentRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.agents.delete.failed", {
        message: "Failed to delete agent",
        subject: { entityType: "agents", entityId: String(id) },
        error: e,
      }),
  );
}
