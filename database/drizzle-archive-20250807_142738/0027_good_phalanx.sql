CREATE TYPE "public"."locations" AS ENUM('lawson', 'haas', 'dsai');--> statement-breakpoint
CREATE TYPE "public"."time_of_day" AS ENUM('9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM');--> statement-breakpoint
CREATE TYPE "public"."urgency_type" AS ENUM('hour', 'day', 'days');--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "location" "locations";--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "tod" time_of_day;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "urgency" "urgency_type";