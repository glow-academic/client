import { handle } from "@/lib/api/route-factory";
import { scenarioDocumentRepo, ScenarioDocumentCreateSchema } from "@/lib/repos/scenarioDocumentRepo";
import type { ScenarioDocumentCreate } from "@/lib/repos/scenarioDocumentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioDocumentRepo.list(),
    (e: unknown) =>
      log.error("api.scenario_documents.list.failed", {
        message: "Failed to list scenario_documents",
        subject: { entityType: "scenario_documents" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioDocumentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioDocumentCreate;
  return handle(
    () => scenarioDocumentRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenario_documents.create.failed", {
        message: "Failed to create scenarioDocument",
        subject: { entityType: "scenario_documents" },
        context: { body: json },
        error: e,
      })
  );
}
