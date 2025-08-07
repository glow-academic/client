CREATE TYPE "public"."assistant_message_type" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."assistant_tool_type" AS ENUM('create', 'read', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "assistant_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"profile_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" "assistant_message_type" NOT NULL,
	"content" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_tool_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"chat_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"tool_type" "assistant_tool_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_chats" ADD CONSTRAINT "assistant_chats_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."assistant_chats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE no action ON UPDATE no action;