-- ============================================================================
-- Query Function: api_get_chat_facts_v4
-- Filters and paginates mv_chat_facts for detailed chat-level analytics.
--
-- Used by: Dashboard Persona Chart, detailed analytics, chat-level reports
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
        WHERE proname = 'api_get_chat_facts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_facts_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_chat_facts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Filter option type (for dropdowns)
CREATE TYPE types.q_get_chat_facts_v4_filter_option AS (
    id uuid,
    name text,
    count int
);

-- Main item type
CREATE TYPE types.q_get_chat_facts_v4_item AS (
    -- Primary key
    chat_id uuid,
    -- Entry IDs
    attempt_id uuid,
    grade_id uuid,
    -- Resource IDs
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,
    role_id uuid,
    scenario_id uuid,
    persona_id uuid,
    rubric_id uuid,
    -- Resource metadata (JOINed)
    simulation_name text,
    profile_name text,
    cohort_name text,
    department_name text,
    scenario_name text,
    persona_name text,
    persona_color text,
    persona_icon text,
    -- Timestamps
    attempt_created_at timestamptz,
    chat_created_at timestamptz,
    grade_created_at timestamptz,
    -- Flags
    attempt_type text,
    is_archived boolean,
    infinite_mode boolean,
    completed boolean,
    -- Grade data
    score int,
    passed boolean,
    time_taken int,
    grade_percent numeric,
    rubric_total_points int,
    rubric_pass_points int,
    -- Message stats
    num_messages_total int,
    message_time_taken_seconds int[]
);

