import { handle } from "@/lib/api/route-factory";
import { rubricRepo, RubricCreateSchema } from "@/lib/repos/rubricRepo";
import type { RubricCreate } from "@/lib/repos/rubricRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => rubricRepo.list(),
    (e: unknown) =>
      log.error("api.rubrics.list.failed", {
        message: "Failed to list rubrics",
        subject: { entityType: "rubrics" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = RubricCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as RubricCreate;
  return handle(
    () => rubricRepo.create(payload),
    (e: unknown) =>
      log.error("api.rubrics.create.failed", {
        message: "Failed to create rubric",
        subject: { entityType: "rubrics" },
        context: { body: json },
        error: e,
      })
  );
}
