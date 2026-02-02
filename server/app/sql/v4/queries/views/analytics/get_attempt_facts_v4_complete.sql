-- ============================================================================
-- Query Function: api_get_attempt_facts_v4
-- Filters and paginates mv_attempt_facts for history tables and overview cards.
--
-- Used by: Home History, Practice History, Dashboard History, Overview Cards
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
        WHERE proname = 'api_get_attempt_facts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_facts_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_attempt_facts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Filter option type (for dropdowns)
CREATE TYPE types.q_get_attempt_facts_v4_filter_option AS (
    id uuid,
    name text,
    count int
);

-- Main item type
CREATE TYPE types.q_get_attempt_facts_v4_item AS (
    -- Primary key
    attempt_id uuid,
    -- Resource IDs
    profile_id uuid,
    simulation_id uuid,
    cohort_id uuid,
    department_id uuid,
    -- Resource metadata (JOINed from _resource tables)
    simulation_name text,
    profile_name text,
    cohort_name text,
    department_name text,
    -- Timestamps
    attempt_created_at timestamptz,
    -- Flags
    attempt_type text,
    is_archived boolean,
    infinite_mode boolean,
    -- Aggregated metrics
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
    -- Arrays
    scenario_ids uuid[],
    persona_ids uuid[],
    scenario_names text[],
    persona_names text[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_attempt_facts_v4(
    -- Filter parameters
    profile_id_param uuid DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    attempt_type_param text DEFAULT NULL,
    show_archived boolean DEFAULT FALSE,
    infinite_mode_param boolean DEFAULT NULL,
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
    total_count int,
    items types.q_get_attempt_facts_v4_item[],
    simulation_options types.q_get_attempt_facts_v4_filter_option[],
    scenario_options types.q_get_attempt_facts_v4_filter_option[],
    profile_options types.q_get_attempt_facts_v4_filter_option[]
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
        attempt_type_param AS attempt_type,
        COALESCE(show_archived, FALSE) AS show_archived,
        infinite_mode_param AS infinite_mode,
        COALESCE(date_from, '1970-01-01'::timestamptz) AS date_from,
        COALESCE(date_to, '2100-01-01'::timestamptz) AS date_to,
        search,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset
),
-- Base filtered data from MV with resource JOINs
base_data AS (
    SELECT
        mv.attempt_id,
        mv.profile_id,
        mv.simulation_id,
        mv.cohort_id,
        mv.department_id,
        mv.attempt_created_at,
        mv.attempt_type,
        mv.is_archived,
        mv.infinite_mode,
        mv.num_chats,
        mv.num_chats_completed,
        mv.num_scenarios,
        mv.num_scenarios_completed,
        mv.score_percent,
        mv.has_passed,
        mv.total_time_seconds,
        mv.rubric_total_points,
        mv.rubric_pass_points,
        mv.scenario_ids,
        mv.persona_ids,
        -- Resource metadata
        sr.name AS simulation_name,
        pr.name AS profile_name,
        cr.name AS cohort_name,
        dr.name AS department_name
    FROM params p
    CROSS JOIN mv_attempt_facts mv
    -- Resource JOINs for metadata
    JOIN simulations_resource sr ON sr.id = mv.simulation_id
    LEFT JOIN profiles_resource pr ON pr.id = mv.profile_id
    LEFT JOIN cohorts_resource cr ON cr.id = mv.cohort_id
    LEFT JOIN departments_resource dr ON dr.id = mv.department_id
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
        -- Scenario filter (any match in array)
        AND (cardinality(p.scenario_ids) = 0 OR mv.scenario_ids && p.scenario_ids)
        -- Attempt type filter
        AND (p.attempt_type IS NULL OR mv.attempt_type = p.attempt_type)
        -- Archived filter
        AND (p.show_archived OR mv.is_archived = FALSE)
        -- Infinite mode filter
        AND (p.infinite_mode IS NULL OR mv.infinite_mode = p.infinite_mode)
        -- Date range filter
        AND mv.attempt_created_at >= p.date_from
        AND mv.attempt_created_at < p.date_to
        -- Search filter (simulation name)
        AND (p.search IS NULL OR sr.name ILIKE '%' || p.search || '%')
),
-- Total count
count_data AS (
    SELECT COUNT(*)::int AS total_count FROM base_data
),
-- Sorted and paginated data
sorted_data AS (
    SELECT bd.*
    FROM base_data bd, params p
    ORDER BY
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'desc' THEN bd.attempt_created_at END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'asc' THEN bd.attempt_created_at END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'desc' THEN bd.score_percent END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'asc' THEN bd.score_percent END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'name' AND p.sort_order = 'desc' THEN bd.simulation_name END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'name' AND p.sort_order = 'asc' THEN bd.simulation_name END ASC NULLS LAST,
        bd.attempt_created_at DESC NULLS LAST
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),
-- Enrich with scenario/persona names
enriched_data AS (
    SELECT
        sd.*,
        -- Scenario names from array
        (
            SELECT ARRAY_AGG(scr.name ORDER BY scr.name)
            FROM unnest(sd.scenario_ids) AS sid
            JOIN scenarios_resource scr ON scr.id = sid
        ) AS scenario_names,
        -- Persona names from array
        (
            SELECT ARRAY_AGG(per.name ORDER BY per.name)
            FROM unnest(sd.persona_ids) AS pid
            JOIN personas_resource per ON per.id = pid
        ) AS persona_names
    FROM sorted_data sd
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
-- Scenario filter options (unnest scenario_ids)
scenario_options AS (
    SELECT
        scr.id,
        scr.name,
        COUNT(DISTINCT bd.attempt_id)::int AS count
    FROM base_data bd
    CROSS JOIN LATERAL unnest(bd.scenario_ids) AS sid
    JOIN scenarios_resource scr ON scr.id = sid
    GROUP BY scr.id, scr.name
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
    COALESCE(
        (SELECT ARRAY_AGG(
            (ed.attempt_id, ed.profile_id, ed.simulation_id, ed.cohort_id, ed.department_id,
             ed.simulation_name, ed.profile_name, ed.cohort_name, ed.department_name,
             ed.attempt_created_at, ed.attempt_type, ed.is_archived, ed.infinite_mode,
             ed.num_chats, ed.num_chats_completed, ed.num_scenarios, ed.num_scenarios_completed,
             ed.score_percent, ed.has_passed, ed.total_time_seconds,
             ed.rubric_total_points, ed.rubric_pass_points,
             ed.scenario_ids, ed.persona_ids, ed.scenario_names, ed.persona_names
            )::types.q_get_attempt_facts_v4_item
        ) FROM enriched_data ed),
        ARRAY[]::types.q_get_attempt_facts_v4_item[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((so.id, so.name, so.count)::types.q_get_attempt_facts_v4_filter_option)
         FROM simulation_options so),
        ARRAY[]::types.q_get_attempt_facts_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((sco.id, sco.name, sco.count)::types.q_get_attempt_facts_v4_filter_option)
         FROM scenario_options sco),
        ARRAY[]::types.q_get_attempt_facts_v4_filter_option[]
    ),
    COALESCE(
        (SELECT ARRAY_AGG((po.id, po.name, po.count)::types.q_get_attempt_facts_v4_filter_option)
         FROM profile_options po),
        ARRAY[]::types.q_get_attempt_facts_v4_filter_option[]
    );
$$;
