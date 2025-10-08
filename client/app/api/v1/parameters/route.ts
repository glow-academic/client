import { handle } from "@/lib/api/route-factory";
import type { ParameterCreate } from "@/lib/repos/parameterRepo";
import {
  ParameterCreateSchema,
  parameterRepo,
} from "@/lib/repos/parameterRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => parameterRepo.list(),
    (e: unknown) =>
      log.error("api.parameters.list.failed", {
        message: "Failed to list parameters",
        subject: { entityType: "parameters" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ParameterCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ParameterCreate;
  return handle(
    () => parameterRepo.create(payload),
    (e: unknown) =>
      log.error("api.parameters.create.failed", {
        message: "Failed to create parameter",
        subject: { entityType: "parameters" },
        context: { body: json },
        error: e,
      })
  );
}
