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
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
rubric_info AS (
    SELECT 
        r.id,
        (SELECT n.name FROM rubric_names rn JOIN names n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        (SELECT COUNT(DISTINCT ss.simulation_id) FROM simulation_scenarios ss 
         JOIN simulation_scenarios_scenario_rubric_grade_agents sssrga ON sssrga.simulation_id = ss.simulation_id AND sssrga.scenario_id = ss.scenario_id
         JOIN scenario_rubric_grade_agents srga ON srga.id = sssrga.scenario_rubric_grade_agent_id
         JOIN rubric_grade_agents rga ON rga.id = srga.grade_agent_id
         WHERE rga.rubric_id = r.id AND EXISTS (SELECT 1 FROM simulation_scenario_flags ssf WHERE ssf.simulation_id = ss.simulation_id AND ssf.scenario_id = ss.scenario_id AND ssf.type = 'active'::type_simulation_scenario_flags AND ssf.value = true)) as usage_count
    FROM rubric r
    WHERE r.id = (SELECT rubric_id FROM params)
),
delete_rubric AS (
    DELETE FROM rubric
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