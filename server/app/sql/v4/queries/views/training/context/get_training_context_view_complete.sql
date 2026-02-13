-- ============================================================================
-- Query: get_training_context_view
-- Purpose: IDs-first training context for artifact hydration (thin MV filter layer)
-- Section: VIEWS/TRAINING/CONTEXT
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_training_context_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_context_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_training_context_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_training_context_view_v4_item AS (
    simulation_id uuid,
    training_bundle_entry_ids uuid[],
    scenario_ids uuid[],
    cohort_ids uuid[],
    persona_ids uuid[],
    standard_group_ids uuid[],
    standard_ids uuid[],
    rubric_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_training_context_view_v4(
    profile_id_filter uuid,
    practice_filter boolean DEFAULT FALSE
)
RETURNS TABLE (
    items types.q_get_training_context_view_v4_item[],
    standard_group_ids uuid[],
    standard_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        practice_filter AS practice
),
user_cohorts AS (
    SELECT ARRAY_AGG(DISTINCT ccj.cohorts_id) AS cohort_ids
    FROM profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj
      ON ccj.cohorts_id = pcj.cohort_id
     AND ccj.active = true
    WHERE pcj.profile_id = (SELECT profile_id FROM params)
      AND pcj.active = true
),
-- Filter mv_training: practice flag + cohort overlap
accessible_training AS (
    SELECT mt.*
    FROM mv_training mt
    JOIN user_cohorts uc
      ON mt.cohort_ids && COALESCE(uc.cohort_ids, ARRAY[]::uuid[])
    WHERE mt.practice = (SELECT practice FROM params)
),
-- Check simulation_active flag for each simulation
active_simulations AS (
    SELECT DISTINCT sid.simulation_id
    FROM accessible_training at2
    CROSS JOIN LATERAL unnest(at2.simulation_ids) sid(simulation_id)
    JOIN simulation_simulations_junction ssj
      ON ssj.simulations_id = sid.simulation_id AND ssj.active = true
    JOIN simulation_artifact sa
      ON sa.id = ssj.simulation_id
    WHERE EXISTS (
        SELECT 1
        FROM simulation_flags_junction sf
        JOIN flags_resource f ON f.id = sf.flag_id
        WHERE sf.simulation_id = sa.id
          AND f.name = 'simulation_active'
          AND sf.value = true
    )
),
-- Group by simulation: aggregate IDs from all training rows that contain this simulation
simulation_scope AS (
    SELECT
        asim.simulation_id,
        ARRAY_AGG(DISTINCT tbeid.training_bundle_entry_id ORDER BY tbeid.training_bundle_entry_id)
            FILTER (WHERE tbeid.training_bundle_entry_id IS NOT NULL) AS training_bundle_entry_ids,
        ARRAY_AGG(DISTINCT scid.scenario_id ORDER BY scid.scenario_id)
            FILTER (WHERE scid.scenario_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT coid.cohort_id ORDER BY coid.cohort_id)
            FILTER (WHERE coid.cohort_id IS NOT NULL) AS cohort_ids,
        ARRAY_AGG(DISTINCT pid.persona_id ORDER BY pid.persona_id)
            FILTER (WHERE pid.persona_id IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT sgid.standard_group_id ORDER BY sgid.standard_group_id)
            FILTER (WHERE sgid.standard_group_id IS NOT NULL) AS standard_group_ids,
        ARRAY_AGG(DISTINCT stid.standard_id ORDER BY stid.standard_id)
            FILTER (WHERE stid.standard_id IS NOT NULL) AS standard_ids,
        ARRAY_AGG(DISTINCT rid.rubric_id ORDER BY rid.rubric_id)
            FILTER (WHERE rid.rubric_id IS NOT NULL) AS rubric_ids
    FROM active_simulations asim
    JOIN accessible_training at2
      ON asim.simulation_id = ANY(at2.simulation_ids)
    LEFT JOIN LATERAL unnest(at2.training_bundle_entry_ids) tbeid(training_bundle_entry_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.scenario_ids) scid(scenario_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.cohort_ids) coid(cohort_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.persona_ids) pid(persona_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.standard_group_ids) sgid(standard_group_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.standard_ids) stid(standard_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.rubric_ids) rid(rubric_id) ON TRUE
    GROUP BY asim.simulation_id
)
SELECT
    COALESCE(
        (
            SELECT ARRAY_AGG(
                (
                    ss.simulation_id,
                    ss.training_bundle_entry_ids,
                    ss.scenario_ids,
                    ss.cohort_ids,
                    ss.persona_ids,
                    ss.standard_group_ids,
                    ss.standard_ids,
                    ss.rubric_ids
                )::types.q_get_training_context_view_v4_item
                ORDER BY ss.simulation_id
            )
            FROM simulation_scope ss
            WHERE ss.scenario_ids IS NOT NULL
              AND ARRAY_LENGTH(ss.scenario_ids, 1) > 0
        ),
        ARRAY[]::types.q_get_training_context_view_v4_item[]
    ) AS items,
    COALESCE(
        (
            SELECT ARRAY_AGG(DISTINCT sgid.standard_group_id ORDER BY sgid.standard_group_id)
            FROM simulation_scope ss
            CROSS JOIN LATERAL unnest(COALESCE(ss.standard_group_ids, ARRAY[]::uuid[])) sgid(standard_group_id)
            WHERE sgid.standard_group_id IS NOT NULL
        ),
        ARRAY[]::uuid[]
    ) AS standard_group_ids,
    COALESCE(
        (
            SELECT ARRAY_AGG(DISTINCT stid.standard_id ORDER BY stid.standard_id)
            FROM simulation_scope ss
            CROSS JOIN LATERAL unnest(COALESCE(ss.standard_ids, ARRAY[]::uuid[])) stid(standard_id)
            WHERE stid.standard_id IS NOT NULL
        ),
        ARRAY[]::uuid[]
    ) AS standard_ids;
$$;

