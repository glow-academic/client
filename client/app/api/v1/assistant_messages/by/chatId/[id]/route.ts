import { handle } from "@/lib/api/route-factory";
import { assistantMessageRepo } from "@/lib/repos/assistantMessageRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => assistantMessageRepo.listByAssistantChat(id),
    (e: unknown) =>
      log.error("api.assistant_messages.by.chatId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "assistant_messages" },
        context: { foreignKey: "chatId", id },
        error: e,
      })
  );
}
