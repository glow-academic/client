-- Create cohort with departments, profiles, and simulations in single query (DHH style)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_cohort_v4(
    title text,
    description text,
    active boolean,
    department_ids text[],
    profile_ids text[],
    simulation_ids text[],
    profile_id uuid
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        title AS title,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(profile_ids, ARRAY[]::text[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::text[]) AS simulation_ids,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
-- Insert title (name) into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT title, NOW(), NOW()
    FROM params
    WHERE title IS NOT NULL AND title != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_cohort AS (
    -- Create cohort (without title/description/active columns)
    INSERT INTO cohort (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params x
    RETURNING id
),
-- Link cohort to name (title)
link_cohort_name AS (
    INSERT INTO cohort_names (cohort_id, name_id, created_at, updated_at)
    SELECT 
        nc.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN name_resource nr
    ON CONFLICT (cohort_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link cohort to description
link_cohort_description AS (
    INSERT INTO cohort_descriptions (cohort_id, description_id, created_at, updated_at)
    SELECT 
        nc.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN description_resource dr
    ON CONFLICT (cohort_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link cohort active flag
link_cohort_active_flag AS (
    INSERT INTO cohort_flags (cohort_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        nc.id,
        f.id,
        'active'::type_cohort_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (cohort_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array may be empty)
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        nc.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_profiles AS (
    -- Link profiles if provided (array may be empty)
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        nc.id,
        pid::uuid,
        true
    FROM new_cohort nc
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.profile_ids) as pid
    WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
),
simulations_with_order AS (
    -- Prepare simulations with position based on array order
    SELECT 
        simulation_id::uuid,
        ROW_NUMBER() OVER () as position
    FROM params x
    CROSS JOIN UNNEST(x.simulation_ids) as simulation_id
    WHERE COALESCE(array_length(x.simulation_ids, 1), 0) > 0
),
link_simulations AS (
    -- Link simulations with position if provided (array may be empty)
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
    SELECT 
        nc.id,
        swo.simulation_id,
        true,
        swo.position
    FROM new_cohort nc
    CROSS JOIN simulations_with_order swo
)
-- Return cohort ID and actor name
SELECT 
    nc.id as cohort_id,
    ap.actor_name
FROM new_cohort nc
CROSS JOIN actor_profile ap
$$;