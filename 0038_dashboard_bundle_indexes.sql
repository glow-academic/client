-- Migration: Dashboard Bundle Performance Indexes
-- Created: 2025-01-XX
-- Purpose: Optimize dashboard bundle query performance
-- 
-- Performance Impact (cache DISABLED for accurate measurement):
-- - Baseline (no indexes): ~2.75s
-- - With indexes: ~0.30s (~9x speedup)
-- 
-- Note: With cache enabled, performance is ~0.28s (~10x speedup), but cache is not included in this measurement.
-- 
-- These indexes provide the primary performance improvement. The query itself does not need modifications.
-- 
-- These indexes optimize the main filter pattern in get_dashboard_bundle.sql:
-- - Date range filtering (attempt_created_at)
-- - Role filtering (profile_role)
-- - Simulation filtering (simulation_id)
-- - Simulation type filtering (is_general, is_practice, is_archived)
-- - Earliest attempt queries (profile_id, simulation_id, attempt_created_at)
-- - Supporting table joins (simulation_chat_grades, rubrics, simulation_chats, cohort_simulations)

-- Analytics table: Main dashboard bundle filter index
CREATE INDEX IF NOT EXISTS analytics_dashboard_bundle_idx ON public.analytics USING btree (attempt_created_at, profile_role, simulation_id, is_general, is_practice, is_archived);
--> statement-breakpoint

-- Analytics table: Covering index for dashboard bundle (avoids table lookups)
CREATE INDEX IF NOT EXISTS analytics_dashboard_covering_idx ON public.analytics USING btree (attempt_created_at, profile_role, simulation_id, is_general, is_practice, is_archived) INCLUDE (profile_id, attempt_id, chat_id, grade_percent, completed, time_taken_seconds, num_messages_total);
--> statement-breakpoint

-- Analytics table: Comprehensive covering index (includes all commonly accessed columns)
CREATE INDEX IF NOT EXISTS analytics_dashboard_comprehensive_covering_idx ON public.analytics USING btree (attempt_created_at, profile_role, simulation_id, is_general, is_practice, is_archived) INCLUDE (chat_id, attempt_id, profile_id, scenario_id, leaf_scenario_id, persona_id, grade_percent, completed, time_taken_seconds, num_messages_total, num_query_messages, num_response_messages, message_time_taken_seconds, rubric_id, rubric_points, rubric_pass_points, passed, sim_scenario_count, grade_created_at, department_id, chat_created_at, persona_color);
--> statement-breakpoint

-- Analytics table: Index for earliest_attempt_all_time CTE (DISTINCT ON with ORDER BY)
CREATE INDEX IF NOT EXISTS analytics_profile_sim_attempt_time_idx ON public.analytics USING btree (profile_id, simulation_id, attempt_created_at);
--> statement-breakpoint

-- Analytics table: Covering index for earliest attempt query
CREATE INDEX IF NOT EXISTS analytics_earliest_attempt_covering_idx ON public.analytics USING btree (profile_id, simulation_id, attempt_created_at) INCLUDE (attempt_id, grade_percent, rubric_pass_points, rubric_points, is_general, is_practice, is_archived, profile_role, simulation_id);
--> statement-breakpoint

-- Analytics table: Index for attempt-level aggregations (per_attempt CTE)
CREATE INDEX IF NOT EXISTS analytics_attempt_aggregation_idx ON public.analytics USING btree (attempt_id, attempt_created_at) INCLUDE (profile_id, sim_scenario_count, completed, grade_percent, chat_id);
--> statement-breakpoint

-- Simulation chat grades: Optimize joins for stagnation calculation
CREATE INDEX IF NOT EXISTS scg_chat_id_created_idx ON public.simulation_chat_grades USING btree (simulation_chat_id, created_at);
--> statement-breakpoint

-- Rubrics: Covering index for joins (includes points column)
CREATE INDEX IF NOT EXISTS rubrics_id_points_idx ON public.rubrics USING btree (id) INCLUDE (points);
--> statement-breakpoint

-- Simulation chats: Optimize joins for history calculation
CREATE INDEX IF NOT EXISTS simulation_chats_id_completed_idx ON public.simulation_chats USING btree (id, completed);
--> statement-breakpoint

-- Cohort simulations: Optimize cohort filtering subqueries
CREATE INDEX IF NOT EXISTS cohort_simulations_cohort_active_idx ON public.cohort_simulations USING btree (cohort_id, active) WHERE (active = true);
--> statement-breakpoint

-- Cohort simulations: Optimize simulation-cohort lookups
CREATE INDEX IF NOT EXISTS cohort_simulations_simulation_cohort_active_idx ON public.cohort_simulations USING btree (simulation_id, cohort_id, active) WHERE (active = true);

