-- Schema Updates Migration
-- Adds new boolean columns to departments, agents, and simulations tables
-- Backfills agents and simulations with TRUE values
-- Populates cohort_profiles for admin, instructional, and superadmin users

-- ============================================================================
-- 1. DEPARTMENTS: Add default_department column
-- ============================================================================

ALTER TABLE departments
ADD COLUMN default_department BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. AGENTS: Add active and default_agent columns with backfill
-- ============================================================================

ALTER TABLE agents
ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE agents
ADD COLUMN default_agent BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill all existing agents to TRUE (defaults handle this, but explicit for clarity)
UPDATE agents
SET active = TRUE, default_agent = TRUE
WHERE active IS NULL OR default_agent IS NULL;

-- ============================================================================
-- 3. SIMULATIONS: Add objectives_enabled column with backfill
-- ============================================================================

ALTER TABLE simulations
ADD COLUMN objectives_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill all existing simulations to TRUE (defaults handle this, but explicit for clarity)
UPDATE simulations
SET objectives_enabled = TRUE
WHERE objectives_enabled IS NULL;

-- ============================================================================
-- 4. COHORT_PROFILES: Backfill admin, instructional, and superadmin profiles
-- ============================================================================

-- Insert all admin, instructional, and superadmin profiles into all cohorts
INSERT INTO cohort_profiles (cohort_id, profile_id, active, created_at, updated_at)
SELECT 
    c.id AS cohort_id,
    p.id AS profile_id,
    TRUE AS active,
    NOW() AS created_at,
    NOW() AS updated_at
FROM cohorts c
CROSS JOIN profiles p
WHERE p.role IN ('admin', 'instructional', 'superadmin')
ON CONFLICT (cohort_id, profile_id) DO NOTHING;

