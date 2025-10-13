import { handle } from "@/lib/api/route-factory";
import type { AssistantChatCreate } from "@/lib/repos/assistantChatRepo";
import {
  AssistantChatCreateSchema,
  assistantChatRepo,
} from "@/lib/repos/assistantChatRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => assistantChatRepo.list(),
    (e: unknown) =>
      log.error("api.assistant_chats.list.failed", {
        message: "Failed to list assistant_chats",
        subject: { entityType: "assistant_chats" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AssistantChatCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AssistantChatCreate;
  return handle(
    () => assistantChatRepo.create(payload),
    (e: unknown) =>
      log.error("api.assistant_chats.create.failed", {
        message: "Failed to create assistantChat",
        subject: { entityType: "assistant_chats" },
        context: { body: json },
        error: e,
      }),
  );
}
