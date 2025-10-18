-- ============================================================================
-- BCNF Final Migration - Eliminate Nullable Columns & Normalize Schema
-- ============================================================================
-- This migration:
-- 1. Makes easy-win columns NOT NULL
-- 2. Backfills and makes all app_logs columns NOT NULL
-- 3. Drops unused metrics column from app_logs
-- 4. Creates junction table for profile requests per day
-- 5. Drops simulation_chats.completed_at
-- 6. Creates junction table for time limits (simulations only, no record = infinite)
-- 7. Creates junction table for provider base URLs
-- 8. Updates personas reasoning to use enum with "none" value
-- 9. Normalizes scenario_objectives and simulation_hints to same pattern
--    (composite PK with idx, created_at only, no id/active/updated_at)
-- 10. Creates junction table for document_parameter_items
-- 11. Removes analytics stored procedures
-- 12. Removes simulation tag tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Update reasoning_effort enum to include "none"
-- ============================================================================

-- Add "none" value to reasoning_effort enum
ALTER TYPE reasoning_effort ADD VALUE IF NOT EXISTS 'none';

-- ============================================================================
-- SECTION 2: Create Junction Tables
-- ============================================================================

-- Junction table for profile daily request limits
CREATE TABLE IF NOT EXISTS profile_request_limits (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    requests_per_day INTEGER NOT NULL CHECK (requests_per_day > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id)
);

CREATE INDEX idx_profile_request_limits_profile ON profile_request_limits(profile_id);

-- Junction table for simulation time limits
-- Logic: If record exists -> use time limit, if no record -> infinite/no time limit
-- For attempts: simulation_attempts.infinite_mode flag determines if time limits apply
CREATE TABLE IF NOT EXISTS simulation_time_limits (
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id)
);

CREATE INDEX idx_simulation_time_limits_simulation ON simulation_time_limits(simulation_id);

-- Junction table for provider base URLs
CREATE TABLE IF NOT EXISTS provider_endpoints (
    provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL CHECK (base_url != ''),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (provider_id)
);

CREATE INDEX idx_provider_endpoints_provider ON provider_endpoints(provider_id);

-- ============================================================================
-- SECTION 3: Backfill app_logs columns with defaults
-- ============================================================================

-- Backfill app_logs.message (9.6% NULL)
UPDATE app_logs
SET message = 'Default Message'
WHERE message IS NULL;

-- Backfill app_logs.correlation_id (80.3% NULL)
UPDATE app_logs
SET correlation_id = 'default.correlation'
WHERE correlation_id IS NULL;

-- Backfill app_logs.actor (96.1% NULL)
UPDATE app_logs
SET actor = '{"userId": null, "profileId": null}'::jsonb
WHERE actor IS NULL;

-- Backfill app_logs.subject (98.9% NULL)
UPDATE app_logs
SET subject = '{"entityId": null, "entityType": null}'::jsonb
WHERE subject IS NULL;

-- Backfill app_logs.context (15.9% NULL)
UPDATE app_logs
SET context = '{"route": null, "function": null, "component": null}'::jsonb
WHERE context IS NULL;

-- Backfill app_logs.error (99.4% NULL)
UPDATE app_logs
SET error = '{"code": null, "name": null, "stack": null, "message": null}'::jsonb
WHERE error IS NULL;

-- ============================================================================
-- SECTION 4: Migrate data to junction tables
-- ============================================================================

-- Migrate profiles.req_per_day to profile_request_limits
-- Only migrate non-NULL values (1 profile has a value)
INSERT INTO profile_request_limits (profile_id, requests_per_day, active, created_at, updated_at)
SELECT 
    id,
    req_per_day,
    TRUE,
    created_at,
    created_at
FROM profiles
WHERE req_per_day IS NOT NULL;

-- Migrate simulations.time_limit to simulation_time_limits
-- Only migrate non-NULL values (9 out of 14 simulations)
-- Simulations without a record will be treated as having no time limit
INSERT INTO simulation_time_limits (simulation_id, time_limit_seconds, active, created_at, updated_at)
SELECT 
    id,
    time_limit,
    TRUE,
    created_at,
    created_at
