-- ============================================================================
-- Query: get_training_bundle_view
-- Purpose: Thin training-bundle scope lookup for bundle customization/start flows
-- Section: VIEWS/TRAINING/BUNDLE
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_training_bundle_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_bundle_view_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_training_bundle_view_v4(
    profile_id_filter uuid,
    training_bundle_entry_id_filter uuid
)
RETURNS TABLE (
    profile_has_access boolean,
    training_bundle_entry_id uuid,
    training_id uuid,
    simulation_id uuid,
    simulation_name text,
    scenario_id uuid,
    department_ids uuid[],
    persona_ids uuid[],
    document_ids uuid[],
    parameter_field_ids uuid[],
    scenario_time_limit_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        training_bundle_entry_id_filter AS training_bundle_entry_id
),
scope AS (
    SELECT
        tb.id AS training_bundle_entry_id,
        tb.training_id,
        tb.scenarios_id,
        t.simulations_id,
        t.cohorts_id,
        (
            SELECT ssj.simulation_id
            FROM simulation_simulations_junction ssj
            WHERE ssj.simulations_id = t.simulations_id
              AND ssj.active = true
            LIMIT 1
        ) AS simulation_artifact_id,
        (
            SELECT scj.scenario_id
            FROM scenario_scenarios_junction scj
            WHERE scj.scenarios_id = tb.scenarios_id
              AND scj.active = true
            LIMIT 1
        ) AS scenario_artifact_id,
        (
            SELECT n.name
            FROM simulation_simulations_junction ssj
            JOIN simulation_names_junction snj ON snj.simulation_id = ssj.simulation_id
            JOIN names_resource n ON n.id = snj.name_id
            WHERE ssj.simulations_id = t.simulations_id
              AND ssj.active = true
            LIMIT 1
        ) AS simulation_name
    FROM params p
    JOIN training_bundle_entry tb
      ON tb.id = p.training_bundle_entry_id
     AND tb.active = true
    JOIN training_entry t
      ON t.id = tb.training_id
     AND t.active = true
    LIMIT 1
),
access_data AS (
    SELECT EXISTS (
        SELECT 1
        FROM params p
        JOIN scope s ON TRUE
        JOIN profile_cohorts_junction pcj
          ON pcj.profile_id = p.profile_id
         AND pcj.active = true
        JOIN cohort_cohorts_junction ccj
          ON ccj.cohort_id = pcj.cohort_id
         AND ccj.active = true
        WHERE ccj.cohorts_id = s.cohorts_id
    ) AS profile_has_access
),
department_data AS (
    SELECT
        s.training_bundle_entry_id,
        COALESCE(
            ARRAY_AGG(DISTINCT tbd.departments_id ORDER BY tbd.departments_id)
                FILTER (WHERE tbd.departments_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS department_ids
    FROM scope s
    LEFT JOIN training_bundle_departments_entry tbd
      ON tbd.training_bundle_id = s.training_bundle_entry_id
     AND tbd.active = true
    GROUP BY s.training_bundle_entry_id
),
resource_data AS (
    SELECT
        s.training_bundle_entry_id,
        COALESCE(
            ARRAY_AGG(DISTINCT spj.persona_id ORDER BY spj.persona_id)
                FILTER (WHERE spj.persona_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS persona_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT sdj.document_id ORDER BY sdj.document_id)
                FILTER (WHERE sdj.document_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS document_ids,
        COALESCE(
            ARRAY_AGG(DISTINCT spfj.parameter_field_id ORDER BY spfj.parameter_field_id)
                FILTER (WHERE spfj.parameter_field_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS parameter_field_ids
    FROM scope s
    LEFT JOIN scenario_personas_junction spj
      ON spj.scenario_id = s.scenario_artifact_id
     AND spj.active = true
    LEFT JOIN scenario_documents_junction sdj
      ON sdj.scenario_id = s.scenario_artifact_id
     AND sdj.active = true
    LEFT JOIN scenario_parameter_fields_junction spfj
      ON spfj.scenario_id = s.scenario_artifact_id
     AND spfj.active = true
    GROUP BY s.training_bundle_entry_id
),
time_limit_data AS (
    SELECT
        s.training_bundle_entry_id,
        COALESCE(
            ARRAY_AGG(DISTINCT stlr.id ORDER BY stlr.id)
                FILTER (WHERE stlr.id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS scenario_time_limit_ids
    FROM scope s
    LEFT JOIN simulation_scenario_time_limits_junction sstl
      ON sstl.simulation_id = s.simulation_artifact_id
     AND sstl.active = true
    LEFT JOIN scenario_time_limits_resource stlr
      ON stlr.id = sstl.scenario_time_limit_id
     AND stlr.active = true
     AND stlr.scenario_id = s.scenarios_id
    GROUP BY s.training_bundle_entry_id
)
SELECT
    COALESCE(ad.profile_has_access, false) AS profile_has_access,
    s.training_bundle_entry_id,
    s.training_id,
    s.simulations_id AS simulation_id,
    s.simulation_name,
    s.scenario_artifact_id AS scenario_id,
    COALESCE(dd.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(rd.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(rd.document_ids, ARRAY[]::uuid[]) AS document_ids,
    COALESCE(rd.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(tld.scenario_time_limit_ids, ARRAY[]::uuid[]) AS scenario_time_limit_ids
FROM scope s
LEFT JOIN access_data ad ON TRUE
LEFT JOIN department_data dd ON dd.training_bundle_entry_id = s.training_bundle_entry_id
LEFT JOIN resource_data rd ON rd.training_bundle_entry_id = s.training_bundle_entry_id
LEFT JOIN time_limit_data tld ON tld.training_bundle_entry_id = s.training_bundle_entry_id;
$$;
