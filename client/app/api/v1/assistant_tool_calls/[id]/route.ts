import { handle } from "@/lib/api/route-factory";
import type { AssistantToolCallUpdate } from "@/lib/repos/assistantToolCallRepo";
import {
  assistantToolCallRepo,
  AssistantToolCallUpdateSchema,
} from "@/lib/repos/assistantToolCallRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => assistantToolCallRepo.find(id),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.get.failed", {
        message: "Failed to fetch assistantToolCall",
        subject: { entityType: "assistant_tool_calls", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = AssistantToolCallUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as AssistantToolCallUpdate;
  return handle(
    () => assistantToolCallRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.patch.failed", {
        message: "Failed to update assistantToolCall",
        subject: { entityType: "assistant_tool_calls", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    async () => {
      await assistantToolCallRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.assistant_tool_calls.delete.failed", {
        message: "Failed to delete assistantToolCall",
        subject: { entityType: "assistant_tool_calls", entityId: String(id) },
        error: e,
      })
  );
}
