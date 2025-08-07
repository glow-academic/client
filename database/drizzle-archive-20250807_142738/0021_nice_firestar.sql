ALTER TABLE "assistant_tool_calls" DROP CONSTRAINT "assistant_tool_calls_message_id_fkey";
--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" DROP COLUMN "message_id";