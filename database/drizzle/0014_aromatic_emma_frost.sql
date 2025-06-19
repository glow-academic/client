ALTER TABLE "dashboards" ADD COLUMN "header_components" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboards" ADD COLUMN "main_split" double precision DEFAULT 0.75 NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboards" ADD COLUMN "footer_split" double precision DEFAULT 0.5 NOT NULL;