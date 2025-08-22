import { handle } from "@/lib/api/route-factory";
import { assistantChatRepo, AssistantChatUpdateSchema } from "@/lib/repos/assistantChatRepo";
import type { AssistantChatUpdate } from "@/lib/repos/assistantChatRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => assistantChatRepo.find(id),
    (e: unknown) =>
      log.error("api.assistant_chats.get.failed", {
        message: "Failed to fetch assistantChat",
        subject: { entityType: "assistant_chats", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = AssistantChatUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as AssistantChatUpdate;
  return handle(
    () => assistantChatRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.assistant_chats.patch.failed", {
        message: "Failed to update assistantChat",
        subject: { entityType: "assistant_chats", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await assistantChatRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.assistant_chats.delete.failed", {
        message: "Failed to delete assistantChat",
        subject: { entityType: "assistant_chats", entityId: String(id) },
        error: e,
      })
  );
}
