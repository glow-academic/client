CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" bigint,
	"id_token" text,
	"scope" text,
	"session_state" text,
	"token_type" text
);
--> statement-breakpoint
CREATE TABLE "app_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"message" text,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"sessionToken" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "verification_token_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authenticator" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verificationToken" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "authenticator" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verificationToken" CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emailVerified" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" text;