import { handle } from "@/lib/api/route-factory";
import type { ParameterUpdate } from "@/lib/repos/parameterRepo";
import {
  parameterRepo,
  ParameterUpdateSchema,
} from "@/lib/repos/parameterRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => parameterRepo.find(id),
    (e: unknown) =>
      log.error("api.parameters.get.failed", {
        message: "Failed to fetch parameter",
        subject: { entityType: "parameters", entityId: String(id) },
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
  const parsed = ParameterUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as ParameterUpdate;
  return handle(
    () => parameterRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.parameters.patch.failed", {
        message: "Failed to update parameter",
        subject: { entityType: "parameters", entityId: String(id) },
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
      await parameterRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.parameters.delete.failed", {
        message: "Failed to delete parameter",
        subject: { entityType: "parameters", entityId: String(id) },
        error: e,
      }),
  );
}
