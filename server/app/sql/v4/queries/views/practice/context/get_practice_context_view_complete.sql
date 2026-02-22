-- ============================================================================
-- Query: get_practice_context_view
-- Purpose: IDs-first practice context for artifact hydration (thin MV filter layer)
-- Section: VIEWS/PRACTICE/CONTEXT
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_context_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_context_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_practice_context_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_practice_context_view_v4_item AS (
    simulation_id uuid,
    chat_entry_ids uuid[],
    scenario_ids uuid[],
    cohort_ids uuid[],
    persona_ids uuid[],
    rubric_ids uuid[],
    time_limit_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_practice_context_view_v4(
    profile_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_practice_context_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id_filter AS profile_id
),
user_cohorts AS (
    SELECT ARRAY_AGG(DISTINCT ccj.cohorts_id) AS cohort_ids
    FROM profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj
      ON ccj.cohorts_id = pcj.cohort_id
     AND ccj.active = true
    JOIN cohorts_resource cr
      ON cr.id = ccj.cohorts_id
     AND cr.active = true
    WHERE pcj.profile_id = (SELECT profile_id FROM params)
      AND pcj.active = true
),
-- Filter practice_mv by cohort overlap
accessible_training AS (
    SELECT
        mp.practice_id AS parent_id,
        mp.simulation_ids,
        mp.cohort_ids,
        mp.chat_ids AS chat_entry_ids,
        mp.scenario_ids,
        mp.persona_ids,
        mp.rubric_ids,
        mp.time_limit_ids
    FROM practice_mv mp
    JOIN user_cohorts uc ON mp.cohort_ids && COALESCE(uc.cohort_ids, ARRAY[]::uuid[])
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
          AND f.name = 'Active'
          AND sf.value = true
    )
),
-- Group by simulation: aggregate IDs from all training rows that contain this simulation
simulation_scope AS (
    SELECT
        asim.simulation_id,
        ARRAY_AGG(DISTINCT tbeid.chat_entry_id ORDER BY tbeid.chat_entry_id)
            FILTER (WHERE tbeid.chat_entry_id IS NOT NULL) AS chat_entry_ids,
        ARRAY_AGG(DISTINCT scid.scenario_id ORDER BY scid.scenario_id)
            FILTER (WHERE scid.scenario_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT coid.cohort_id ORDER BY coid.cohort_id)
            FILTER (WHERE coid.cohort_id IS NOT NULL) AS cohort_ids,
        ARRAY_AGG(DISTINCT pid.persona_id ORDER BY pid.persona_id)
            FILTER (WHERE pid.persona_id IS NOT NULL) AS persona_ids,
        ARRAY_AGG(DISTINCT rid.rubric_id ORDER BY rid.rubric_id)
            FILTER (WHERE rid.rubric_id IS NOT NULL) AS rubric_ids,
        ARRAY_AGG(DISTINCT tlid.time_limit_id ORDER BY tlid.time_limit_id)
            FILTER (WHERE tlid.time_limit_id IS NOT NULL) AS time_limit_ids
    FROM active_simulations asim
    JOIN accessible_training at2
      ON asim.simulation_id = ANY(at2.simulation_ids)
    LEFT JOIN LATERAL unnest(at2.chat_entry_ids) tbeid(chat_entry_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.scenario_ids) scid(scenario_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.cohort_ids) coid(cohort_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.persona_ids) pid(persona_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.rubric_ids) rid(rubric_id) ON TRUE
    LEFT JOIN LATERAL unnest(at2.time_limit_ids) tlid(time_limit_id) ON TRUE
    GROUP BY asim.simulation_id
)
SELECT
    COALESCE(
        (
            SELECT ARRAY_AGG(
                (
                    ss.simulation_id,
                    ss.chat_entry_ids,
                    ss.scenario_ids,
                    ss.cohort_ids,
                    ss.persona_ids,
                    ss.rubric_ids,
                    ss.time_limit_ids
                )::types.q_get_practice_context_view_v4_item
                ORDER BY ss.simulation_id
            )
            FROM simulation_scope ss
            WHERE ss.scenario_ids IS NOT NULL
              AND ARRAY_LENGTH(ss.scenario_ids, 1) > 0
        ),
        ARRAY[]::types.q_get_practice_context_view_v4_item[]
    ) AS items;
$$;
