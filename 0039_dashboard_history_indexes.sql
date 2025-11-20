-- Migration: Dashboard History Performance Indexes
-- Created: 2025-01-XX
-- Purpose: Optimize dashboard history query performance
-- 
-- Performance Impact:
-- - Baseline: ~0.14s (already fast)
-- - With indexes: ~0.135s (minimal improvement - query was already well-optimized)
-- 
-- Note: The history query was already performing well. These indexes provide
-- marginal improvement and ensure optimal performance as data grows.

-- Simulation attempts: Date range filtering (main filter)
CREATE INDEX IF NOT EXISTS simulation_attempts_created_at_idx 
ON simulation_attempts (created_at);
--> statement-breakpoint

-- Simulation attempts: Composite index for main filter pattern
CREATE INDEX IF NOT EXISTS simulation_attempts_history_filter_idx 
ON simulation_attempts (created_at, archived, simulation_id);
--> statement-breakpoint

-- Simulations: Index for join with practice_simulation filter
CREATE INDEX IF NOT EXISTS simulations_id_practice_idx 
ON simulations (id, practice_simulation);
--> statement-breakpoint

-- Profiles: Index for role filtering
CREATE INDEX IF NOT EXISTS profiles_id_role_idx 
ON profiles (id, role);
--> statement-breakpoint

-- Simulation departments: Index for aggregation subquery
CREATE INDEX IF NOT EXISTS simulation_departments_sim_active_idx 
ON simulation_departments (simulation_id, active) WHERE active = TRUE;