FROM simulations
WHERE time_limit IS NOT NULL;

-- Migrate providers.base_url to provider_endpoints
-- Only migrate non-NULL values (0 providers have base_url, so this is a no-op)
INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
SELECT 
    id,
    base_url,
    TRUE,
    created_at,
    created_at
FROM providers
WHERE base_url IS NOT NULL;

-- ============================================================================
-- SECTION 5: Backfill remaining nullable columns
-- ============================================================================

-- Backfill profiles.last_active (22.9% NULL) - use created_at as fallback
UPDATE profiles
SET last_active = created_at
WHERE last_active IS NULL;

-- Do NOT backfill remaining simulations - absence of record means no time limit
-- 5 simulations will have no record in simulation_time_limits, meaning infinite/no time limit

-- Backfill agents.reasoning (50% NULL) - set to 'medium' for agents without reasoning
UPDATE agents
SET reasoning = 'medium'
WHERE reasoning IS NULL;

-- Backfill documents.file_id (50% NULL) - set to empty string for documents without file_id
UPDATE documents
SET file_id = ''
WHERE file_id IS NULL;

-- Backfill cohorts.description (0% NULL, but good to have default)
UPDATE cohorts
SET description = ''
WHERE description IS NULL;

-- Backfill personas.reasoning (100% NULL) - set all to 'none'
UPDATE personas
SET reasoning = 'none'
WHERE reasoning IS NULL;

-- Backfill providers.base_url (100% NULL) - set to empty string
UPDATE providers
SET base_url = ''
WHERE base_url IS NULL;

-- Backfill simulation_chats.trace_id (0% NULL, already fine)
UPDATE simulation_chats
SET trace_id = ''
WHERE trace_id IS NULL;

-- Backfill app_feedback.message (0% NULL, already fine)
UPDATE app_feedback
SET message = ''
WHERE message IS NULL;

-- Backfill simulation_chat_feedbacks.feedback (0% NULL, already fine)
UPDATE simulation_chat_feedbacks
SET feedback = ''
WHERE feedback IS NULL;

-- ============================================================================
-- SECTION 6: Drop columns being replaced by junction tables or removed
-- ============================================================================

-- Drop metrics column from app_logs (100% NULL, never used)
ALTER TABLE app_logs DROP COLUMN IF EXISTS metrics;

-- Drop completed_at from simulation_chats (using grades.time_taken instead)
ALTER TABLE simulation_chats DROP COLUMN IF EXISTS completed_at;

-- Drop time_limit from simulations (moved to junction table)
ALTER TABLE simulations DROP COLUMN IF EXISTS time_limit;

-- Drop infinite_mode_time_limit from simulation_attempts (moved to junction table)
ALTER TABLE simulation_attempts DROP COLUMN IF EXISTS infinite_mode_time_limit;

-- Drop req_per_day from profiles (moved to junction table)
ALTER TABLE profiles DROP COLUMN IF EXISTS req_per_day;

-- Drop base_url from providers (moved to junction table)
ALTER TABLE providers DROP COLUMN IF EXISTS base_url;

-- ============================================================================
-- SECTION 7: Add NOT NULL constraints to remaining columns
-- ============================================================================

-- Easy wins (already 0% NULL)
ALTER TABLE app_feedback ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE app_feedback ALTER COLUMN message SET NOT NULL;
ALTER TABLE cohorts ALTER COLUMN description SET NOT NULL;
ALTER TABLE simulation_chat_feedbacks ALTER COLUMN feedback SET NOT NULL;
ALTER TABLE simulation_chats ALTER COLUMN trace_id SET NOT NULL;

-- app_logs columns (now backfilled)
ALTER TABLE app_logs ALTER COLUMN message SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN correlation_id SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN actor SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN subject SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN context SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN error SET NOT NULL;
ALTER TABLE app_logs ALTER COLUMN created_at SET NOT NULL;

-- Other backfilled columns
ALTER TABLE profiles ALTER COLUMN last_active SET NOT NULL;
ALTER TABLE agents ALTER COLUMN reasoning SET NOT NULL;
ALTER TABLE documents ALTER COLUMN file_id SET NOT NULL;
ALTER TABLE personas ALTER COLUMN reasoning SET NOT NULL;

