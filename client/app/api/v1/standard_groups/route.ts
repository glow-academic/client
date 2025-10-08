import { handle } from "@/lib/api/route-factory";
import type { StandardGroupCreate } from "@/lib/repos/standardGroupRepo";
import {
  StandardGroupCreateSchema,
  standardGroupRepo,
} from "@/lib/repos/standardGroupRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => standardGroupRepo.list(),
    (e: unknown) =>
      log.error("api.standard_groups.list.failed", {
        message: "Failed to list standard_groups",
        subject: { entityType: "standard_groups" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = StandardGroupCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as StandardGroupCreate;
  return handle(
    () => standardGroupRepo.create(payload),
    (e: unknown) =>
      log.error("api.standard_groups.create.failed", {
        message: "Failed to create standardGroup",
        subject: { entityType: "standard_groups" },
        context: { body: json },
        error: e,
      })
  );
}
