-- ============================================================================
-- Finalize Junction Table Migration - Drop Legacy FK Columns
-- ============================================================================
-- This migration finalizes the junction table migration by dropping the old
-- foreign key columns that have been replaced by junction tables.
--
-- Prerequisites:
-- 1. harden_fks_and_junctions_migration.sql has been applied
-- 2. Junction tables are populated with data
-- 3. Application code has been updated to use junction tables
-- 4. Analytics materialized view has been updated to use junction tables
--
-- This migration is SAFE to run because:
-- - All data is preserved in junction tables
-- - Analytics view already uses junction tables (not the old columns)
-- - Server code already uses junction tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop Analytics View (will be recreated with correct schema)
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS analytics CASCADE;

-- ============================================================================
-- Step 2: Drop Legacy Foreign Key Columns
-- ============================================================================

-- 1. simulation_attempts.profile_id → attempt_profiles junction
ALTER TABLE simulation_attempts
  DROP COLUMN IF EXISTS profile_id;

-- 2. profiles.user_id → user_profiles junction
ALTER TABLE profiles
  DROP COLUMN IF EXISTS user_id;

-- 3. scenarios.persona_id → scenario_personas junction
ALTER TABLE scenarios
  DROP COLUMN IF EXISTS persona_id;

-- 4. app_feedback.profile_id → app_feedback_profiles junction
ALTER TABLE app_feedback
  DROP COLUMN IF EXISTS profile_id;

-- 5. model_runs foreign keys → respective junctions
ALTER TABLE model_runs
  DROP COLUMN IF EXISTS model_id,
  DROP COLUMN IF EXISTS persona_id,
  DROP COLUMN IF EXISTS agent_id,
  DROP COLUMN IF EXISTS profile_id;

COMMIT;

-- ============================================================================
-- Step 3: Recreate Analytics View (from database/app/analytics/init.sql)
-- ============================================================================
-- Run: psql -h localhost -p 5432 -U myuser -d mydb < database/app/analytics/init.sql
-- Then: REFRESH MATERIALIZED VIEW analytics;
-- ============================================================================

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- What this achieves:
-- - Clean BCNF schema with all relationships in junction tables
-- - No nullable foreign keys in core tables
-- - All optionality expressed through junction table presence
-- - Temporal state (active, timestamps) for all relationships
-- ============================================================================

