import { handle } from "@/lib/api/route-factory";
import type { AssistantMessageCreate } from "@/lib/repos/assistantMessageRepo";
import {
  AssistantMessageCreateSchema,
  assistantMessageRepo,
} from "@/lib/repos/assistantMessageRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => assistantMessageRepo.list(),
    (e: unknown) =>
      log.error("api.assistant_messages.list.failed", {
        message: "Failed to list assistant_messages",
        subject: { entityType: "assistant_messages" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AssistantMessageCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AssistantMessageCreate;
  return handle(
    () => assistantMessageRepo.create(payload),
    (e: unknown) =>
      log.error("api.assistant_messages.create.failed", {
        message: "Failed to create assistantMessage",
        subject: { entityType: "assistant_messages" },
        context: { body: json },
        error: e,
      }),
  );
}
