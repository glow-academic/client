-- ============================================================================
-- Query: get_analytics_attempts_view
-- Purpose: Fetch paginated attempt-level data from mv_attempt_facts
-- Section: VIEWS/ANALYTICS/ATTEMPTS
--
-- Includes:
-- - Filtering (profile, attempt_type, archived, simulation, cohort, department, scenario, date, infinite_mode)
-- - Sorting (date, score)
-- - Pagination
-- - Filter options (simulation_options, scenario_options, profile_options)
--
-- Note: Returns resource IDs only. Metadata (names, colors) fetched via internal handlers.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_analytics_attempts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_attempts_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_analytics_attempts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Attempt facts item with all MV columns
CREATE TYPE types.q_get_analytics_attempts_view_v4_item AS (
    -- Primary key
    attempt_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    profile_id uuid,
    simulation_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Timestamps
    attempt_created_at timestamptz,

    -- Flags
    attempt_type text,              -- 'general' | 'practice'
    is_archived boolean,
    infinite_mode boolean,

    -- Metrics (aggregated from chats)
    num_chats int,
    num_chats_completed int,
    num_scenarios int,
    num_scenarios_completed int,
    score_percent numeric,
    has_passed boolean,
    total_time_seconds int,

    -- Rubric points
    rubric_total_points int,
    rubric_pass_points int,

    -- Arrays for display/filtering
    scenario_ids uuid[],
    persona_ids uuid[]
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_analytics_attempts_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_analytics_attempts_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,      -- 'general' | 'practice' | NULL (both)
    is_archived_filter boolean DEFAULT FALSE,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    infinite_mode boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    search text DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_analytics_attempts_view_v4_item[],
    total_count int,
    simulation_options types.q_get_analytics_attempts_view_v4_option[],
    scenario_options types.q_get_analytics_attempts_view_v4_option[],
    profile_options types.q_get_analytics_attempts_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to mv_attempt_facts
    filtered AS (
        SELECT
            af.attempt_id,
            af.profile_id,
            af.simulation_id,
            af.cohort_id,
            af.department_id,
            af.attempt_created_at,
            af.attempt_type,
            af.is_archived,
            af.infinite_mode,
            af.num_chats,
            af.num_chats_completed,
            af.num_scenarios,
            af.num_scenarios_completed,
            af.score_percent,
            af.has_passed,
            af.total_time_seconds,
            af.rubric_total_points,
            af.rubric_pass_points,
            af.scenario_ids,
            af.persona_ids
        FROM mv_attempt_facts af
        WHERE
            -- Profile filter
            (profile_id_filter IS NULL OR af.profile_id = profile_id_filter)
            -- Attempt type filter
            AND (attempt_type_filter IS NULL OR af.attempt_type = attempt_type_filter)
            -- Archived filter (default excludes archived)
            AND af.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Simulation IDs filter
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR af.simulation_id = ANY(simulation_ids))
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR af.cohort_id = ANY(cohort_ids))
            -- Department IDs filter
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR af.department_id = ANY(department_ids))
            -- Scenario IDs filter (matches if any scenario overlaps)
            AND (scenario_ids IS NULL OR cardinality(scenario_ids) = 0 OR af.scenario_ids && scenario_ids)
            -- Infinite mode filter
            AND (infinite_mode IS NULL OR af.infinite_mode = infinite_mode)
            -- Date range filter
            AND (date_from IS NULL OR af.attempt_created_at >= date_from)
            AND (date_to IS NULL OR af.attempt_created_at < date_to)
            -- Search filter (placeholder - would need resource JOINs for name search)
            -- For now, search is not implemented at MV level
    ),
    -- Count total before pagination
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    -- Sort and paginate
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            CASE WHEN sort_by = 'date' AND sort_order = 'desc'
                 THEN attempt_created_at END DESC NULLS LAST,
            CASE WHEN sort_by = 'date' AND sort_order = 'asc'
                 THEN attempt_created_at END ASC NULLS LAST,
            CASE WHEN sort_by = 'score' AND sort_order = 'desc'
                 THEN score_percent END DESC NULLS LAST,
            CASE WHEN sort_by = 'score' AND sort_order = 'asc'
                 THEN score_percent END ASC NULLS LAST,
            -- Secondary sort by attempt_id for stability
            attempt_id DESC
        LIMIT page_limit
        OFFSET page_offset
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    attempt_id,
                    profile_id,
                    simulation_id,
                    cohort_id,
                    department_id,
                    attempt_created_at,
                    attempt_type,
                    is_archived,
                    infinite_mode,
                    num_chats,
                    num_chats_completed,
                    num_scenarios,
                    num_scenarios_completed,
                    score_percent,
                    has_passed,
                    total_time_seconds,
                    rubric_total_points,
                    rubric_pass_points,
                    scenario_ids,
                    persona_ids
                )::types.q_get_analytics_attempts_view_v4_item
            ),
            ARRAY[]::types.q_get_analytics_attempts_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Simulation filter options (from filtered, not sorted)
    simulation_options_cte AS (
        SELECT
            f.simulation_id::text AS value,
            f.simulation_id::text AS label,  -- Label will be resolved by client/handler
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        WHERE f.simulation_id IS NOT NULL
        GROUP BY f.simulation_id
        ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_attempts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_attempts_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Scenario filter options (from filtered, unnested)
    scenario_options_cte AS (
        SELECT
            s_id::text AS value,
            s_id::text AS label,  -- Label will be resolved by client/handler
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        CROSS JOIN LATERAL unnest(f.scenario_ids) AS s_id
        WHERE f.scenario_ids IS NOT NULL
        GROUP BY s_id
        ORDER BY count DESC, value
    ),
    scenario_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_attempts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_attempts_view_v4_option[]
        ) AS options
        FROM scenario_options_cte
    ),
    -- Profile filter options (from filtered)
    profile_options_cte AS (
        SELECT
            f.profile_id::text AS value,
            f.profile_id::text AS label,  -- Label will be resolved by client/handler
            COUNT(DISTINCT f.attempt_id)::int AS count
        FROM filtered f
        WHERE f.profile_id IS NOT NULL
        GROUP BY f.profile_id
        ORDER BY count DESC, value
    ),
    profile_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_attempts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_attempts_view_v4_option[]
        ) AS options
        FROM profile_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM scenario_options_agg),
        (SELECT options FROM profile_options_agg);
$$;
