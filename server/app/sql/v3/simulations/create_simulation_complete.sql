-- Create simulation with departments and scenarios in a single transaction
-- Converted to function

BEGIN;

-- 1) Drop function first
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_simulation_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_simulation_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop and recreate composite type for scenario rubric_grade_agents
DROP TYPE IF EXISTS types.i_create_simulation_v3_scenario_rubric_grade_agent CASCADE;

CREATE TYPE types.i_create_simulation_v3_scenario_rubric_grade_agent AS (
    scenario_id uuid,
    rubric_id uuid,
    grade_text_agent_id uuid,
    grade_voice_agent_id uuid
);

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_simulation_v3(
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    department_ids uuid[],
    scenario_ids uuid[],
    scenario_active_flags boolean[],
    scenario_hints_enabled boolean[],
    scenario_time_limit_seconds int[],
    scenario_audio_enabled boolean[],
    scenario_text_enabled boolean[],
    scenario_rubric_grade_agents types.i_create_simulation_v3_scenario_rubric_grade_agent[],
    simulation_text_agent_id uuid,
    simulation_voice_agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT 
        title AS title,
        description AS description,
        active AS active,
        practice_simulation AS practice_simulation,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        COALESCE(scenario_active_flags, ARRAY[]::boolean[]) AS scenario_active_flags,
        COALESCE(scenario_hints_enabled, ARRAY[]::boolean[]) AS scenario_hints_enabled,
        COALESCE(scenario_time_limit_seconds, ARRAY[]::int[]) AS scenario_time_limit_seconds,
        COALESCE(scenario_audio_enabled, ARRAY[]::boolean[]) AS scenario_audio_enabled,
        COALESCE(scenario_text_enabled, ARRAY[]::boolean[]) AS scenario_text_enabled,
        COALESCE(scenario_rubric_grade_agents, ARRAY[]::types.i_create_simulation_v3_scenario_rubric_grade_agent[]) AS scenario_rubric_grade_agents,
        simulation_text_agent_id AS simulation_text_agent_id,
        simulation_voice_agent_id AS simulation_voice_agent_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    SELECT validate_department_create_permissions(
        up.role::text,
        (SELECT department_ids::text[] FROM params)
    ) as validation_passed
    FROM user_profile up
),
assert_permissions AS (
    SELECT 1
    FROM validate_create_permissions
    WHERE validation_passed = true
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
new_simulation AS (
    INSERT INTO simulations (
        title,
        description,
        active,
        practice_simulation,
        simulation_text_agent_id,
        simulation_voice_agent_id,
        created_at,
        updated_at
    )
    SELECT 
        x.title,
        x.description,
        x.active,
        x.practice_simulation,
        x.simulation_text_agent_id,
        x.simulation_voice_agent_id,
        NOW(),
        NOW()
    FROM params x
    JOIN assert_permissions ap ON TRUE
    RETURNING id as simulation_id
),
link_departments AS (
    INSERT INTO simulation_departments (simulation_id, department_id, active, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        dept_id,
        true,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE array_length(x.department_ids, 1) > 0
    ON CONFLICT (simulation_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
scenarios_data AS (
    SELECT DISTINCT
        scenario_id,
        active_flag,
        hints_enabled,
        audio_enabled,
        text_enabled,
        time_limit_seconds,
        row_num
    FROM (
        SELECT 
            scenario_id,
            active_flag,
            COALESCE(hints_enabled, false) as hints_enabled,
            COALESCE(audio_enabled, false) as audio_enabled,
            COALESCE(text_enabled, true) as text_enabled,
            time_limit_seconds,
            ROW_NUMBER() OVER () as row_num
        FROM params x
        CROSS JOIN UNNEST(
            x.scenario_ids, 
            x.scenario_active_flags, 
            x.scenario_hints_enabled,
            x.scenario_audio_enabled,
            x.scenario_text_enabled,
            x.scenario_time_limit_seconds
        ) AS t(scenario_id, active_flag, hints_enabled, audio_enabled, text_enabled, time_limit_seconds)
    ) sub
),
scenarios_with_order AS (
    SELECT 
        scenario_id,
        active_flag,
        hints_enabled,
        audio_enabled,
        text_enabled,
        time_limit_seconds,
        ROW_NUMBER() OVER (
            ORDER BY active_flag DESC, row_num
        ) as position
    FROM scenarios_data
    WHERE EXISTS (SELECT 1 FROM params x WHERE array_length(x.scenario_ids, 1) > 0)
),
replace_time_limits AS (
    DELETE FROM scenario_time_limits 
    WHERE simulation_id IN (SELECT simulation_id FROM new_simulation)
),
link_time_limits AS (
    INSERT INTO scenario_time_limits (simulation_id, scenario_id, time_limit_seconds, active, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        swo.scenario_id,
        swo.time_limit_seconds,
        true,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
    WHERE swo.time_limit_seconds IS NOT NULL 
      AND swo.time_limit_seconds > 0
      AND swo.active_flag = true
),
link_scenarios AS (
    INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position, hints_enabled, audio_enabled, text_enabled, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        swo.scenario_id,
        swo.active_flag,
        swo.position,
        swo.hints_enabled,
        swo.audio_enabled,
        swo.text_enabled,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN scenarios_with_order swo
),
-- Create/find rubric_grade_agents entries (before new_simulation exists)
create_rubric_grade_agents AS (
    INSERT INTO rubric_grade_agents (rubric_id, grade_text_agent_id, created_at, updated_at)
    SELECT DISTINCT
        (srga).rubric_id,
        (srga).grade_text_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.scenario_rubric_grade_agents) AS srga
    WHERE (srga).rubric_id IS NOT NULL 
      AND (srga).grade_text_agent_id IS NOT NULL
    ON CONFLICT (rubric_id, grade_text_agent_id) DO UPDATE SET
        updated_at = NOW()
    RETURNING id as rubric_grade_agent_id, rubric_id, grade_text_agent_id
),
-- Link voice agents if provided
link_voice_agents AS (
    INSERT INTO rubric_grade_agents_voice (rubric_grade_agent_id, grade_voice_agent_id, created_at, updated_at)
    SELECT DISTINCT
        crga.rubric_grade_agent_id,
        (srga).grade_voice_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.scenario_rubric_grade_agents) AS srga
    JOIN create_rubric_grade_agents crga ON crga.rubric_id = (srga).rubric_id 
        AND crga.grade_text_agent_id = (srga).grade_text_agent_id
    WHERE (srga).grade_voice_agent_id IS NOT NULL
    ON CONFLICT (rubric_grade_agent_id, grade_voice_agent_id) DO NOTHING
),
link_scenario_rubric_grade_agents AS (
    INSERT INTO simulation_scenarios_rubric_grade_agents (simulation_id, scenario_id, rubric_grade_agent_id, created_at, updated_at)
    SELECT DISTINCT
        ns.simulation_id,
        (srga).scenario_id,
        crga.rubric_grade_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN new_simulation ns
    CROSS JOIN UNNEST(x.scenario_rubric_grade_agents) AS srga
    JOIN create_rubric_grade_agents crga ON crga.rubric_id = (srga).rubric_id 
        AND crga.grade_text_agent_id = (srga).grade_text_agent_id
    WHERE EXISTS (
        SELECT 1 FROM scenarios_with_order swo 
        WHERE swo.scenario_id = (srga).scenario_id
    )
      AND (srga).rubric_id IS NOT NULL 
      AND (srga).grade_text_agent_id IS NOT NULL
    ON CONFLICT (simulation_id, scenario_id, rubric_grade_agent_id) DO NOTHING
)
SELECT 
    ns.simulation_id,
    ap.actor_name::text as actor_name
FROM new_simulation ns
CROSS JOIN actor_profile ap
$$;

COMMIT;
