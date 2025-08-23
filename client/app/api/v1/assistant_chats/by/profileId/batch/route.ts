import { handle } from "@/lib/api/route-factory";
import { assistantChatRepo } from "@/lib/repos/assistantChatRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => assistantChatRepo.listByProfiles(parsed.data.ids),
    (e: unknown) =>
      log.error("api.assistant_chats.by.profileId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "assistant_chats" },
        context: { foreignKey: "profileId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
