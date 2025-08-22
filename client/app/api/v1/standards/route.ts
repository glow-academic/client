import { handle } from "@/lib/api/route-factory";
import { standardRepo, StandardCreateSchema } from "@/lib/repos/standardRepo";
import type { StandardCreate } from "@/lib/repos/standardRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => standardRepo.list(),
    (e: unknown) =>
      log.error("api.standards.list.failed", {
        message: "Failed to list standards",
        subject: { entityType: "standards" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = StandardCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as StandardCreate;
  return handle(
    () => standardRepo.create(payload),
    (e: unknown) =>
      log.error("api.standards.create.failed", {
        message: "Failed to create standard",
        subject: { entityType: "standards" },
        context: { body: json },
        error: e,
      })
  );
}
