-- Delete rubric with existence and usage checks in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_rubric_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_rubric_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_rubric_v3(
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
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
rubric_info AS (
    SELECT 
        r.id,
        r.name,
        (SELECT COUNT(DISTINCT ss.simulation_id) FROM simulation_scenarios ss 
         JOIN simulation_scenarios_rubric_grade_agents ssrga ON ssrga.simulation_id = ss.simulation_id AND ssrga.scenario_id = ss.scenario_id
         JOIN rubric_grade_agents rga ON rga.id = ssrga.rubric_grade_agent_id
         WHERE rga.rubric_id = r.id AND ss.active = true) as usage_count
    FROM rubrics r
    WHERE r.id = (SELECT rubric_id FROM params)
),
delete_rubric AS (
    DELETE FROM rubrics
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

COMMIT;
