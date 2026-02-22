-- Get simulation IDs - Pass 2 of two-pass architecture
-- Returns all resource IDs for parallel resource fetching
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS simulation_candidate_agent CASCADE;

CREATE OR REPLACE FUNCTION api_get_simulation_ids_v4(
    profile_id uuid,
    simulation_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select IDs
    name_id uuid,
    description_id uuid,
    -- Multi-select IDs
    flag_ids uuid[],
    department_ids uuid[],
    scenario_ids uuid[],
    scenario_flag_ids uuid[],
    scenario_position_ids uuid[],
    scenario_rubric_ids uuid[],
    scenario_time_limit_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS p_profile_id,
        simulation_id AS p_simulation_id,
        draft_id AS p_draft_id,
        COALESCE(group_id, (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)) AS p_group_id,
        COALESCE(user_department_ids, ARRAY[]::uuid[]) AS p_user_dept_ids
),
-- Get name_id (from draft first, then simulation)
name_data AS (
    SELECT COALESCE(
        (SELECT nd.names_id FROM simulation_drafts_names_connection nd WHERE nd.draft_id = (SELECT p_draft_id FROM params) LIMIT 1),
        (SELECT sn.name_id FROM simulation_names_junction sn WHERE sn.simulation_id = (SELECT p_simulation_id FROM params) LIMIT 1)
    ) as name_id
),
-- Get description_id (from draft first, then simulation)
description_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM simulation_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT p_draft_id FROM params) LIMIT 1),
        (SELECT sd.description_id FROM simulation_descriptions_junction sd WHERE sd.simulation_id = (SELECT p_simulation_id FROM params) LIMIT 1)
    ) as description_id
),
-- Get flag_ids (from draft first, then simulation)
flag_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(fd.flags_id) FROM simulation_drafts_flags_connection fd WHERE fd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(sf.flag_id) FROM simulation_flags_junction sf
         WHERE sf.simulation_id = (SELECT p_simulation_id FROM params)
           AND sf.value = true),
        ARRAY[]::uuid[]
    ) as flag_ids
),
-- Get department_ids (from draft first, then simulation)
department_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(dd.departments_id) FROM simulation_drafts_departments_connection dd WHERE dd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(sd.department_id) FROM simulation_departments_junction sd WHERE sd.simulation_id = (SELECT p_simulation_id FROM params) AND sd.active = true),
        ARRAY[]::uuid[]
    ) as department_ids
),
-- Get scenario_ids (from draft first, then simulation)
scenario_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(sd.scenarios_id) FROM simulation_drafts_scenarios_connection sd WHERE sd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(ss.scenario_id) FROM simulation_scenarios_junction ss WHERE ss.simulation_id = (SELECT p_simulation_id FROM params) AND ss.active = true),
        ARRAY[]::uuid[]
    ) as scenario_ids
),
-- Get scenario_flag_ids
scenario_flag_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(sfd.scenario_flags_id) FROM simulation_drafts_scenario_flags_connection sfd WHERE sfd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(ssf.scenario_flag_id) FROM simulation_scenario_flags_junction ssf WHERE ssf.simulation_id = (SELECT p_simulation_id FROM params) AND ssf.value = true),
        ARRAY[]::uuid[]
    ) as scenario_flag_ids
),
-- Get scenario_position_ids
scenario_position_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(spd.scenario_positions_id) FROM simulation_drafts_scenario_positions_connection spd WHERE spd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(ssp.scenario_position_id) FROM simulation_scenario_positions_junction ssp WHERE ssp.simulation_id = (SELECT p_simulation_id FROM params) AND ssp.active = true),
        ARRAY[]::uuid[]
    ) as scenario_position_ids
),
-- Get scenario_rubric_ids
scenario_rubric_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(srd.scenario_rubrics_id) FROM simulation_drafts_scenario_rubrics_connection srd WHERE srd.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(ssr.scenario_rubric_id) FROM simulation_scenario_rubrics_junction ssr WHERE ssr.simulation_id = (SELECT p_simulation_id FROM params) AND ssr.active = true),
        ARRAY[]::uuid[]
    ) as scenario_rubric_ids
),
-- Get scenario_time_limit_ids
scenario_time_limit_data AS (
    SELECT COALESCE(
        (SELECT ARRAY_AGG(stld.scenario_time_limits_id) FROM simulation_drafts_scenario_time_limits_connection stld WHERE stld.draft_id = (SELECT p_draft_id FROM params)),
        (SELECT ARRAY_AGG(sstl.scenario_time_limit_id) FROM simulation_scenario_time_limits_junction sstl WHERE sstl.simulation_id = (SELECT p_simulation_id FROM params) AND sstl.active = true),
        ARRAY[]::uuid[]
    ) as scenario_time_limit_ids
)
SELECT
    (SELECT name_id FROM name_data),
    (SELECT description_id FROM description_data),
    (SELECT flag_ids FROM flag_data),
    (SELECT department_ids FROM department_data),
    (SELECT scenario_ids FROM scenario_data),
    (SELECT scenario_flag_ids FROM scenario_flag_data),
    (SELECT scenario_position_ids FROM scenario_position_data),
    (SELECT scenario_rubric_ids FROM scenario_rubric_data),
    (SELECT scenario_time_limit_ids FROM scenario_time_limit_data)
FROM params x;
$$;
