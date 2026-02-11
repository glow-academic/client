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
    training_bundle_entry_id uuid,
    scenario_ids uuid[],
    cohort_ids uuid[],
    color text,
    icon text,
    attempt_count int,
    highest_score_percent numeric,
    has_passed boolean,
    standard_group_ids uuid[],
    rubric_total_points int,
    rubric_pass_points int
);

CREATE OR REPLACE FUNCTION api_get_training_context_view_v4(
    profile_id_filter uuid,
    practice_filter boolean DEFAULT FALSE
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    items types.q_get_training_context_view_v4_item[],
    standard_group_ids uuid[],
    standard_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        practice_filter AS practice
),
user_profile AS (
    SELECT actor_name, role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_cohorts AS (
    SELECT ARRAY_AGG(DISTINCT ccj.cohorts_id) AS cohort_ids
    FROM profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj
      ON ccj.cohort_id = pcj.cohort_id
     AND ccj.active = true
    WHERE pcj.profile_id = (SELECT profile_id FROM params)
      AND pcj.active = true
),
accessible_training_rows AS (
    SELECT mtc.*
    FROM mv_training_context mtc
    JOIN user_cohorts uc ON mtc.cohort_id = ANY(COALESCE(uc.cohort_ids, ARRAY[]::uuid[]))
    WHERE mtc.practice = (SELECT practice FROM params)
),
active_simulation_rows AS (
    SELECT atr.*
    FROM accessible_training_rows atr
    JOIN simulation_simulations_junction ssj
      ON ssj.simulations_id = atr.simulation_id
     AND ssj.active = true
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
simulation_scope AS (
    SELECT
        asr.simulation_id,
        (ARRAY_AGG(asr.default_training_bundle_entry_id ORDER BY asr.training_created_at, asr.training_id)
            FILTER (WHERE asr.default_training_bundle_entry_id IS NOT NULL))[1] AS training_bundle_entry_id,
        ARRAY_AGG(DISTINCT sid.scenario_id ORDER BY sid.scenario_id)
            FILTER (WHERE sid.scenario_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT asr.cohort_id ORDER BY asr.cohort_id) AS cohort_ids,
        (ARRAY_AGG(asr.color ORDER BY asr.training_created_at, asr.training_id)
            FILTER (WHERE asr.color IS NOT NULL))[1] AS color,
        (ARRAY_AGG(asr.icon ORDER BY asr.training_created_at, asr.training_id)
            FILTER (WHERE asr.icon IS NOT NULL))[1] AS icon,
        ARRAY_AGG(DISTINCT sgid.standard_group_id ORDER BY sgid.standard_group_id)
            FILTER (WHERE sgid.standard_group_id IS NOT NULL) AS standard_group_ids,
        ARRAY_AGG(DISTINCT stid.standard_id ORDER BY stid.standard_id)
            FILTER (WHERE stid.standard_id IS NOT NULL) AS standard_ids,
        MAX(asr.rubric_total_points)::int AS rubric_total_points,
        MAX(asr.rubric_pass_points)::int AS rubric_pass_points
    FROM active_simulation_rows asr
    LEFT JOIN LATERAL unnest(COALESCE(asr.scenario_ids, ARRAY[]::uuid[])) sid(scenario_id) ON TRUE
    LEFT JOIN LATERAL unnest(COALESCE(asr.standard_group_ids, ARRAY[]::uuid[])) sgid(standard_group_id) ON TRUE
    LEFT JOIN LATERAL unnest(COALESCE(asr.standard_ids, ARRAY[]::uuid[])) stid(standard_id) ON TRUE
    GROUP BY asr.simulation_id
),
profile_resource AS (
    SELECT ppj.profiles_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
      AND ppj.active = true
    LIMIT 1
),
simulation_stats AS (
    SELECT
        af.simulation_id,
        COUNT(DISTINCT af.attempt_id)::int AS attempt_count,
        MAX(af.score_percent) AS highest_score_percent,
        BOOL_OR(COALESCE(af.has_passed, false)) AS has_passed
    FROM mv_attempt_facts af
    JOIN profile_resource pr
      ON pr.profiles_id = af.profile_id
    WHERE af.is_archived = false
      AND af.attempt_type = CASE WHEN (SELECT practice FROM params) THEN 'practice' ELSE 'general' END
    GROUP BY af.simulation_id
),
simulation_data_with_stats AS (
    SELECT
        ss.simulation_id,
        ss.training_bundle_entry_id,
        ss.scenario_ids,
        ss.cohort_ids,
        ss.color,
        ss.icon,
        COALESCE(st.attempt_count, 0) AS attempt_count,
        st.highest_score_percent,
        COALESCE(st.has_passed, false) AS has_passed,
        ss.standard_group_ids,
        ss.rubric_total_points,
        ss.rubric_pass_points,
        ss.standard_ids
    FROM simulation_scope ss
    LEFT JOIN simulation_stats st ON st.simulation_id = ss.simulation_id
)
SELECT
    (SELECT actor_name FROM user_profile) AS actor_name,
    (SELECT role::text FROM user_profile) AS user_role,
    COALESCE(
        (
            SELECT ARRAY_AGG(
                (
                    sd.simulation_id,
                    sd.training_bundle_entry_id,
                    sd.scenario_ids,
                    sd.cohort_ids,
                    sd.color,
                    sd.icon,
                    sd.attempt_count,
                    sd.highest_score_percent,
                    sd.has_passed,
                    sd.standard_group_ids,
                    sd.rubric_total_points,
                    sd.rubric_pass_points
                )::types.q_get_training_context_view_v4_item
                ORDER BY sd.simulation_id
            )
            FROM simulation_data_with_stats sd
            WHERE sd.scenario_ids IS NOT NULL
              AND ARRAY_LENGTH(sd.scenario_ids, 1) > 0
        ),
        ARRAY[]::types.q_get_training_context_view_v4_item[]
    ) AS items,
    COALESCE(
        (
            SELECT ARRAY_AGG(DISTINCT sgid.standard_group_id ORDER BY sgid.standard_group_id)
            FROM simulation_data_with_stats sd
            LEFT JOIN LATERAL unnest(COALESCE(sd.standard_group_ids, ARRAY[]::uuid[])) sgid(standard_group_id) ON TRUE
            WHERE sgid.standard_group_id IS NOT NULL
        ),
        ARRAY[]::uuid[]
    ) AS standard_group_ids,
    COALESCE(
        (
            SELECT ARRAY_AGG(DISTINCT stid.standard_id ORDER BY stid.standard_id)
            FROM simulation_data_with_stats sd
            LEFT JOIN LATERAL unnest(COALESCE(sd.standard_ids, ARRAY[]::uuid[])) stid(standard_id) ON TRUE
            WHERE stid.standard_id IS NOT NULL
        ),
        ARRAY[]::uuid[]
    ) AS standard_ids;
$$;
