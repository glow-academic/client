import { handle } from "@/lib/api/route-factory";
import { assistantToolCallRepo } from "@/lib/repos/assistantToolCallRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => assistantToolCallRepo.listByAssistantChat(id),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.by.chatId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "assistant_tool_calls" },
        context: { foreignKey: "chatId", id },
        error: e,
      }),
  );
}
