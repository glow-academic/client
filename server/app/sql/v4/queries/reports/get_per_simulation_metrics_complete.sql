-- Get per-simulation view_metrics_entry for each profile
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Parameters: start_date, end_date, profile_id, cohort_ids, department_ids, roles, simulation_filters,
--             profile_ids, simulation_ids, scenario_ids
-- Returns: Array of per-simulation view_metrics_entry per profile
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_per_simulation_metrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_per_simulation_metrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_per_simulation_metrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Per-simulation metric
CREATE TYPE types.q_per_simulation_metrics_v4_metric AS (
    profile_id uuid,
    simulation_id uuid,
    average_score float,
    highest_score float,
    completion_percentage float,
    first_attempt_pass_rate float,
    total_attempts int,
    messages_per_session float,
    time_spent float
);

-- 4) Create function
CREATE OR REPLACE FUNCTION api_get_per_simulation_metrics_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_type[] DEFAULT ARRAY[]::profile_type[],
    simulation_filters text[] DEFAULT ARRAY[]::text[],
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    metrics types.q_per_simulation_metrics_v4_metric[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        (start_date::timestamptz) AS start_date,
        (end_date::timestamptz) AS end_date,
        profile_id,
        COALESCE(NULLIF(cohort_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(NULLIF(department_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS department_ids,
        COALESCE(NULLIF(roles, ARRAY[]::profile_type[]), ARRAY[]::profile_type[]) AS roles,
        COALESCE(NULLIF(simulation_filters, ARRAY[]::text[]), ARRAY['general']::text[]) AS simulation_filters,
        COALESCE(NULLIF(profile_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(NULLIF(simulation_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(NULLIF(scenario_ids, ARRAY[]::uuid[]), ARRAY[]::uuid[]) AS scenario_ids
),
filtered_profiles AS (
    SELECT 
        p.id
    FROM profile_artifact p
    WHERE 
        (cardinality((SELECT roles FROM params)::profile_type[]) = 0 OR (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) = ANY((SELECT roles FROM params)::profile_type[]))
        AND (cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM profile_cohorts_junction cp 
            WHERE cp.profile_id = p.id 
              AND cp.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[]) 
              AND cp.active = true
        ))
        AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR EXISTS (
            SELECT 1 FROM profile_departments_junction pd 
            WHERE pd.profile_id = p.id 
              AND pd.department_id = ANY((SELECT department_ids FROM params)::uuid[]) 
              AND pd.active = true
        ))
        AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR p.id = ANY((SELECT profile_ids FROM params)::uuid[]))
        AND ((SELECT profile_id FROM params) IS NULL OR p.id = (SELECT profile_id FROM params))
),
-- Use mv_dashboard_facts with backward compatibility columns
filt AS (
    SELECT
        f.chat_id,
        f.attempt_id,
        f.profile_id,
        f.simulation_id,
        f.scenario_id,
        f.persona_id,
        f.rubric_id,
        f.department_id,
        f.cohort_id,
        f.role_id,
        f.attempt_created_at,
        f.chat_created_at,
        f.grade_created_at,
        f.is_archived,
        f.infinite_mode,
        f.completed,
        f.score,
        f.passed,
        f.time_taken AS time_taken_seconds,
        f.rubric_total_points AS rubric_points_junction,
        f.rubric_pass_points,
        f.grade_percent,
        f.num_messages_total,
        f.num_query_messages,
        f.num_response_messages,
        f.message_time_taken_seconds,
        f.attempt_type,
        (f.attempt_type = 'general' AND NOT f.is_archived) AS is_general,
        (f.attempt_type = 'practice') AS is_practice
    FROM mv_dashboard_facts f
    WHERE f.attempt_created_at >= (SELECT start_date FROM params)
      AND f.attempt_created_at < (SELECT end_date FROM params)
      AND f.profile_id IN (SELECT id FROM filtered_profiles)
      AND (
          cardinality((SELECT cohort_ids FROM params)::uuid[]) = 0 OR
          f.simulation_id IN (
              SELECT DISTINCT s.id
              FROM simulation_artifact s
              WHERE EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f_flag ON sf.flag_id = f_flag.id WHERE sf.simulation_id = s.id AND f_flag.name = 'simulation_active' AND sf.value = TRUE)
                AND (
                    EXISTS (
                        SELECT 1
                        FROM cohort_simulations_junction cs
                        WHERE cs.simulation_id = s.id
                          AND cs.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[])
                          AND cs.active = TRUE
                    )
                    OR
                    (EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f_flag ON sf.flag_id = f_flag.id WHERE sf.simulation_id = s.id AND f_flag.name = 'practice' AND sf.value = TRUE)
                     AND NOT EXISTS (
                         SELECT 1
                         FROM cohort_simulations_junction cs2
                         WHERE cs2.simulation_id = s.id
                           AND cs2.active = TRUE
                     ))
                )
          )
      )
      AND (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR f.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
      AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR f.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
      AND (cardinality((SELECT scenario_ids FROM params)::uuid[]) = 0 OR f.scenario_id = ANY((SELECT scenario_ids FROM params)::uuid[]))
      AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'general' AND NOT f.is_archived) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.attempt_type = 'practice') OR
          ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND f.is_archived = TRUE)
      )
      AND ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR f.is_archived = FALSE)
),
simulation_metrics_per_profile AS (
    SELECT
        f.profile_id,
        f.simulation_id,
        AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
        MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
        TRUNC((100.0 * AVG((f.completed)::int))::numeric, 2)::float AS completion_pct,
        COUNT(f.attempt_id)::int AS total_attempts,
        AVG(f.num_messages_total) AS avg_messages,
        AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
    FROM filt f
    WHERE f.simulation_id IS NOT NULL
    GROUP BY f.profile_id, f.simulation_id
),
earliest_attempts_all_time AS (
    SELECT DISTINCT ON (f.profile_id, f.simulation_id)
        f.profile_id,
        f.simulation_id,
        f.attempt_created_at,
        f.grade_percent,
        f.rubric_pass_points,
        f.rubric_total_points AS rubric_points_junction
    FROM mv_dashboard_facts f
    WHERE f.profile_id IN (SELECT id FROM filtered_profiles)
    ORDER BY f.profile_id, f.simulation_id, f.attempt_created_at
),
filt_date_range AS (
    SELECT 
        MIN(attempt_created_at) AS min_date,
        MAX(attempt_created_at) AS max_date
    FROM filt
    WHERE attempt_created_at IS NOT NULL
),
first_attempts_per_sim AS (
    SELECT
        ea.profile_id,
        ea.simulation_id,
        ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points_junction, 0)) AS passed
    FROM earliest_attempts_all_time ea
    CROSS JOIN filt_date_range fdr
    WHERE EXISTS (SELECT 1 FROM filt f WHERE f.profile_id = ea.profile_id AND f.simulation_id = ea.simulation_id)
      AND fdr.min_date IS NOT NULL
      AND ea.attempt_created_at >= fdr.min_date
      AND ea.attempt_created_at <= fdr.max_date
),
first_attempt_per_sim_profile AS (
    SELECT
        profile_id,
        simulation_id,
        TRUNC((100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::numeric, 2)::float AS pass_rate
    FROM first_attempts_per_sim
    GROUP BY profile_id, simulation_id
)
SELECT 
    COALESCE(
        ARRAY_AGG(
            (sm.profile_id,
             sm.simulation_id,
             COALESCE(sm.avg_score, 0),
             COALESCE(sm.highest_score, 0),
             COALESCE(sm.completion_pct, 0),
             COALESCE(fasp.pass_rate, 0),
             COALESCE(sm.total_attempts, 0),
             COALESCE(sm.avg_messages, 0),
             COALESCE(sm.avg_time_minutes, 0)
            )::types.q_per_simulation_metrics_v4_metric
            ORDER BY sm.profile_id, sm.simulation_id
        ),
        ARRAY[]::types.q_per_simulation_metrics_v4_metric[]
    ) AS metrics
FROM simulation_metrics_per_profile sm
LEFT JOIN first_attempt_per_sim_profile fasp 
    ON fasp.profile_id = sm.profile_id 
    AND fasp.simulation_id = sm.simulation_id
$$;