-- Aggregated metrics for persona chart
CREATE TYPE types.q_get_chat_facts_v4_persona_aggregate AS (
    persona_id uuid,
    persona_name text,
    persona_color text,
    persona_icon text,
    chat_count int,
    completed_count int,
    passed_count int,
    avg_score numeric,
    avg_time_seconds numeric
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_chat_facts_v4(
    -- Filter parameters
    profile_id_param uuid DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    attempt_type_param text DEFAULT NULL,
    show_archived boolean DEFAULT FALSE,
    infinite_mode_param boolean DEFAULT NULL,
    completed_only boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    search text DEFAULT NULL,
    -- Aggregation mode
    aggregate_by_persona boolean DEFAULT FALSE,
    -- Sorting
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    total_count int,
    items types.q_get_chat_facts_v4_item[],
    persona_aggregates types.q_get_chat_facts_v4_persona_aggregate[],
    simulation_options types.q_get_chat_facts_v4_filter_option[],
    scenario_options types.q_get_chat_facts_v4_filter_option[],
    persona_options types.q_get_chat_facts_v4_filter_option[],
    profile_options types.q_get_chat_facts_v4_filter_option[]
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
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        COALESCE(persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        attempt_type_param AS attempt_type,
        COALESCE(show_archived, FALSE) AS show_archived,
        infinite_mode_param AS infinite_mode,
        completed_only,
        COALESCE(date_from, '1970-01-01'::timestamptz) AS date_from,
        COALESCE(date_to, '2100-01-01'::timestamptz) AS date_to,
        search,
        COALESCE(aggregate_by_persona, FALSE) AS aggregate_by_persona,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
-- Base filtered data from MV with resource JOINs
base_data AS (
    SELECT
        mv.chat_id,
        mv.attempt_id,
        mv.grade_id,
        mv.simulation_id,
        mv.profile_id,
        mv.cohort_id,
        mv.department_id,
        mv.role_id,
        mv.scenario_id,
        mv.persona_id,
        mv.rubric_id,
        mv.attempt_created_at,
        mv.chat_created_at,
        mv.grade_created_at,
        mv.attempt_type,
        mv.is_archived,
        mv.infinite_mode,
        mv.completed,
        mv.score,
        mv.passed,
        mv.time_taken,
        mv.grade_percent,
        mv.rubric_total_points,
        mv.rubric_pass_points,
        mv.num_messages_total,
        mv.message_time_taken_seconds,
        -- Resource metadata
        sr.name AS simulation_name,
        pr.name AS profile_name,
        cr.name AS cohort_name,
        dr.name AS department_name,
        scr.name AS scenario_name,
        per.name AS persona_name,
        per.color AS persona_color,
        per.icon AS persona_icon
    FROM params p
    CROSS JOIN mv_chat_facts mv
    -- Resource JOINs for metadata
    JOIN simulations_resource sr ON sr.id = mv.simulation_id
    LEFT JOIN profiles_resource pr ON pr.id = mv.profile_id
    LEFT JOIN cohorts_resource cr ON cr.id = mv.cohort_id
    LEFT JOIN departments_resource dr ON dr.id = mv.department_id
    LEFT JOIN scenarios_resource scr ON scr.id = mv.scenario_id
    LEFT JOIN personas_resource per ON per.id = mv.persona_id
    WHERE
        -- Profile filter (single or array)
        (p.profile_id IS NOT NULL AND mv.profile_id = p.profile_id
         OR p.profile_id IS NULL AND (cardinality(p.profile_ids) = 0 OR mv.profile_id = ANY(p.profile_ids)))
        -- Simulation filter
        AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_id = ANY(p.simulation_ids))
        -- Cohort filter
        AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
        -- Department filter
        AND (cardinality(p.department_ids) = 0 OR mv.department_id = ANY(p.department_ids))
        -- Scenario filter
        AND (cardinality(p.scenario_ids) = 0 OR mv.scenario_id = ANY(p.scenario_ids))
        -- Persona filter
        AND (cardinality(p.persona_ids) = 0 OR mv.persona_id = ANY(p.persona_ids))
        -- Attempt type filter
        AND (p.attempt_type IS NULL OR mv.attempt_type = p.attempt_type)
        -- Archived filter
        AND (p.show_archived OR mv.is_archived = FALSE)
        -- Infinite mode filter
        AND (p.infinite_mode IS NULL OR mv.infinite_mode = p.infinite_mode)
        -- Completed filter
        AND (p.completed_only IS NULL OR mv.completed = p.completed_only)
        -- Date range filter
        AND mv.chat_created_at >= p.date_from
        AND mv.chat_created_at < p.date_to
        -- Search filter (simulation or scenario name)
        AND (p.search IS NULL OR sr.name ILIKE '%' || p.search || '%' OR scr.name ILIKE '%' || p.search || '%')
),
-- Total count
count_data AS (
    SELECT COUNT(*)::int AS total_count FROM base_data
),
-- Sorted and paginated data (only when not aggregating)
sorted_data AS (
    SELECT bd.*
    FROM base_data bd, params p
    WHERE NOT p.aggregate_by_persona
    ORDER BY
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'desc' THEN bd.chat_created_at END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'asc' THEN bd.chat_created_at END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'desc' THEN bd.grade_percent END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'asc' THEN bd.grade_percent END ASC NULLS LAST,
        bd.chat_created_at DESC NULLS LAST
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
-- Persona aggregates (for persona chart)
persona_agg AS (
    SELECT
        bd.persona_id,
        bd.persona_name,
        bd.persona_color,
        bd.persona_icon,
        COUNT(*)::int AS chat_count,
        COUNT(*) FILTER (WHERE bd.completed = TRUE)::int AS completed_count,
        COUNT(*) FILTER (WHERE bd.passed = TRUE)::int AS passed_count,
        ROUND(AVG(bd.grade_percent) FILTER (WHERE bd.grade_percent IS NOT NULL), 2) AS avg_score,
        ROUND(AVG(bd.time_taken) FILTER (WHERE bd.time_taken IS NOT NULL), 2) AS avg_time_seconds
    FROM base_data bd, params p
    WHERE bd.persona_id IS NOT NULL
    GROUP BY bd.persona_id, bd.persona_name, bd.persona_color, bd.persona_icon
    ORDER BY chat_count DESC
),
-- Simulation filter options
simulation_options AS (
    SELECT
        bd.simulation_id AS id,
        bd.simulation_name AS name,
        COUNT(*)::int AS count
    FROM base_data bd
    GROUP BY bd.simulation_id, bd.simulation_name
    ORDER BY count DESC, name
    LIMIT 50
),
-- Scenario filter options
scenario_options AS (
    SELECT
        bd.scenario_id AS id,
        bd.scenario_name AS name,
        COUNT(*)::int AS count
    FROM base_data bd
    WHERE bd.scenario_name IS NOT NULL
    GROUP BY bd.scenario_id, bd.scenario_name
    ORDER BY count DESC, name
    LIMIT 50
),
-- Persona filter options
persona_filter_options AS (
    SELECT
        bd.persona_id AS id,
        bd.persona_name AS name,
        COUNT(*)::int AS count
    FROM base_data bd
    WHERE bd.persona_name IS NOT NULL
    GROUP BY bd.persona_id, bd.persona_name
    ORDER BY count DESC, name
    LIMIT 50
),
-- Profile filter options
profile_options AS (
    SELECT
        bd.profile_id AS id,
        bd.profile_name AS name,
        COUNT(*)::int AS count
    FROM base_data bd
    WHERE bd.profile_name IS NOT NULL
    GROUP BY bd.profile_id, bd.profile_name
    ORDER BY count DESC, name
    LIMIT 50
)
SELECT
    (SELECT total_count FROM count_data),
    -- Items (only when not aggregating by persona)
    CASE WHEN NOT (SELECT aggregate_by_persona FROM params)
    THEN COALESCE(
        (SELECT ARRAY_AGG(
            (sd.chat_id, sd.attempt_id, sd.grade_id,
             sd.simulation_id, sd.profile_id, sd.cohort_id, sd.department_id, sd.role_id,
             sd.scenario_id, sd.persona_id, sd.rubric_id,
             sd.simulation_name, sd.profile_name, sd.cohort_name, sd.department_name,
             sd.scenario_name, sd.persona_name, sd.persona_color, sd.persona_icon,
             sd.attempt_created_at, sd.chat_created_at, sd.grade_created_at,
             sd.attempt_type, sd.is_archived, sd.infinite_mode, sd.completed,
             sd.score, sd.passed, sd.time_taken, sd.grade_percent,
             sd.rubric_total_points, sd.rubric_pass_points,
             sd.num_messages_total, sd.message_time_taken_seconds
            )::types.q_get_chat_facts_v4_item
        ) FROM sorted_data sd),
        ARRAY[]::types.q_get_chat_facts_v4_item[]
    )
    ELSE ARRAY[]::types.q_get_chat_facts_v4_item[]
    END,
    -- Persona aggregates
    COALESCE(
        (SELECT ARRAY_AGG(
            (pa.persona_id, pa.persona_name, pa.persona_color, pa.persona_icon,
             pa.chat_count, pa.completed_count, pa.passed_count,
             pa.avg_score, pa.avg_time_seconds
            )::types.q_get_chat_facts_v4_persona_aggregate
        ) FROM persona_agg pa),
        ARRAY[]::types.q_get_chat_facts_v4_persona_aggregate[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((so.id, so.name, so.count)::types.q_get_chat_facts_v4_filter_option)
         FROM simulation_options so),
        ARRAY[]::types.q_get_chat_facts_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((sco.id, sco.name, sco.count)::types.q_get_chat_facts_v4_filter_option)
         FROM scenario_options sco),
        ARRAY[]::types.q_get_chat_facts_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((pfo.id, pfo.name, pfo.count)::types.q_get_chat_facts_v4_filter_option)
         FROM persona_filter_options pfo),
        ARRAY[]::types.q_get_chat_facts_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((po.id, po.name, po.count)::types.q_get_chat_facts_v4_filter_option)
         FROM profile_options po),
        ARRAY[]::types.q_get_chat_facts_v4_filter_option[]
    );
$$;
