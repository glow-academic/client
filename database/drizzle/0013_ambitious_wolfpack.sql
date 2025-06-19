CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"file_name" text NOT NULL,
	"layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_component" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile_id" uuid,
	"header_component_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"primary_component_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"secondary_component_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"footer_component_ids" uuid[] DEFAULT '{"RAY"}' NOT NULL,
	"auto_scroll" boolean DEFAULT false NOT NULL,
	"show_indicators" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;