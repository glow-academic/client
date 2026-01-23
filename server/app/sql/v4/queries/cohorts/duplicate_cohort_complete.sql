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
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
original_cohort AS (
    -- Get original cohort data
    SELECT 
        c.id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title,
        (SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description
    FROM params x
    JOIN cohort_artifact c ON c.id = x.cohort_id
),
default_call AS (
    SELECT id as call_id
    FROM calls_entry
    LIMIT 1
),
-- Insert title INTO names_resource table
new_title_resource AS (
    INSERT INTO names_resource (name, created_at, call_id)
    SELECT title || ' Copy', NOW(), dc.call_id
    FROM original_cohort
    CROSS JOIN default_call dc
    WHERE title IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
    RETURNING id as name_id, name
),
-- Insert description INTO descriptions_resource table
existing_description_resource AS (
    SELECT d.id as description_id, d.description
    FROM original_cohort oc
    JOIN descriptions_resource d ON d.description = oc.description
    WHERE oc.description IS NOT NULL AND oc.description != ''
    LIMIT 1
),
new_description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, call_id)
    SELECT description, NOW(), dc.call_id
    FROM original_cohort
    CROSS JOIN default_call dc
    WHERE description IS NOT NULL AND description != ''
      AND NOT EXISTS (SELECT 1 FROM existing_description_resource)
    RETURNING id as description_id, description
),
description_resource AS (
    SELECT description_id, description FROM new_description_resource
    UNION ALL
    SELECT description_id, description FROM existing_description_resource
    LIMIT 1
),
new_group AS (
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = profile_id AND active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id
),
new_cohort AS (
    -- Create duplicate cohort
    INSERT INTO cohort_artifact (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id
),
-- Link cohort to group via junction table
link_cohort_group AS (
    INSERT INTO cohort_groups_junction (cohort_id, group_id, created_at)
    SELECT nc.id, ng.id, NOW()
    FROM new_cohort nc
    CROSS JOIN new_group ng
),
-- Link cohort to title
link_cohort_title AS (
    INSERT INTO cohort_names_junction (cohort_id, name_id, created_at)
    SELECT 
        nc.id,
        ntr.name_id,
        NOW()
    FROM new_cohort nc
    CROSS JOIN new_title_resource ntr
    ON CONFLICT (cohort_id, name_id) DO NOTHING
),
-- Link cohort to description
link_cohort_description AS (
    INSERT INTO cohort_descriptions_junction (cohort_id, description_id, created_at)
    SELECT 
        nc.id,
        dr.description_id,
        NOW()
    FROM new_cohort nc
    CROSS JOIN description_resource dr
    ON CONFLICT (cohort_id, description_id) DO NOTHING
),
-- Link cohort active flag (set to false for duplicate)
link_cohort_active_flag AS (
    INSERT INTO cohort_flags_junction (cohort_id, flag_id, value, created_at) SELECT nc.id,
        f.id,
        FALSE,
        NOW()
    FROM new_cohort nc
    CROSS JOIN flags_resource f
    WHERE f.name = 'cohort_active'
    ON CONFLICT (cohort_id, flag_id) DO UPDATE SET 
        value = FALSE
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
    INSERT INTO profile_cohorts_junction (profile_id, cohort_id, active)
    SELECT 
        cp.profile_id,
        nc.id,
        cp.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN profile_cohorts_junction cp ON cp.cohort_id = oc.id
),
copy_simulations AS (
    -- Copy simulation relationships (positions linked via cohort_simulation_positions_junction)
    INSERT INTO cohort_simulations_junction (cohort_id, simulation_id, active)
    SELECT 
        nc.id,
        cs.simulation_id,
        cs.active
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_simulations_junction cs ON cs.cohort_id = oc.id
),
copy_simulation_positions AS (
    INSERT INTO cohort_simulation_positions_junction (
        cohort_id,
        simulation_position_id,
        active,
        created_at,
        generated,
        mcp
    )
    SELECT
        nc.id,
        csp.simulation_position_id,
        csp.active,
        NOW(),
        csp.generated,
        csp.mcp
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_simulation_positions_junction csp ON csp.cohort_id = oc.id
    ON CONFLICT (cohort_id, simulation_position_id) DO UPDATE SET
        active = EXCLUDED.active
),
copy_departments AS (
    -- Copy department relationships
    INSERT INTO cohort_departments_junction (cohort_id, department_id, active, created_at)
    SELECT 
        nc.id,
        cd.department_id,
        cd.active,
        NOW()
    FROM new_cohort nc
    CROSS JOIN original_cohort oc
    JOIN cohort_departments_junction cd ON cd.cohort_id = oc.id AND cd.active = true
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
