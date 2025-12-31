-- Duplicate cohort with relationships in single query (DHH style)
-- Converted to function

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_duplicate_cohort_v4(
    cohort_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    id uuid,
    title text,
    original_title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id AS profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
original_cohort AS (
    -- Get original cohort data
    SELECT 
        id,
        title,
        description
    FROM params x
    JOIN cohorts c ON c.id = x.cohort_id
),
new_cohort AS (
    -- Create duplicate cohort
    INSERT INTO cohorts (
        title,
        description,
        active
    )
    SELECT 
        oc.title || ' Copy',
        oc.description,
        false
    FROM original_cohort oc
    RETURNING id, title, description
),
copy_profiles AS (
    -- Copy profile relationships
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        nc.id,
        cp.profile_id,
        cp.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_profiles cp ON cp.cohort_id = oc.id
),
copy_simulations AS (
    -- Copy simulation relationships with position
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
    SELECT 
        nc.id,
        cs.simulation_id,
        cs.active,
        cs.position
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_simulations cs ON cs.cohort_id = oc.id
),
copy_departments AS (
    -- Copy department relationships
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        nc.id,
        cd.department_id,
        cd.active,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_departments cd ON cd.cohort_id = oc.id AND cd.active = true
)
-- Return new cohort info
SELECT 
    nc.id,
    nc.title,
    oc.title as original_title,
    ap.actor_name
FROM new_cohort nc
CROSS JOIN original_cohort oc
CROSS JOIN actor_profile ap
LIMIT 1
$$;

COMMIT;

