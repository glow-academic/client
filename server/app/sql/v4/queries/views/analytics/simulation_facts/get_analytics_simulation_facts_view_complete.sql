-- ============================================================================
-- Query: get_analytics_simulation_facts_view
-- Purpose: Fetch paginated simulation-level data from mv_simulation_facts
-- Section: VIEWS/ANALYTICS/SIMULATION_FACTS
--
-- Includes:
-- - Filtering (profile, cohort, simulation, scenario, attempt_type, archived, date range)
-- - Sorting (date)
-- - Pagination
-- - Filter options (simulation_options, scenario_options)
--
-- Note: Returns resource IDs only. Parameter resolution done at runtime via
-- hydrated scenario/persona/document resources (denormalized parameter_field_ids[]).
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
        WHERE proname = 'api_get_analytics_simulation_facts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_analytics_simulation_facts_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_analytics_simulation_facts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Simulation facts item with all MV columns
CREATE TYPE types.q_get_analytics_simulation_facts_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    attempt_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    persona_id uuid,
    document_ids uuid[],
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Measures
    grade_percent numeric,
    passed boolean,
    completed boolean,

    -- Timestamps
    attempt_date date,

    -- Filters
    attempt_type text,              -- 'general' | 'practice'
    is_archived boolean
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_analytics_simulation_facts_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_analytics_simulation_facts_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    attempt_type_filter text DEFAULT NULL,      -- 'general' | 'practice' | NULL (both)
    is_archived_filter boolean DEFAULT FALSE,
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 10000,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_analytics_simulation_facts_view_v4_item[],
    total_count int,
    department_options types.q_get_analytics_simulation_facts_view_v4_option[],
    simulation_options types.q_get_analytics_simulation_facts_view_v4_option[],
    scenario_options types.q_get_analytics_simulation_facts_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to mv_simulation_facts
    filtered AS (
        SELECT
            sf.chat_id,
            sf.attempt_id,
            sf.simulation_id,
            sf.scenario_id,
            sf.persona_id,
            sf.document_ids,
            sf.profile_id,
            sf.cohort_id,
            sf.department_id,
            sf.grade_percent,
            sf.passed,
            sf.completed,
            sf.attempt_date,
            sf.attempt_type,
            sf.is_archived
        FROM mv_simulation_facts sf
        WHERE
            -- Profile filter
            (profile_id_filter IS NULL OR sf.profile_id = profile_id_filter)
            -- Cohort IDs filter
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR sf.cohort_id = ANY(cohort_ids))
            -- Department IDs filter
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR sf.department_id = ANY(department_ids))
            -- Simulation IDs filter
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR sf.simulation_id = ANY(simulation_ids))
            -- Scenario IDs filter
            AND (scenario_ids IS NULL OR cardinality(scenario_ids) = 0 OR sf.scenario_id = ANY(scenario_ids))
            -- Attempt type filter
            AND (attempt_type_filter IS NULL OR sf.attempt_type = attempt_type_filter)
            -- Archived filter (default excludes archived)
            AND sf.is_archived = COALESCE(is_archived_filter, FALSE)
            -- Date range filter
            AND (date_from IS NULL OR sf.attempt_date >= date_from)
            AND (date_to IS NULL OR sf.attempt_date <= date_to)
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
                 THEN attempt_date END DESC NULLS LAST,
            CASE WHEN sort_by = 'date' AND sort_order = 'asc'
                 THEN attempt_date END ASC NULLS LAST,
            -- Secondary sort by chat_id for stability
            chat_id DESC
        LIMIT page_limit
        OFFSET page_offset
    ),
    -- Aggregate items into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    chat_id,
                    attempt_id,
                    simulation_id,
                    scenario_id,
                    persona_id,
                    document_ids,
                    profile_id,
                    cohort_id,
                    department_id,
                    grade_percent,
                    passed,
                    completed,
                    attempt_date,
                    attempt_type,
                    is_archived
                )::types.q_get_analytics_simulation_facts_view_v4_item
            ),
            ARRAY[]::types.q_get_analytics_simulation_facts_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Department filter options (from filtered, not sorted)
    department_options_cte AS (
        SELECT
            f.department_id::text AS value,
            f.department_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.department_id IS NOT NULL
        GROUP BY f.department_id
        ORDER BY count DESC, value
    ),
    department_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_simulation_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_simulation_facts_view_v4_option[]
        ) AS options
        FROM department_options_cte
    ),
    -- Simulation filter options (from filtered, not sorted)
    simulation_options_cte AS (
        SELECT
            f.simulation_id::text AS value,
            f.simulation_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.simulation_id IS NOT NULL
        GROUP BY f.simulation_id
        ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_simulation_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_simulation_facts_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Scenario filter options (from filtered, not sorted)
    scenario_options_cte AS (
        SELECT
            f.scenario_id::text AS value,
            f.scenario_id::text AS label,  -- Label resolved by handler
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.scenario_id IS NOT NULL
        GROUP BY f.scenario_id
        ORDER BY count DESC, value
    ),
    scenario_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (value, label, count)::types.q_get_analytics_simulation_facts_view_v4_option
            ),
            ARRAY[]::types.q_get_analytics_simulation_facts_view_v4_option[]
        ) AS options
        FROM scenario_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM department_options_agg),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM scenario_options_agg);
$$;