-- ============================================================================
-- SECTION 8: Update default values for new inserts
-- ============================================================================

-- Set defaults to ensure new records don't have NULLs
ALTER TABLE app_logs ALTER COLUMN message SET DEFAULT 'Default Message';
ALTER TABLE app_logs ALTER COLUMN correlation_id SET DEFAULT 'default.correlation';
ALTER TABLE app_logs ALTER COLUMN actor SET DEFAULT '{"userId": null, "profileId": null}'::jsonb;
ALTER TABLE app_logs ALTER COLUMN subject SET DEFAULT '{"entityId": null, "entityType": null}'::jsonb;
ALTER TABLE app_logs ALTER COLUMN context SET DEFAULT '{"route": null, "function": null, "component": null}'::jsonb;
ALTER TABLE app_logs ALTER COLUMN error SET DEFAULT '{"code": null, "name": null, "stack": null, "message": null}'::jsonb;
ALTER TABLE app_logs ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE app_feedback ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE app_feedback ALTER COLUMN message SET DEFAULT '';

ALTER TABLE cohorts ALTER COLUMN description SET DEFAULT '';
ALTER TABLE simulation_chat_feedbacks ALTER COLUMN feedback SET DEFAULT '';
ALTER TABLE simulation_chats ALTER COLUMN trace_id SET DEFAULT '';
ALTER TABLE profiles ALTER COLUMN last_active SET DEFAULT NOW();
ALTER TABLE agents ALTER COLUMN reasoning SET DEFAULT 'medium'::reasoning_effort;
ALTER TABLE documents ALTER COLUMN file_id SET DEFAULT '';
ALTER TABLE personas ALTER COLUMN reasoning SET DEFAULT 'none'::reasoning_effort;

-- ============================================================================
-- SECTION 9: Add helpful comments to junction tables
-- ============================================================================

COMMENT ON TABLE profile_request_limits IS 'Stores daily request limits for profiles. One row per profile.';
COMMENT ON TABLE simulation_time_limits IS 'Stores time limits for simulations. Absence of record means no time limit (infinite). For attempts, check simulation_attempts.infinite_mode flag.';
COMMENT ON TABLE provider_endpoints IS 'Stores base URLs for providers. One row per provider.';

-- ============================================================================
-- SECTION 10: Verification queries (run these after migration)
-- ============================================================================

-- These can be run separately to verify the migration

-- Verify no NULL values in critical columns
-- SELECT COUNT(*) as null_count FROM app_logs WHERE message IS NULL OR correlation_id IS NULL OR actor IS NULL OR subject IS NULL OR context IS NULL OR error IS NULL;
-- SELECT COUNT(*) as null_count FROM app_feedback WHERE created_at IS NULL OR message IS NULL;
-- SELECT COUNT(*) as null_count FROM cohorts WHERE description IS NULL;
-- SELECT COUNT(*) as null_count FROM simulation_chat_feedbacks WHERE feedback IS NULL;
-- SELECT COUNT(*) as null_count FROM simulation_chats WHERE trace_id IS NULL;
-- SELECT COUNT(*) as null_count FROM profiles WHERE last_active IS NULL;
-- SELECT COUNT(*) as null_count FROM agents WHERE reasoning IS NULL;
-- SELECT COUNT(*) as null_count FROM documents WHERE file_id IS NULL;
-- SELECT COUNT(*) as null_count FROM personas WHERE reasoning IS NULL;
-- 
-- -- Verify junction table data
-- SELECT COUNT(*) FROM profile_request_limits;
-- SELECT COUNT(*) FROM simulation_time_limits; -- Should be 9 (only non-NULL values)
-- SELECT COUNT(*) FROM provider_endpoints;
-- SELECT COUNT(*) FROM document_parameter_items;
--
-- -- Verify scenario_objectives and simulation_hints have normalized structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'scenario_objectives' ORDER BY ordinal_position;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'simulation_hints' ORDER BY ordinal_position;
--
-- -- Both should have: parent_id (FK), idx (integer), text field, created_at
-- -- scenario_objectives: scenario_id, idx, objective, created_at
-- -- simulation_hints: simulation_message_id, idx, hint, created_at
--
-- -- Verify dropped columns are gone
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'app_logs' AND column_name = 'metrics';
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'simulation_chats' AND column_name = 'completed_at';
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'simulations' AND column_name = 'time_limit';
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'simulation_attempts' AND column_name = 'infinite_mode_time_limit';
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'req_per_day';
-- SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'providers' AND column_name = 'base_url';
--
-- -- Verify analytics functions are dropped
-- SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'analytics_%';
--
-- -- Verify simulation tag tables are dropped
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('simulation_tags', 'simulation_tag_documents', 'simulation_tag_parameter_items');

