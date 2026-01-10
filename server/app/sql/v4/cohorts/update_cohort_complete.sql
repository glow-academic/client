-- Update cohort with department, profile, and simulation relationships in single query (DHH style)
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
        WHERE proname = 'api_update_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_update_cohort_v4(
    cohort_id uuid,
    title text,
    description text,
    active boolean,
    department_ids text[],
    profile_ids text[],
    simulation_ids text[],
    profile_id uuid
)
RETURNS TABLE (
    id text,
    title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
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
        x.profile_id AS profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
-- Insert/update title (name) in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT title, NOW(), NOW()
    FROM params
    WHERE title IS NOT NULL AND title != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert/update description in descriptions table
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
cohort_update AS (
    -- Update cohort (without title/description/active columns)
    UPDATE cohort c SET
        updated_at = NOW()
    FROM params x
    WHERE c.id = x.cohort_id
    RETURNING c.id, (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM cohort_names
    WHERE cohort_id = (SELECT cohort_id FROM params)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link cohort to new name
link_cohort_name AS (
    INSERT INTO cohort_names (cohort_id, name_id, created_at, updated_at)
    SELECT 
        cu.id,
        nr.name_id,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN name_resource nr
    ON CONFLICT (cohort_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links
remove_old_description AS (
    DELETE FROM cohort_descriptions
    WHERE cohort_id = (SELECT cohort_id FROM params)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
-- Link cohort to new description
link_cohort_description AS (
    INSERT INTO cohort_descriptions (cohort_id, description_id, created_at, updated_at)
    SELECT 
        cu.id,
        dr.description_id,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN description_resource dr
    ON CONFLICT (cohort_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Update cohort active flag
update_cohort_active_flag AS (
    UPDATE cohort_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE cohort_id = (SELECT cohort_id FROM params)
      AND type = 'active'::type_cohort_flags
),
insert_cohort_active_flag AS (
    INSERT INTO cohort_flags (cohort_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        cu.id,
        f.id,
        'active'::type_cohort_flags,
        x.active,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM cohort_flags cf WHERE cf.cohort_id = cu.id AND cf.type = 'active'::type_cohort_flags)
    ON CONFLICT (cohort_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
delete_departments AS (
    -- Delete existing department relationships
    DELETE FROM cohort_departments cd
    USING params x
    WHERE cd.cohort_id = x.cohort_id
),
link_departments AS (
    -- Link new departments if provided
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        cu.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM cohort_update cu
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_profiles AS (
    -- Deactivate existing profile relationships not in the new list
    UPDATE cohort_profiles cp
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE cp.cohort_id = x.cohort_id
      AND COALESCE(array_length(x.profile_ids, 1), 0) > 0
      AND cp.profile_id NOT IN (
          SELECT pid::uuid
          FROM UNNEST(x.profile_ids) as pid
      )
),
link_profiles AS (
    -- Link new profiles if provided
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        cu.id,
        pid::uuid,
        true
    FROM cohort_update cu
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.profile_ids) as pid
    WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_simulations AS (
    -- Delete all existing simulation links to reset positions
    DELETE FROM cohort_simulations cs
    USING params x
    WHERE cs.cohort_id = x.cohort_id
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
    -- Link simulations with position if provided
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
    SELECT 
        cu.id,
        swo.simulation_id,
        true,
        swo.position
    FROM cohort_update cu
    CROSS JOIN simulations_with_order swo
)
-- Return cohort ID, title, and actor name
SELECT 
    cu.id::text as id,
    cu.title,
    ap.actor_name
FROM cohort_update cu
CROSS JOIN actor_profile ap
$$;