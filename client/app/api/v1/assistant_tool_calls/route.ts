import { handle } from "@/lib/api/route-factory";
import type { AssistantToolCallCreate } from "@/lib/repos/assistantToolCallRepo";
import {
  AssistantToolCallCreateSchema,
  assistantToolCallRepo,
} from "@/lib/repos/assistantToolCallRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => assistantToolCallRepo.list(),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.list.failed", {
        message: "Failed to list assistant_tool_calls",
        subject: { entityType: "assistant_tool_calls" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = AssistantToolCallCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as AssistantToolCallCreate;
  return handle(
    () => assistantToolCallRepo.create(payload),
    (e: unknown) =>
      log.error("api.assistant_tool_calls.create.failed", {
        message: "Failed to create assistantToolCall",
        subject: { entityType: "assistant_tool_calls" },
        context: { body: json },
        error: e,
      }),
  );
}
