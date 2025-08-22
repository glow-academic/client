import { handle } from "@/lib/api/route-factory";
import { assistantChatRepo } from "@/lib/repos/assistantChatRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => assistantChatRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.assistant_chats.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "assistant_chats" },
        context: { foreignKey: "profileId", id },
        error: e,
      })
  );
}