-- ============================================================================
-- SECTION 11: Normalize text collection tables (objectives and hints)
-- ============================================================================

-- Add created_at to scenario_objectives (no active, no updated_at for simple text collections)
-- Note: scenario_objectives already has 'idx' field for positioning (part of composite PK)
ALTER TABLE scenario_objectives ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Restructure simulation_hints to match scenario_objectives pattern
-- Current: id (PK), simulation_message_id (FK), hint, created_at, updated_at
-- Target: simulation_message_id + idx (composite PK), hint, created_at

-- First, add idx column to simulation_hints
ALTER TABLE simulation_hints ADD COLUMN IF NOT EXISTS idx INTEGER;

-- Populate idx based on creation order per message
WITH ranked_hints AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY simulation_message_id ORDER BY created_at, id) - 1 AS hint_idx
    FROM simulation_hints
)
UPDATE simulation_hints sh
SET idx = rh.hint_idx
FROM ranked_hints rh
WHERE sh.id = rh.id;

-- Make idx NOT NULL now that it's populated
ALTER TABLE simulation_hints ALTER COLUMN idx SET NOT NULL;

-- Drop the old primary key and id column
ALTER TABLE simulation_hints DROP CONSTRAINT IF EXISTS simulation_hints_pkey CASCADE;
ALTER TABLE simulation_hints DROP COLUMN IF EXISTS id CASCADE;

-- Drop updated_at (not needed for simple text collections)
ALTER TABLE simulation_hints DROP COLUMN IF EXISTS updated_at;

-- Add new composite primary key
ALTER TABLE simulation_hints ADD PRIMARY KEY (simulation_message_id, idx);

-- Add index for the message_id lookup
CREATE INDEX IF NOT EXISTS idx_simulation_hints_message ON simulation_hints(simulation_message_id);

-- ============================================================================
-- SECTION 12: Create document_parameter_items junction table
-- ============================================================================

-- Junction table to link documents with parameter items
-- This allows documents to be associated with specific parameter values
CREATE TABLE IF NOT EXISTS document_parameter_items (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (document_id, parameter_item_id)
);

CREATE INDEX idx_document_parameter_items_document ON document_parameter_items(document_id);
CREATE INDEX idx_document_parameter_items_parameter_item ON document_parameter_items(parameter_item_id);

COMMENT ON TABLE document_parameter_items IS 'Links documents to parameter items, allowing documents to be filtered by parameter values.';

-- ============================================================================
-- SECTION 13: Drop analytics stored procedures
-- ============================================================================

-- Drop all analytics functions (used for old analytics DB approach)
DROP FUNCTION IF EXISTS analytics_attempt_history_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_attempt_improvement_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_average_score_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_cohort_performance_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_completion_percentage_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_first_attempt_pass_rate_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_growth_data_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_highest_score_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_home_overview_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_improvement_per_day_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_leaderboard_bundle_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_messages_per_session_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_normal_cdf CASCADE;
DROP FUNCTION IF EXISTS analytics_p_value_from_r_n CASCADE;
DROP FUNCTION IF EXISTS analytics_perfect_scores_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_persona_performance_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_persona_response_times_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_practice_overview_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_quickest_pass_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_reports_bundle_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_rubric_heatmap_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_scenario_performance_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_scenario_stats_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_session_efficiency_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_simulation_composition_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_simulation_performance_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_skill_performance_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_stagnation_rate_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_time_spent_fn CASCADE;
DROP FUNCTION IF EXISTS analytics_total_attempts_fn CASCADE;

