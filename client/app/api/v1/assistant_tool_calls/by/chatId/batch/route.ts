import { handle } from "@/lib/api/route-factory";
import { assistantToolCallRepo } from "@/lib/repos/assistantToolCallRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => assistantToolCallRepo.listByAssistantChats(parsed.data.ids),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.by.chatId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "assistant_tool_calls" },
        context: { foreignKey: "chatId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
