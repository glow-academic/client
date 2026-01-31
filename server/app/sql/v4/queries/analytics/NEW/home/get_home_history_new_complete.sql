-- Get NEW home history using MVs (mv_home_attempt_history)
-- Simple SELECT from MVs with JOINs to _resource tables for metadata
-- Includes pagination, sorting, and filtering

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_home_history_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_history_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_home_history_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_home_history_new_v4_scenario AS (
    id uuid,
    name text,
    title text
);

CREATE TYPE types.q_get_home_history_new_v4_persona AS (
    id uuid,
    name text,
    color text
);

CREATE TYPE types.q_get_home_history_new_v4_attempt AS (
    attempt_id uuid,
    profile_id uuid,
    profile_name text,
    simulation_id uuid,
    simulation_name text,
    cohort_id uuid,
    cohort_name text,
    attempt_created_at timestamptz,
    infinite_mode boolean,
    num_chats int,
    num_chats_completed int,
    num_scenarios int,
    num_scenarios_completed int,
    score_percent numeric,
    has_passed boolean,
    total_time_seconds int,
    score_status text,  -- 'high' | 'medium' | 'low'
    scenario_ids uuid[],
    persona_ids uuid[]
);

CREATE TYPE types.q_get_home_history_new_v4_filter_option AS (
    value text,
    label text,
    count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_home_history_new_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    infinite_mode boolean DEFAULT NULL,
    search text DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page int DEFAULT 0,
    page_size int DEFAULT 20
)
RETURNS TABLE (
    actor_name text,
    data types.q_get_home_history_new_v4_attempt[],
    total_count int,
    page int,
    page_size int,
    total_pages int,
    simulation_options types.q_get_home_history_new_v4_filter_option[],
    scenario_options types.q_get_home_history_new_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        api_get_home_history_new_v4.profile_id AS profile_id,
        cohort_ids AS cohort_ids,
        department_ids AS department_ids,
        api_get_home_history_new_v4.simulation_ids AS simulation_ids,
        api_get_home_history_new_v4.scenario_ids AS scenario_ids,
        infinite_mode AS infinite_mode,
        NULLIF(TRIM(search), '') AS search,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(api_get_home_history_new_v4.page, 0) AS page,
        COALESCE(api_get_home_history_new_v4.page_size, 20) AS page_size
),
-- Get profile info and determine mode
profile_info AS (
    SELECT
        pr.id,
        pr.name AS actor_name,
        pr.role,
        CASE
            WHEN pr.role IN ('instructional', 'admin', 'superadmin') THEN 'instructional'
            ELSE 'member'
        END AS mode
    FROM profiles_resource pr
    CROSS JOIN params p
    WHERE pr.id = p.profile_id
),
-- Get viewable profiles based on mode
-- For member mode: only own profile
-- For instructional mode: profiles in accessible cohorts
viewable_profiles AS (
    SELECT p.profile_id AS id
    FROM params p
    CROSS JOIN profile_info pi
    WHERE pi.mode = 'member'

    UNION

    SELECT DISTINCT pcj.profile_id AS id
    FROM params p
    CROSS JOIN profile_info pi
    CROSS JOIN profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = pcj.cohort_id
    WHERE pi.mode = 'instructional'
      AND (p.cohort_ids IS NULL OR ccj.cohorts_id = ANY(p.cohort_ids))
),
-- Base query with filters (no pagination yet, for total count)
filtered_attempts AS (
    SELECT
        h.attempt_id,
        h.profile_id,
        pr.name AS profile_name,
        h.simulation_id,
        sim.name AS simulation_name,
        h.cohort_id,
        cr.name AS cohort_name,
        h.attempt_created_at,
        h.infinite_mode,
        h.num_chats,
        h.num_chats_completed,
        h.num_scenarios,
        h.num_scenarios_completed,
        h.score_percent,
        h.has_passed,
        h.total_time_seconds,
        CASE
            WHEN h.score_percent IS NULL THEN NULL
            WHEN h.score_percent >= 70 THEN 'high'
            WHEN h.score_percent >= 40 THEN 'medium'
            ELSE 'low'
        END AS score_status,
        h.scenario_ids,
        h.persona_ids
    FROM mv_home_attempt_history h
    CROSS JOIN params p
    JOIN profiles_resource pr ON pr.id = h.profile_id
    JOIN simulations_resource sim ON sim.id = h.simulation_id
    LEFT JOIN cohorts_resource cr ON cr.id = h.cohort_id
    WHERE h.profile_id IN (SELECT id FROM viewable_profiles)
      AND h.attempt_created_at >= p.start_date
      AND h.attempt_created_at <= p.end_date
      AND (p.simulation_ids IS NULL OR h.simulation_id = ANY(p.simulation_ids))
      AND (p.scenario_ids IS NULL OR h.scenario_ids && p.scenario_ids)
      AND (p.infinite_mode IS NULL OR h.infinite_mode = p.infinite_mode)
      AND (p.cohort_ids IS NULL OR h.cohort_id = ANY(p.cohort_ids))
      AND (p.department_ids IS NULL OR h.department_id = ANY(p.department_ids))
      AND (p.search IS NULL OR sim.name ILIKE '%' || p.search || '%' OR pr.name ILIKE '%' || p.search || '%')
),
-- Total count
total AS (
    SELECT COUNT(*)::int AS total_count FROM filtered_attempts
),
-- Sorted and paginated results
sorted_attempts AS (
    SELECT
        fa.*,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc'
                     THEN fa.attempt_created_at END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc'
                     THEN fa.attempt_created_at END ASC NULLS FIRST,
                CASE WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc'
                     THEN fa.score_percent END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc'
                     THEN fa.score_percent END ASC NULLS FIRST,
                CASE WHEN (SELECT sort_by FROM params) = 'simulation_name' AND (SELECT sort_order FROM params) = 'desc'
                     THEN fa.simulation_name END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'simulation_name' AND (SELECT sort_order FROM params) = 'asc'
                     THEN fa.simulation_name END ASC NULLS FIRST,
                fa.attempt_created_at DESC NULLS LAST
        ) AS row_num
    FROM filtered_attempts fa
),
paginated_attempts AS (
    SELECT
        sa.attempt_id,
        sa.profile_id,
        sa.profile_name,
        sa.simulation_id,
        sa.simulation_name,
        sa.cohort_id,
        sa.cohort_name,
        sa.attempt_created_at,
        sa.infinite_mode,
        sa.num_chats,
        sa.num_chats_completed,
        sa.num_scenarios,
        sa.num_scenarios_completed,
        sa.score_percent,
        sa.has_passed,
        sa.total_time_seconds,
        sa.score_status,
        sa.scenario_ids,
        sa.persona_ids,
        sa.row_num
    FROM sorted_attempts sa
    CROSS JOIN params p
    WHERE sa.row_num > p.page * p.page_size
      AND sa.row_num <= (p.page + 1) * p.page_size
),
-- Aggregate data
data_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                pa.attempt_id,
                pa.profile_id,
                pa.profile_name,
                pa.simulation_id,
                pa.simulation_name,
                pa.cohort_id,
                pa.cohort_name,
                pa.attempt_created_at,
                pa.infinite_mode,
                pa.num_chats,
                pa.num_chats_completed,
                pa.num_scenarios,
                pa.num_scenarios_completed,
                pa.score_percent,
                pa.has_passed,
                pa.total_time_seconds,
                pa.score_status,
                pa.scenario_ids,
                pa.persona_ids
            )::types.q_get_home_history_new_v4_attempt
            ORDER BY pa.row_num
        ),
        '{}'::types.q_get_home_history_new_v4_attempt[]
    ) AS data
    FROM paginated_attempts pa
),
-- Simulation filter options (from all filtered, not just current page)
simulation_options_data AS (
    SELECT
        fa.simulation_id::text AS value,
        fa.simulation_name AS label,
        COUNT(*)::int AS count
    FROM filtered_attempts fa
    GROUP BY fa.simulation_id, fa.simulation_name
    ORDER BY count DESC, fa.simulation_name
),
simulation_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (sod.value, sod.label, sod.count)::types.q_get_home_history_new_v4_filter_option
        ),
        '{}'::types.q_get_home_history_new_v4_filter_option[]
    ) AS simulation_options
    FROM simulation_options_data sod
),
-- Scenario filter options (from all filtered, not just current page)
scenario_options_data AS (
    SELECT
        s.id::text AS value,
        s.name AS label,
        COUNT(*)::int AS count
    FROM filtered_attempts fa
    CROSS JOIN LATERAL UNNEST(fa.scenario_ids) AS sid(scenario_id)
    JOIN scenarios_resource s ON s.id = sid.scenario_id
    GROUP BY s.id, s.name
    ORDER BY count DESC, s.name
),
scenario_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (scd.value, scd.label, scd.count)::types.q_get_home_history_new_v4_filter_option
        ),
        '{}'::types.q_get_home_history_new_v4_filter_option[]
    ) AS scenario_options
    FROM scenario_options_data scd
)
SELECT
    pi.actor_name,
    (SELECT data FROM data_agg),
    (SELECT total_count FROM total),
    (SELECT p.page FROM params p),
    (SELECT p.page_size FROM params p),
    CEIL((SELECT total_count FROM total)::numeric / NULLIF((SELECT page_size FROM params), 0))::int AS total_pages,
    (SELECT simulation_options FROM simulation_options_agg),
    (SELECT scenario_options FROM scenario_options_agg)
FROM profile_info pi
$$;