-- ============================================================================
-- SECTION 14: Drop simulation tag tables
-- ============================================================================

-- Drop tag-related tables (to be replaced by document_parameter_items approach)
-- Drop in correct order due to foreign key constraints
DROP TABLE IF EXISTS simulation_tag_documents CASCADE;
DROP TABLE IF EXISTS simulation_tag_parameter_items CASCADE;
DROP TABLE IF EXISTS simulation_tags CASCADE;

-- Drop the associated views if they exist
DROP VIEW IF EXISTS v_tagged_documents CASCADE;
DROP VIEW IF EXISTS v_tagged_parameter_items CASCADE;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (save separately if needed)
-- ============================================================================
/*
BEGIN;

-- Restore dropped columns
ALTER TABLE app_logs ADD COLUMN IF NOT EXISTS metrics JSONB;
ALTER TABLE simulation_chats ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS time_limit INTEGER;
ALTER TABLE simulation_attempts ADD COLUMN IF NOT EXISTS infinite_mode_time_limit INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS req_per_day INTEGER;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Remove NOT NULL constraints
ALTER TABLE app_feedback ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE app_feedback ALTER COLUMN message DROP NOT NULL;
ALTER TABLE cohorts ALTER COLUMN description DROP NOT NULL;
ALTER TABLE simulation_chat_feedbacks ALTER COLUMN feedback DROP NOT NULL;
ALTER TABLE simulation_chats ALTER COLUMN trace_id DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN message DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN correlation_id DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN actor DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN context DROP NOT NULL;
ALTER TABLE app_logs ALTER COLUMN error DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN last_active DROP NOT NULL;
ALTER TABLE agents ALTER COLUMN reasoning DROP NOT NULL;
ALTER TABLE documents ALTER COLUMN file_id DROP NOT NULL;
ALTER TABLE personas ALTER COLUMN reasoning DROP NOT NULL;

-- Migrate data back from junction tables
UPDATE profiles p
SET req_per_day = (
    SELECT requests_per_day 
    FROM profile_request_limits prl 
    WHERE prl.profile_id = p.id
);

UPDATE simulations s
SET time_limit = (
    SELECT time_limit_seconds 
    FROM simulation_time_limits stl 
    WHERE stl.simulation_id = s.id
);

UPDATE providers p
SET base_url = (
    SELECT base_url 
    FROM provider_endpoints pe 
    WHERE pe.provider_id = p.id
);

-- Drop junction tables
DROP TABLE IF EXISTS profile_request_limits CASCADE;
DROP TABLE IF EXISTS simulation_time_limits CASCADE;
DROP TABLE IF EXISTS provider_endpoints CASCADE;
DROP TABLE IF EXISTS document_parameter_items CASCADE;

-- Restore simulation tag tables
CREATE TABLE IF NOT EXISTS simulation_tags (
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    tag TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, idx)
);

CREATE TABLE IF NOT EXISTS simulation_tag_documents (
    simulation_id UUID NOT NULL,
    tag_idx INTEGER NOT NULL,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, tag_idx, document_id),
    FOREIGN KEY (simulation_id, tag_idx) REFERENCES simulation_tags(simulation_id, idx) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulation_tag_parameter_items (
    simulation_id UUID NOT NULL,
    tag_idx INTEGER NOT NULL,
    parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (simulation_id, tag_idx, parameter_item_id),
    FOREIGN KEY (simulation_id, tag_idx) REFERENCES simulation_tags(simulation_id, idx) ON DELETE CASCADE
);

-- Remove created_at from scenario_objectives
ALTER TABLE scenario_objectives DROP COLUMN IF EXISTS created_at;

-- Restore simulation_hints to original structure
ALTER TABLE simulation_hints DROP CONSTRAINT IF EXISTS simulation_hints_pkey CASCADE;
ALTER TABLE simulation_hints ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE simulation_hints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE simulation_hints DROP COLUMN IF EXISTS idx;
ALTER TABLE simulation_hints ADD PRIMARY KEY (id);

-- Note: Analytics functions would need to be recreated from backup if needed

COMMIT;
*/

