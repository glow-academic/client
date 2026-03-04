-- ============================================================================
-- Query: get_chat_view
-- Purpose: Fetch filtered chat-grain rows from attempt_chat_mv
-- Section: VIEWS/CHAT
--
-- Unified query replacing 4 separate analytics fact view queries + attempt chats.
-- Returns chat-grain rows with resource IDs only.
-- All aggregation done in Python by consuming artifact endpoints.
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
        WHERE proname = 'api_get_chat_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_chat_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_chat_view_v4_item AS (
    -- Primary key
    chat_id uuid,

    -- Foreign keys
    attempt_id uuid,
    group_id uuid,
    attempt_chat_id uuid,

    -- Resource IDs
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    rubric_id uuid,

    -- Grade measures
    grade_score int,
    grade_total_points int,
    grade_pass_points int,
    grade_passed boolean,
    grade_time_taken int,

    -- Chat state
    completed boolean,
    attempt_number int,

    -- Timestamps
    chat_created_at timestamptz,
    attempt_date date,

    -- Filters
    attempt_type text,
    is_archived boolean,
    infinite_mode boolean,

    -- Array fields
    persona_ids uuid[]
);

-- Filter option type for dropdowns
CREATE TYPE types.q_get_chat_view_v4_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_chat_view_v4(
    -- Filters
    profile_id_filter uuid DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    rubric_ids uuid[] DEFAULT NULL,
    attempt_id_filter uuid DEFAULT NULL,
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
    items types.q_get_chat_view_v4_item[],
    total_count int,
    simulation_options types.q_get_chat_view_v4_option[],
    cohort_options types.q_get_chat_view_v4_option[],
    department_options types.q_get_chat_view_v4_option[],
    scenario_options types.q_get_chat_view_v4_option[],
    persona_options types.q_get_chat_view_v4_option[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Apply all filters to attempt_chat_mv
    filtered AS (
        SELECT
            ch.chat_id,
            ch.attempt_id,
            ch.group_id,
            ch.chat_id AS attempt_chat_id,
            ch.profile_id,
            ch.cohort_id,
            ch.department_id,
            ch.simulation_id,
            ch.scenario_id,
            ch.rubric_id,
            ch.grade_score,
            ch.grade_total_points,
            ch.grade_pass_points,
            ch.grade_passed,
            ch.grade_time_taken,
            ch.completed,
            ch.attempt_number,
            ch.chat_created_at,
            ch.attempt_date,
            ch.attempt_type,
            ch.is_archived,
            ch.infinite_mode,
            ch.persona_ids
        FROM attempt_chat_mv ch
        WHERE
            (profile_id_filter IS NULL OR ch.profile_id = profile_id_filter)
            AND (cohort_ids IS NULL OR cardinality(cohort_ids) = 0 OR ch.cohort_id = ANY(cohort_ids))
            AND (department_ids IS NULL OR cardinality(department_ids) = 0 OR ch.department_id = ANY(department_ids))
            AND (simulation_ids IS NULL OR cardinality(simulation_ids) = 0 OR ch.simulation_id = ANY(simulation_ids))
            AND (scenario_ids IS NULL OR cardinality(scenario_ids) = 0 OR ch.scenario_id = ANY(scenario_ids))
            AND (rubric_ids IS NULL OR cardinality(rubric_ids) = 0 OR ch.rubric_id = ANY(rubric_ids))
            AND (attempt_id_filter IS NULL OR ch.attempt_id = attempt_id_filter)
            AND (attempt_type_filter IS NULL OR ch.attempt_type = attempt_type_filter)
            AND ch.is_archived = COALESCE(is_archived_filter, FALSE)
            AND (date_from IS NULL OR ch.attempt_date >= date_from)
            AND (date_to IS NULL OR ch.attempt_date <= date_to)
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
            CASE WHEN sort_by = 'created_at' AND sort_order = 'desc'
                 THEN chat_created_at END DESC NULLS LAST,
            CASE WHEN sort_by = 'created_at' AND sort_order = 'asc'
                 THEN chat_created_at END ASC NULLS LAST,
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
                    group_id,
                    attempt_chat_id,
                    profile_id,
                    cohort_id,
                    department_id,
                    simulation_id,
                    scenario_id,
                    rubric_id,
                    grade_score,
                    grade_total_points,
                    grade_pass_points,
                    grade_passed,
                    grade_time_taken,
                    completed,
                    attempt_number,
                    chat_created_at,
                    attempt_date,
                    attempt_type,
                    is_archived,
                    infinite_mode,
                    persona_ids
                )::types.q_get_chat_view_v4_item
            ),
            ARRAY[]::types.q_get_chat_view_v4_item[]
        ) AS items
        FROM sorted
    ),
    -- Simulation filter options
    simulation_options_cte AS (
        SELECT
            f.simulation_id::text AS value,
            f.simulation_id::text AS label,
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.simulation_id IS NOT NULL
        GROUP BY f.simulation_id
        ORDER BY count DESC, value
    ),
    simulation_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_chat_view_v4_option),
            ARRAY[]::types.q_get_chat_view_v4_option[]
        ) AS options
        FROM simulation_options_cte
    ),
    -- Cohort filter options
    cohort_options_cte AS (
        SELECT
            f.cohort_id::text AS value,
            f.cohort_id::text AS label,
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.cohort_id IS NOT NULL
        GROUP BY f.cohort_id
        ORDER BY count DESC, value
    ),
    cohort_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_chat_view_v4_option),
            ARRAY[]::types.q_get_chat_view_v4_option[]
        ) AS options
        FROM cohort_options_cte
    ),
    -- Department filter options
    department_options_cte AS (
        SELECT
            f.department_id::text AS value,
            f.department_id::text AS label,
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.department_id IS NOT NULL
        GROUP BY f.department_id
        ORDER BY count DESC, value
    ),
    department_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_chat_view_v4_option),
            ARRAY[]::types.q_get_chat_view_v4_option[]
        ) AS options
        FROM department_options_cte
    ),
    -- Scenario filter options
    scenario_options_cte AS (
        SELECT
            f.scenario_id::text AS value,
            f.scenario_id::text AS label,
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f
        WHERE f.scenario_id IS NOT NULL
        GROUP BY f.scenario_id
        ORDER BY count DESC, value
    ),
    scenario_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_chat_view_v4_option),
            ARRAY[]::types.q_get_chat_view_v4_option[]
        ) AS options
        FROM scenario_options_cte
    ),
    -- Persona filter options
    persona_options_cte AS (
        SELECT
            persona_id::text AS value,
            persona_id::text AS label,
            COUNT(DISTINCT f.chat_id)::int AS count
        FROM filtered f, UNNEST(f.persona_ids) AS persona_id
        GROUP BY persona_id
        ORDER BY count DESC, value
    ),
    persona_options_agg AS (
        SELECT COALESCE(
            ARRAY_AGG((value, label, count)::types.q_get_chat_view_v4_option),
            ARRAY[]::types.q_get_chat_view_v4_option[]
        ) AS options
        FROM persona_options_cte
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted),
        (SELECT options FROM simulation_options_agg),
        (SELECT options FROM cohort_options_agg),
        (SELECT options FROM department_options_agg),
        (SELECT options FROM scenario_options_agg),
        (SELECT options FROM persona_options_agg);
$$;
