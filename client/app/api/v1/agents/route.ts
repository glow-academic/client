import { handle } from "@/lib/api/route-factory";
import { agentRepo, AgentCreateSchema } from "@/lib/repos/agentRepo";
import type { AgentCreate } from "@/lib/repos/agentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => agentRepo.list(),
    (e: unknown) =>
      log.error("api.agents.list.failed", {
        message: "Failed to list agents",
        subject: { entityType: "agents" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AgentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as AgentCreate;
  return handle(
    () => agentRepo.create(payload),
    (e: unknown) =>
      log.error("api.agents.create.failed", {
        message: "Failed to create agent",
        subject: { entityType: "agents" },
        context: { body: json },
        error: e,
      }),
  );
}
