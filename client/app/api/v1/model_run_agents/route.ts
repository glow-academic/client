import { handle } from "@/lib/api/route-factory";
import { modelRunAgentRepo, ModelRunAgentCreateSchema } from "@/lib/repos/modelRunAgentRepo";
import type { ModelRunAgentCreate } from "@/lib/repos/modelRunAgentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRunAgentRepo.list(),
    (e: unknown) =>
      log.error("api.model_run_agents.list.failed", {
        message: "Failed to list model_run_agents",
        subject: { entityType: "model_run_agents" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunAgentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelRunAgentCreate;
  return handle(
    () => modelRunAgentRepo.create(payload),
    (e: unknown) =>
      log.error("api.model_run_agents.create.failed", {
        message: "Failed to create modelRunAgent",
        subject: { entityType: "model_run_agents" },
        context: { body: json },
        error: e,
      })
  );
}
