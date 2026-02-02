-- ============================================================================
-- Query Function: api_get_profile_metrics_v4
-- Filters and sorts mv_profile_metrics for leaderboards and profile reports.
--
-- Used by: Reports Leaderboard, Profile Cards, Certificates
-- ============================================================================

-- ============================================================================
-- Step 1: Safe drop function (all overloads)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profile_metrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_metrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Safe drop composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_profile_metrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Filter option type (for dropdowns)
CREATE TYPE types.q_get_profile_metrics_v4_filter_option AS (
    id uuid,
    name text,
    count int
);

-- Main item type (leaderboard row)
CREATE TYPE types.q_get_profile_metrics_v4_item AS (
    -- Keys
    profile_id uuid,
    attempt_type text,
    is_archived boolean,
    -- Profile metadata (JOINed)
    profile_name text,
    profile_type text,
    -- Leaderboard rank
    rank int,
    -- Standard metrics
    total_attempts int,
    avg_score numeric,
    highest_score numeric,
    completion_pct numeric,
    first_attempt_pass_rate numeric,
    avg_messages_per_session numeric,
    avg_persona_response_sec numeric,
    session_efficiency numeric,
    total_time_minutes numeric,
    -- Leaderboard extras
    improvement_rate numeric,
    perfect_score_count int,
    quickest_pass_minutes numeric,
    -- Timestamps
    first_attempt_at timestamptz,
    last_attempt_at timestamptz,
    -- Arrays for filtering/display
    simulation_ids uuid[],
    scenario_ids uuid[],
    cohort_ids uuid[],
    simulation_names text[],
    cohort_names text[]
);

