import { handle } from "@/lib/api/route-factory";
import type { AssistantMessageUpdate } from "@/lib/repos/assistantMessageRepo";
import {
  assistantMessageRepo,
  AssistantMessageUpdateSchema,
} from "@/lib/repos/assistantMessageRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => assistantMessageRepo.find(id),
    (e: unknown) =>
      log.error("api.assistant_messages.get.failed", {
        message: "Failed to fetch assistantMessage",
        subject: { entityType: "assistant_messages", entityId: String(id) },
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
  const parsed = AssistantMessageUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as AssistantMessageUpdate;
  return handle(
    () => assistantMessageRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.assistant_messages.patch.failed", {
        message: "Failed to update assistantMessage",
        subject: { entityType: "assistant_messages", entityId: String(id) },
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
      await assistantMessageRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.assistant_messages.delete.failed", {
        message: "Failed to delete assistantMessage",
        subject: { entityType: "assistant_messages", entityId: String(id) },
        error: e,
      }),
  );
}
