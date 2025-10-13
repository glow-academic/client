import { handle } from "@/lib/api/route-factory";
import type { ParameterItemCreate } from "@/lib/repos/parameterItemRepo";
import {
  ParameterItemCreateSchema,
  parameterItemRepo,
} from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => parameterItemRepo.list(),
    (e: unknown) =>
      log.error("api.parameter_items.list.failed", {
        message: "Failed to list parameter_items",
        subject: { entityType: "parameter_items" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ParameterItemCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ParameterItemCreate;
  return handle(
    () => parameterItemRepo.create(payload),
    (e: unknown) =>
      log.error("api.parameter_items.create.failed", {
        message: "Failed to create parameterItem",
        subject: { entityType: "parameter_items" },
        context: { body: json },
        error: e,
      }),
  );
}
