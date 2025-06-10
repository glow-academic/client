ALTER TABLE "eval_chat_rubrics" RENAME TO "eval_chat_grades";--> statement-breakpoint
ALTER TABLE "simulation_chat_rubrics" RENAME TO "simulation_chat_grades";--> statement-breakpoint
ALTER TABLE "eval_chat_standards" RENAME COLUMN "eval_chat_rubric_id" TO "eval_chat_grade_id";--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" RENAME COLUMN "simulation_chat_rubric_id" TO "simulation_chat_grade_id";--> statement-breakpoint
ALTER TABLE "eval_chat_grades" DROP CONSTRAINT "eval_chat_rubrics_rubric_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_grades" DROP CONSTRAINT "eval_chat_rubrics_eval_chat_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_standards" DROP CONSTRAINT "eval_chat_standards_eval_chat_rubric_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" DROP CONSTRAINT "simulation_chat_rubrics_rubric_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" DROP CONSTRAINT "simulation_chat_rubrics_simulation_chat_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" DROP CONSTRAINT "simulation_chat_standards_simulation_chat_rubric_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_grades" ADD CONSTRAINT "eval_chat_grades_eval_chat_id_fkey" FOREIGN KEY ("eval_chat_id") REFERENCES "public"."eval_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_standards" ADD CONSTRAINT "eval_chat_standards_eval_chat_grade_id_fkey" FOREIGN KEY ("eval_chat_grade_id") REFERENCES "public"."eval_chat_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" ADD CONSTRAINT "simulation_chat_grades_simulation_chat_id_fkey" FOREIGN KEY ("simulation_chat_id") REFERENCES "public"."simulation_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" ADD CONSTRAINT "simulation_chat_standards_simulation_chat_grade_id_fkey" FOREIGN KEY ("simulation_chat_grade_id") REFERENCES "public"."simulation_chat_grades"("id") ON DELETE cascade ON UPDATE no action;