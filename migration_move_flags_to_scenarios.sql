-- Migration: Move flags from simulations to scenarios, add profile_activity table, add document_parameter
-- This migration:
-- 1. Adds 5 boolean flags to scenarios table
-- 2. Backfills flags from simulations via simulation_scenarios junction
-- 3. Creates profile_activity junction table for activity tracking
-- 4. Adds document_parameter to parameters table
-- 5. Removes flags from simulations table

BEGIN;

-- ============================================================================
-- PART 1: Add flags to scenarios table
-- ============================================================================

ALTER TABLE scenarios
  ADD COLUMN hints_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN image_input_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN input_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN output_guardrail_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- PART 2: Backfill flags from simulations to scenarios
-- ============================================================================

-- For each scenario, use the most common value from linked simulations
-- If scenario has no linked simulations, use defaults (FALSE for most, TRUE for objectives_enabled)
-- Note: PostgreSQL doesn't have mode() function, so we use a subquery with COUNT and ORDER BY
UPDATE scenarios s
SET 
  hints_enabled = COALESCE((
    SELECT sim.hints_enabled
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.hints_enabled
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  objectives_enabled = COALESCE((
    SELECT sim.objectives_enabled
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.objectives_enabled
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), TRUE),
  image_input_enabled = COALESCE((
    SELECT sim.image_input_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.image_input_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  input_guardrail_enabled = COALESCE((
    SELECT sim.input_guardrail_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.input_guardrail_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE),
  output_guardrail_enabled = COALESCE((
    SELECT sim.output_guardrail_active
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE ss.scenario_id = s.id AND ss.active = true
    GROUP BY sim.output_guardrail_active
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ), FALSE);

-- ============================================================================
-- PART 3: Create profile_activity junction table
-- ============================================================================

CREATE TABLE profile_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON profile_activity (profile_id);
CREATE INDEX ON profile_activity (profile_id, last_active);
CREATE INDEX ON profile_activity (created_at);

-- Backfill: Insert one row per profile with current last_active value
INSERT INTO profile_activity (profile_id, last_active, created_at)
SELECT id, last_active, created_at
FROM profiles
WHERE last_active IS NOT NULL;

-- ============================================================================
-- PART 4: Add document_parameter to parameters table
-- ============================================================================

ALTER TABLE parameters
  ADD COLUMN document_parameter BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- PART 5: Remove flags from simulations table
-- ============================================================================

ALTER TABLE simulations
  DROP COLUMN hints_enabled,
  DROP COLUMN objectives_enabled,
  DROP COLUMN image_input_active,
  DROP COLUMN input_guardrail_active,
  DROP COLUMN output_guardrail_active;

COMMIT;

