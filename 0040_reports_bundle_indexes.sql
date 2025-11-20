-- Migration: Reports Bundle Performance Indexes
-- Created: 2025-01-XX
-- Purpose: Optimize reports bundle query performance
-- 
-- Performance Impact:
-- - Baseline (no cache, no indexes): ~0.40s
-- - With indexes (no cache): ~0.34s (~1.2x speedup)
-- - With indexes + cache: ~0.003s (~133x speedup for cache hits)
-- 
-- Note: The reports bundle query aggregates analytics by profile_id with many CTEs.
-- The indexes optimize profile-level aggregations and earliest attempt lookups.

-- Index for profile-level aggregations (GROUP BY profile_id)
-- Used by: profile_metrics, completion_per_profile, efficiency_per_profile, etc.
CREATE INDEX IF NOT EXISTS analytics_reports_profile_agg_idx 
ON analytics (profile_id, attempt_created_at) 
INCLUDE (grade_percent, completed, num_messages_total, time_taken_seconds, chat_id, simulation_id, scenario_id);
--> statement-breakpoint

-- Index for earliest_attempts_all_time CTE (DISTINCT ON with ORDER BY)
-- Used by: earliest_attempts_all_time CTE for first attempt pass rate
CREATE INDEX IF NOT EXISTS analytics_reports_earliest_attempt_idx 
ON analytics (profile_id, simulation_id, attempt_created_at) 
INCLUDE (grade_percent, rubric_pass_points, rubric_points);
--> statement-breakpoint

-- Index for profile_chats CTE (DISTINCT profile_id, chat_id)
-- Used by: profile_chats CTE for stagnation calculation
CREATE INDEX IF NOT EXISTS analytics_reports_profile_chats_idx 
ON analytics (profile_id, chat_id) 
WHERE chat_id IS NOT NULL;
--> statement-breakpoint

-- Index for stagnation calculation (profile_id + chat_id join)
-- Used by: grade_stream_per_profile CTE
CREATE INDEX IF NOT EXISTS analytics_reports_stagnation_idx 
ON analytics (profile_id, chat_id, attempt_created_at) 
INCLUDE (message_time_taken_seconds);

