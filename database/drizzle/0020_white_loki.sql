CREATE TYPE "public"."reasoning_effort" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "reasoning" "reasoning_effort";