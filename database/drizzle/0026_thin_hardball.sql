ALTER TABLE "assistant_chats" ALTER COLUMN "trace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_messages" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" DROP COLUMN "completed_at";