-- Summary statistics type
CREATE TYPE types.q_get_profile_metrics_v4_summary AS (
    total_profiles int,
    avg_score_all numeric,
    avg_attempts_per_profile numeric,
    total_perfect_scores int,
    avg_completion_pct numeric
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_profile_metrics_v4(
    -- Filter parameters
    profile_id_param uuid DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    attempt_type_param text DEFAULT NULL,
    show_archived boolean DEFAULT FALSE,
    min_attempts int DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'avg_score',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    total_count int,
    items types.q_get_profile_metrics_v4_item[],
    summary types.q_get_profile_metrics_v4_summary,
    cohort_options types.q_get_profile_metrics_v4_filter_option[],
    simulation_options types.q_get_profile_metrics_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Parameter normalization
params AS (
    SELECT
        profile_id_param AS profile_id,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        attempt_type_param AS attempt_type,
        COALESCE(show_archived, FALSE) AS show_archived,
        min_attempts,
        COALESCE(sort_by, 'avg_score') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
-- Base filtered data from MV with resource JOINs
base_data AS (
    SELECT
        mv.profile_id,
        mv.attempt_type,
        mv.is_archived,
        mv.total_attempts,
        mv.avg_score,
        mv.highest_score,
        mv.completion_pct,
        mv.first_attempt_pass_rate,
        mv.avg_messages_per_session,
        mv.avg_persona_response_sec,
        mv.session_efficiency,
        mv.total_time_minutes,
        mv.improvement_rate,
        mv.perfect_score_count,
        mv.quickest_pass_minutes,
        mv.first_attempt_at,
        mv.last_attempt_at,
        mv.simulation_ids,
        mv.scenario_ids,
        mv.cohort_ids,
        -- Profile metadata
        pr.name AS profile_name,
        pr.role::text AS profile_type
    FROM params p
    CROSS JOIN mv_profile_metrics mv
    JOIN profiles_resource pr ON pr.id = mv.profile_id
    WHERE
        -- Single profile lookup
        (p.profile_id IS NOT NULL AND mv.profile_id = p.profile_id
         OR p.profile_id IS NULL AND (cardinality(p.profile_ids) = 0 OR mv.profile_id = ANY(p.profile_ids)))
        -- Cohort filter (any match in array)
        AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_ids && p.cohort_ids)
        -- Simulation filter (any match in array)
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_ids && p.simulation_ids)
        -- Attempt type filter
        AND (p.attempt_type IS NULL OR mv.attempt_type = p.attempt_type)
        -- Archived filter
        AND (p.show_archived OR mv.is_archived = FALSE)
        -- Minimum attempts filter
        AND (p.min_attempts IS NULL OR mv.total_attempts >= p.min_attempts)
),
-- Total count
count_data AS (
    SELECT COUNT(*)::int AS total_count FROM base_data
),
-- Ranked and sorted data
ranked_data AS (
    SELECT
        bd.*,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN (SELECT sort_by FROM params) = 'avg_score' AND (SELECT sort_order FROM params) = 'desc'
                     THEN bd.avg_score END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'avg_score' AND (SELECT sort_order FROM params) = 'asc'
                     THEN bd.avg_score END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'highest_score' AND (SELECT sort_order FROM params) = 'desc'
                     THEN bd.highest_score END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'highest_score' AND (SELECT sort_order FROM params) = 'asc'
                     THEN bd.highest_score END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'total_attempts' AND (SELECT sort_order FROM params) = 'desc'
                     THEN bd.total_attempts END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'total_attempts' AND (SELECT sort_order FROM params) = 'asc'
                     THEN bd.total_attempts END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'improvement' AND (SELECT sort_order FROM params) = 'desc'
                     THEN bd.improvement_rate END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'improvement' AND (SELECT sort_order FROM params) = 'asc'
                     THEN bd.improvement_rate END ASC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'name' AND (SELECT sort_order FROM params) = 'desc'
                     THEN bd.profile_name END DESC NULLS LAST,
                CASE WHEN (SELECT sort_by FROM params) = 'name' AND (SELECT sort_order FROM params) = 'asc'
                     THEN bd.profile_name END ASC NULLS LAST,
                bd.avg_score DESC NULLS LAST,
                bd.profile_name ASC NULLS LAST
        )::int AS rank
    FROM base_data bd
),
-- Paginated data
paginated_data AS (
    SELECT rd.*
    FROM ranked_data rd, params p
    ORDER BY rd.rank
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
-- Enrich with simulation and cohort names
enriched_data AS (
    SELECT
        pd.*,
        -- Simulation names from array
        (
            SELECT ARRAY_AGG(sr.name ORDER BY sr.name)
            FROM unnest(pd.simulation_ids) AS sid
            JOIN simulations_resource sr ON sr.id = sid
        ) AS simulation_names,
        -- Cohort names from array
        (
            SELECT ARRAY_AGG(cr.name ORDER BY cr.name)
            FROM unnest(pd.cohort_ids) AS cid
            JOIN cohorts_resource cr ON cr.id = cid
        ) AS cohort_names
    FROM paginated_data pd
),
-- Summary statistics
summary_stats AS (
    SELECT
        COUNT(*)::int AS total_profiles,
        ROUND(AVG(bd.avg_score) FILTER (WHERE bd.avg_score IS NOT NULL), 2) AS avg_score_all,
        ROUND(AVG(bd.total_attempts)::numeric, 2) AS avg_attempts_per_profile,
        SUM(bd.perfect_score_count)::int AS total_perfect_scores,
        ROUND(AVG(bd.completion_pct) FILTER (WHERE bd.completion_pct IS NOT NULL), 2) AS avg_completion_pct
    FROM base_data bd
),
-- Cohort filter options (unnest from all profiles)
cohort_options AS (
    SELECT
        cr.id,
        cr.name,
        COUNT(DISTINCT bd.profile_id)::int AS count
    FROM base_data bd
    CROSS JOIN LATERAL unnest(bd.cohort_ids) AS cid
    JOIN cohorts_resource cr ON cr.id = cid
    GROUP BY cr.id, cr.name
    ORDER BY count DESC, name
    LIMIT 50
),
-- Simulation filter options (unnest from all profiles)
simulation_options AS (
    SELECT
        sr.id,
        sr.name,
        COUNT(DISTINCT bd.profile_id)::int AS count
    FROM base_data bd
    CROSS JOIN LATERAL unnest(bd.simulation_ids) AS sid
    JOIN simulations_resource sr ON sr.id = sid
    GROUP BY sr.id, sr.name
    ORDER BY count DESC, name
    LIMIT 50
)
SELECT
    (SELECT total_count FROM count_data),
    COALESCE(
        (SELECT ARRAY_AGG(
            (ed.profile_id, ed.attempt_type, ed.is_archived,
             ed.profile_name, ed.profile_type,
             ed.rank,
             ed.total_attempts, ed.avg_score, ed.highest_score, ed.completion_pct,
             ed.first_attempt_pass_rate, ed.avg_messages_per_session,
             ed.avg_persona_response_sec, ed.session_efficiency, ed.total_time_minutes,
             ed.improvement_rate, ed.perfect_score_count, ed.quickest_pass_minutes,
             ed.first_attempt_at, ed.last_attempt_at,
             ed.simulation_ids, ed.scenario_ids, ed.cohort_ids,
             ed.simulation_names, ed.cohort_names
            )::types.q_get_profile_metrics_v4_item
            ORDER BY ed.rank
        ) FROM enriched_data ed),
        ARRAY[]::types.q_get_profile_metrics_v4_item[]
    ),
    (SELECT (ss.total_profiles, ss.avg_score_all, ss.avg_attempts_per_profile,
             ss.total_perfect_scores, ss.avg_completion_pct
            )::types.q_get_profile_metrics_v4_summary
     FROM summary_stats ss),
    COALESCE(
        (SELECT ARRAY_AGG((co.id, co.name, co.count)::types.q_get_profile_metrics_v4_filter_option)
         FROM cohort_options co),
        ARRAY[]::types.q_get_profile_metrics_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((so.id, so.name, so.count)::types.q_get_profile_metrics_v4_filter_option)
         FROM simulation_options so),
        ARRAY[]::types.q_get_profile_metrics_v4_filter_option[]
    );
$$;
