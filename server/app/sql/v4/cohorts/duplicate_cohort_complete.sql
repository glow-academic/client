-- Duplicate cohort with relationships in single query (DHH style)
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_cohort AS (
    -- Get original cohort data
    SELECT 
        c.id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title,
        (SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description
    FROM params x
    JOIN cohort_artifact c ON c.id = x.cohort_id
),
-- Insert title INTO names_resource table
new_title_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT title || ' Copy', NOW(), NOW()
    FROM original_cohort
    WHERE title IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM original_cohort
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id, description
),
new_cohort AS (
    -- Create duplicate cohort without title, description, active columns
    INSERT INTO cohort_artifact (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM original_cohort
    RETURNING id
),
-- Link cohort to title
link_cohort_title AS (
    INSERT INTO cohort_names (cohort_id, name_id, created_at, updated_at)
    SELECT 
        nc.id,
        ntr.name_id,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN new_title_resource ntr
    ON CONFLICT (cohort_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link cohort to description
link_cohort_description AS (
    INSERT INTO cohort_descriptions (cohort_id, description_id, created_at, updated_at)
    SELECT 
        nc.id,
        ndr.description_id,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN new_description_resource ndr
    ON CONFLICT (cohort_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link cohort active flag (set to false for duplicate)
link_cohort_active_flag AS (
    INSERT INTO cohort_flags (cohort_id, flag_id, value, created_at, updated_at) SELECT nc.id,
        f.id,
        FALSE,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (cohort_id, flag_id) DO UPDATE SET 
        value = FALSE,
        updated_at = NOW()
),
cohort_with_title AS (
    -- Get cohort with title for return
    SELECT 
        nc.id,
        ntr.name as title
    FROM new_cohort nc
    LEFT JOIN new_title_resource ntr ON true
),
copy_profiles AS (
    -- Copy profile relationships
    INSERT INTO profile_cohorts (profile_id, cohort_id, active)
    SELECT 
        cp.profile_id,
        nc.id,
        cp.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN profile_cohorts cp ON cp.cohort_id = oc.id
),
copy_simulations AS (
    -- Copy simulation relationships (position removed - now in simulation_positions_resource)
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active)
    SELECT 
        nc.id,
        cs.simulation_id,
        cs.active
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
    cwt.id,
    cwt.title,
    oc.title as original_title,
    ap.actor_name
FROM cohort_with_title cwt
CROSS JOIN original_cohort oc
CROSS JOIN actor_profile ap
LIMIT 1
$$;