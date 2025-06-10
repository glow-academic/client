ALTER TABLE "eval_chat_standards" RENAME TO "eval_chat_feedbacks";--> statement-breakpoint
ALTER TABLE "simulation_chat_standards" RENAME TO "simulation_chat_feedbacks";--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" DROP CONSTRAINT "eval_chat_standards_standard_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" DROP CONSTRAINT "eval_chat_standards_eval_chat_grade_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" DROP CONSTRAINT "simulation_chat_standards_standard_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" DROP CONSTRAINT "simulation_chat_standards_simulation_chat_grade_id_fkey";
--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_chat_feedbacks" ADD CONSTRAINT "eval_chat_feedbacks_eval_chat_grade_id_fkey" FOREIGN KEY ("eval_chat_grade_id") REFERENCES "public"."eval_chat_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ADD CONSTRAINT "simulation_chat_feedbacks_simulation_chat_grade_id_fkey" FOREIGN KEY ("simulation_chat_grade_id") REFERENCES "public"."simulation_chat_grades"("id") ON DELETE cascade ON UPDATE no action;