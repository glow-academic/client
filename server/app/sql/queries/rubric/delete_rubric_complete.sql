-- Delete rubric with existence and usage checks in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_rubric_v4(
    rubric_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    name text,
    usage_count bigint,
    deleted boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT rubric_id AS rubric_id, profile_id AS profile_id
),
actor_profile AS (
    SELECT
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
rubric_info AS (
    SELECT 
        r.id,
        (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        (SELECT COUNT(DISTINCT ss.simulation_id) FROM simulation_scenarios_junction ss 
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = r.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.type = 'scenario_active' AND f.value = true)) as usage_count
    FROM rubric_artifact r
    WHERE r.id = (SELECT rubric_id FROM params)
),
delete_rubric AS (
    DELETE FROM rubric_artifact
    WHERE id IN (
        SELECT id FROM rubric_info WHERE usage_count = 0
    )
    RETURNING id as rubric_id
)
SELECT 
    ri.id as rubric_id,
    ri.name,
    ri.usage_count,
    CASE WHEN dr.rubric_id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM rubric_info ri
LEFT JOIN delete_rubric dr ON dr.rubric_id = ri.id
CROSS JOIN actor_profile ap
$$;