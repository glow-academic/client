-- Cohort ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_cohort_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS cohort_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_cohort_ids_v4(
    profile_id uuid,
    cohort_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or cohort junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    simulation_ids uuid[],

    -- Simulation positions (special composite type from current implementation)
    simulation_position_values int[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    simulation_suggestions uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Draft multi-select resource IDs
draft_departments_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN cohort_drafts_departments_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
draft_simulations_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(ds.simulations_id ORDER BY ds.created_at), NULL), ARRAY[]::uuid[]) as simulation_ids
    FROM params x
    LEFT JOIN cohort_drafts_simulations_connection ds ON ds.draft_id = x.draft_id
    LIMIT 1
),
-- Cohort junction multi-select resource IDs
cohort_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cd.department_id ORDER BY cd.created_at)
                 FROM cohort_departments_junction cd
                 WHERE cd.cohort_id = (SELECT cohort_id FROM params) AND cd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
cohort_simulations_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cs.simulation_id ORDER BY cs.created_at)
                 FROM cohort_simulations_junction cs
                 WHERE cs.cohort_id = (SELECT cohort_id FROM params) AND cs.active = true),
                ARRAY[]::uuid[]
            )
        END as simulation_ids
    FROM params
    LIMIT 1
),
-- Combined multi-select IDs (draft preferred over cohort)
cohort_departments_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM cohort_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM cohort_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
cohort_simulations_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_ids FROM draft_simulations_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM draft_simulations_data)
            WHEN COALESCE(array_length((SELECT simulation_ids FROM cohort_simulations_junction_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM cohort_simulations_junction_data)
            ELSE ARRAY[]::uuid[]
        END as simulation_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or cohort junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM cohort_drafts_names_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cn.name_id FROM cohort_names_junction cn WHERE cn.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
    ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM cohort_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cd.description_id FROM cohort_descriptions_junction cd WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
    ) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM cohort_drafts_flags_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cf.flag_id FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND f.type = 'cohort_active' AND cf.value = TRUE LIMIT 1)
    ) as active_flag_id
    FROM params
),
-- Simulation positions (from draft or cohort junction)
simulation_positions_draft_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(spr.value ORDER BY spr.value),
            '{}'::int[]
        ) as simulation_position_values
    FROM params x
    LEFT JOIN cohort_drafts_simulation_positions_connection dsp ON dsp.draft_id = x.draft_id
    LEFT JOIN simulation_positions_resource spr ON spr.id = dsp.simulation_positions_id
    LIMIT 1
),
cohort_simulation_positions_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN '{}'::int[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(spr.value ORDER BY spr.value)
                 FROM cohort_simulation_positions_junction csp
                 JOIN simulation_positions_resource spr ON spr.id = csp.simulation_position_id
                 WHERE csp.cohort_id = (SELECT cohort_id FROM params)
                   AND csp.active = true),
                '{}'::int[]
            )
        END as simulation_position_values
    FROM params
    LIMIT 1
),
simulation_positions_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_position_values FROM simulation_positions_draft_data), 1), 0) > 0
                THEN (SELECT simulation_position_values FROM simulation_positions_draft_data)
            WHEN COALESCE(array_length((SELECT simulation_position_values FROM cohort_simulation_positions_data), 1), 0) > 0
                THEN (SELECT simulation_position_values FROM cohort_simulation_positions_data)
            ELSE '{}'::int[]
        END as simulation_position_values
    FROM params
    LIMIT 1
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM cohort_departments_combined_data) as department_ids,
    (SELECT simulation_ids FROM cohort_simulations_combined_data) as simulation_ids,

    -- Simulation positions
    (SELECT simulation_position_values FROM simulation_positions_combined_data) as simulation_position_values,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as simulation_suggestions
FROM params x;
$$;
