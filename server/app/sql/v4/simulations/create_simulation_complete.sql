-- Create simulation with departments and scenarios in a single transaction
-- Converted to function
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
        WHERE proname = 'api_create_simulation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_simulation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop and recreate composite type for scenario rubric_grade_agents
DROP TYPE IF EXISTS types.i_create_simulation_v4_scenario_rubric_grade_agent CASCADE;

CREATE TYPE types.i_create_simulation_v4_scenario_rubric_grade_agent AS (
    scenario_id uuid,
    rubric_id uuid,
    grade_agent_id uuid,
    audio_agent_id uuid
);

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_create_simulation_v4(
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
    scenario_rubric_grade_agents types.i_create_simulation_v4_scenario_rubric_grade_agent[],
    simulation_text_domain_id uuid,
    simulation_voice_domain_id uuid,
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
        COALESCE(scenario_rubric_grade_agents, ARRAY[]::types.i_create_simulation_v4_scenario_rubric_grade_agent[]) AS scenario_rubric_grade_agents,
        simulation_text_domain_id AS simulation_text_domain_id,
        simulation_voice_domain_id AS simulation_voice_domain_id,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
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
new_simulation AS (
    -- Create simulation (without title/description/active/practice_simulation/domain columns)
    INSERT INTO simulations (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM assert_permissions ap
    RETURNING id as simulation_id
),
-- Link simulation text domain
link_simulation_text_domain AS (
    INSERT INTO simulation_agent_domains (simulation_id, agent_domain_id, type, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        x.simulation_text_domain_id,
        'text'::type_simulation_domains,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN params x
    WHERE x.simulation_text_domain_id IS NOT NULL
    ON CONFLICT (simulation_id, agent_domain_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link simulation voice domain
link_simulation_voice_domain AS (
    INSERT INTO simulation_agent_domains (simulation_id, agent_domain_id, type, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        x.simulation_voice_domain_id,
        'voice'::type_simulation_domains,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN params x
    WHERE x.simulation_voice_domain_id IS NOT NULL
    ON CONFLICT (simulation_id, agent_domain_id, type) DO UPDATE SET updated_at = NOW()
),
-- Link simulation to name (title)
link_simulation_name AS (
    INSERT INTO simulation_names (simulation_id, name_id, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN name_resource nr
    ON CONFLICT (simulation_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link simulation to description
link_simulation_description AS (
    INSERT INTO simulation_descriptions (simulation_id, description_id, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN description_resource dr
    ON CONFLICT (simulation_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link simulation active flag
link_simulation_active_flag AS (
    INSERT INTO simulation_flags (simulation_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        f.id,
        'active'::type_simulation_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (simulation_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link simulation practice flag
link_simulation_practice_flag AS (
    INSERT INTO simulation_flags (simulation_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ns.simulation_id,
        f.id,
        'practice'::type_simulation_flags,
        x.practice_simulation,
        NOW(),
        NOW()
    FROM new_simulation ns
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'practice'
    ON CONFLICT (simulation_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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
    INSERT INTO rubric_grade_agents (rubric_id, grade_agent_id, created_at, updated_at)
    SELECT DISTINCT
        (srga).rubric_id,
        (srga).grade_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.scenario_rubric_grade_agents) AS srga
    WHERE (srga).rubric_id IS NOT NULL 
      AND (srga).grade_agent_id IS NOT NULL
    ON CONFLICT (rubric_id, grade_agent_id, agent_id) DO UPDATE SET
        updated_at = NOW()
    RETURNING id as rubric_grade_agent_id, rubric_id, grade_agent_id
),
-- Link audio agents if provided
link_audio_agents AS (
    INSERT INTO rubric_grade_agents_audio (rubric_grade_agent_id, audio_agent_id, created_at, updated_at)
    SELECT DISTINCT
        crga.rubric_grade_agent_id,
        (srga).audio_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.scenario_rubric_grade_agents) AS srga
    JOIN create_rubric_grade_agents crga ON crga.rubric_id = (srga).rubric_id 
        AND crga.grade_agent_id = (srga).grade_agent_id
    WHERE (srga).audio_agent_id IS NOT NULL
    ON CONFLICT (rubric_grade_agent_id, audio_agent_id) DO NOTHING
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
        AND crga.grade_agent_id = (srga).grade_agent_id
    WHERE EXISTS (
        SELECT 1 FROM scenarios_with_order swo 
        WHERE swo.scenario_id = (srga).scenario_id
    )
      AND (srga).rubric_id IS NOT NULL 
      AND (srga).grade_agent_id IS NOT NULL
    ON CONFLICT (simulation_id, scenario_id, rubric_grade_agent_id) DO NOTHING
)
SELECT 
    ns.simulation_id,
    ap.actor_name::text as actor_name
FROM new_simulation ns
CROSS JOIN actor_profile ap
$$;