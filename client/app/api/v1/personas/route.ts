import { handle } from "@/lib/api/route-factory";
import type { PersonaCreate } from "@/lib/repos/personaRepo";
import { PersonaCreateSchema, personaRepo } from "@/lib/repos/personaRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => personaRepo.list(),
    (e: unknown) =>
      log.error("api.personas.list.failed", {
        message: "Failed to list personas",
        subject: { entityType: "personas" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = PersonaCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as PersonaCreate;
  return handle(
    () => personaRepo.create(payload),
    (e: unknown) =>
      log.error("api.personas.create.failed", {
        message: "Failed to create persona",
        subject: { entityType: "personas" },
        context: { body: json },
        error: e,
      })
  );
}
