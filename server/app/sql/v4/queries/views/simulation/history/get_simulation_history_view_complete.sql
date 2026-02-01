-- ============================================================================
-- Query: get_simulation_history_view
-- Purpose: Fetch paginated attempt history from mv_simulation_history with resource JOINs
-- Section: VIEWS/SIMULATION/HISTORY
--
-- Includes:
-- - Filtering (date, cohort, department, simulation, scenario, search, infinite_mode, archived, profile_ids)
-- - Sorting and pagination
-- - Filter options (simulation_options, scenario_options, profile_options)
-- - All metadata JOINed
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
        WHERE proname = 'api_get_simulation_history_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_history_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_history_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Attempt data with all metadata JOINed
CREATE TYPE types.q_get_simulation_history_view_v4_item AS (
    -- Primary key
    attempt_id uuid,

    -- Keys for filtering
    profile_id uuid,
    simulation_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Resource metadata (JOINed)
    simulation_name text,
    profile_name text,
    cohort_name text,
    department_name text,
    persona_color text,
    persona_icon text,
    time_limit int,

    -- Timestamps
    attempt_created_at timestamptz,

    -- Flags
    practice boolean,
    infinite_mode boolean,
    is_archived boolean,

    -- Metrics
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

    -- Arrays for display
    scenario_ids uuid[],
    persona_ids uuid[],
    scenario_names text[],
    persona_names text[],
    persona_colors text[],
    department_ids uuid[]
);

-- Filter option for dropdowns
CREATE TYPE types.q_get_simulation_history_view_v4_filter_option AS (
    value text,
    label text,
    count int
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_history_view_v4(
    profile_id_filter uuid DEFAULT NULL,
    simulation_ids uuid[] DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    practice_filter boolean DEFAULT NULL,
    date_from timestamptz DEFAULT NULL,
    date_to timestamptz DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    infinite_mode boolean DEFAULT NULL,
    search text DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page_limit int DEFAULT 50,
    page_offset int DEFAULT 0,
    -- New parameters for practice mode support
    profile_ids uuid[] DEFAULT NULL,
    show_archived boolean DEFAULT FALSE
)
RETURNS TABLE (
    actor_name text,
    total_count int,
    items types.q_get_simulation_history_view_v4_item[],
    simulation_options types.q_get_simulation_history_view_v4_filter_option[],
    scenario_options types.q_get_simulation_history_view_v4_filter_option[],
    profile_options types.q_get_simulation_history_view_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        practice_filter AS practice_filter,
        COALESCE(date_from, NOW() - INTERVAL '1 year') AS date_from,
        COALESCE(date_to, NOW() + INTERVAL '1 day') AS date_to,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        infinite_mode AS infinite_mode,
        NULLIF(TRIM(search), '') AS search,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_limit, 50) AS page_limit,
        COALESCE(page_offset, 0) AS page_offset,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(show_archived, FALSE) AS show_archived
),

-- Get profile info (for actor_name)
profile_info AS (
    SELECT
        pr.id,
        pr.name
    FROM profiles_resource pr, params p
    WHERE pr.id = p.profile_id
      AND pr.active = true
),

-- Base attempt data from MV with simulation JOIN for filtering/sorting
base_attempts AS (
    SELECT
        mv.attempt_id,
        mv.attempt_created_at,
        mv.profile_id,
        mv.simulation_id,
        mv.cohort_id,
        mv.department_id,
        mv.practice,
        mv.infinite_mode,
        mv.is_archived,
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
        -- JOIN simulation for name (needed for search/sort)
        sr.name AS simulation_name,
        sr.department_ids AS sim_department_ids
    FROM params p
    CROSS JOIN mv_simulation_history mv
    JOIN simulations_resource sr ON sr.id = mv.simulation_id AND sr.active = true
    WHERE
      -- Profile filter: if profile_ids array specified, use those; otherwise use single profile_id
      (
          cardinality(p.profile_ids) > 0 AND mv.profile_id = ANY(p.profile_ids)
          OR cardinality(p.profile_ids) = 0 AND (p.profile_id IS NULL OR mv.profile_id = p.profile_id)
      )
      -- Practice filter
      AND (p.practice_filter IS NULL OR mv.practice = p.practice_filter)
      -- Archived filter
      AND (p.show_archived OR NOT mv.is_archived)
      -- Date filter
      AND mv.attempt_created_at >= p.date_from
      AND mv.attempt_created_at < p.date_to
      -- Cohort filter
      AND (cardinality(p.cohort_ids) = 0 OR mv.cohort_id = ANY(p.cohort_ids))
      -- Department filter
      AND (cardinality(p.department_ids) = 0 OR mv.department_id = ANY(p.department_ids))
      -- Simulation filter
      AND (cardinality(p.simulation_ids) = 0 OR mv.simulation_id = ANY(p.simulation_ids))
      -- Scenario filter (any match)
      AND (cardinality(p.scenario_ids) = 0 OR mv.scenario_ids && p.scenario_ids)
      -- Infinite mode filter
      AND (p.infinite_mode IS NULL OR mv.infinite_mode = p.infinite_mode)
      -- Search filter (simulation name)
      AND (p.search IS NULL OR sr.name ILIKE '%' || p.search || '%')
),

-- Count total before pagination
total_count_cte AS (
    SELECT COUNT(*)::int AS total_count FROM base_attempts
),

-- Sort and paginate
sorted_paginated AS (
    SELECT ba.*
    FROM base_attempts ba, params p
    ORDER BY
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'desc' THEN ba.attempt_created_at END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'date' AND p.sort_order = 'asc' THEN ba.attempt_created_at END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'desc' THEN ba.score_percent END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'score' AND p.sort_order = 'asc' THEN ba.score_percent END ASC NULLS LAST,
        CASE WHEN p.sort_by = 'simulation_name' AND p.sort_order = 'desc' THEN ba.simulation_name END DESC NULLS LAST,
        CASE WHEN p.sort_by = 'simulation_name' AND p.sort_order = 'asc' THEN ba.simulation_name END ASC NULLS LAST,
        ba.attempt_created_at DESC NULLS LAST
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
),

-- JOIN all metadata for paginated results
attempts_with_metadata AS (
    SELECT
        sp.attempt_id,
        sp.profile_id,
        sp.simulation_id,
        sp.cohort_id,
        sp.department_id,
        -- Simulation metadata
        sp.simulation_name,
        -- Profile name
        profile_r.name AS profile_name,
        -- Cohort name
        cr.name AS cohort_name,
        -- Department name
        dept.name AS department_name,
        -- Persona metadata (first persona for color/icon)
        persona_first.color AS persona_color,
        persona_first.icon AS persona_icon,
        -- Time limit (sum of scenario time limits)
        COALESCE(time_limit_agg.total_seconds, 0)::int AS time_limit,
        -- Timestamps
        sp.attempt_created_at,
        -- Flags
        sp.practice,
        sp.infinite_mode,
        sp.is_archived,
        -- Metrics
        sp.num_chats,
        sp.num_chats_completed,
        sp.num_scenarios,
        sp.num_scenarios_completed,
        sp.score_percent,
        sp.has_passed,
        sp.total_time_seconds,
        sp.rubric_total_points,
        sp.rubric_pass_points,
        -- Arrays
        sp.scenario_ids,
        sp.persona_ids,
        COALESCE(scenario_agg.names, ARRAY[]::text[]) AS scenario_names,
        COALESCE(persona_agg.names, ARRAY[]::text[]) AS persona_names,
        COALESCE(persona_agg.colors, ARRAY[]::text[]) AS persona_colors,
        sp.sim_department_ids AS department_ids
    FROM sorted_paginated sp
    LEFT JOIN profiles_resource profile_r ON profile_r.id = sp.profile_id AND profile_r.active = true
    LEFT JOIN cohorts_resource cr ON cr.id = sp.cohort_id AND cr.active = true
    LEFT JOIN departments_resource dept ON dept.id = sp.department_id AND dept.active = true
    -- Get first persona for color/icon
    LEFT JOIN LATERAL (
        SELECT pr.color, pr.icon
        FROM unnest(sp.persona_ids) WITH ORDINALITY AS u(pid, ord)
        JOIN personas_resource pr ON pr.id = pid AND pr.active = true
        ORDER BY ord
        LIMIT 1
    ) persona_first ON true
    -- Aggregate persona names/colors
    LEFT JOIN LATERAL (
        SELECT
            ARRAY_AGG(pr.name ORDER BY ord) AS names,
            ARRAY_AGG(pr.color ORDER BY ord) AS colors
        FROM UNNEST(sp.persona_ids) WITH ORDINALITY AS u(pid, ord)
        JOIN personas_resource pr ON pr.id = pid AND pr.active = true
    ) persona_agg ON true
    -- Aggregate scenario names
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(scr.name ORDER BY ord) AS names
        FROM UNNEST(sp.scenario_ids) WITH ORDINALITY AS u(sid, ord)
        JOIN scenarios_resource scr ON scr.id = sid AND scr.active = true
    ) scenario_agg ON true
    -- Sum time limits
    LEFT JOIN LATERAL (
        SELECT SUM(stlr.time_limit_seconds) AS total_seconds
        FROM UNNEST(sp.scenario_ids) AS sid
        JOIN scenario_time_limits_resource stlr ON stlr.scenario_id = sid AND stlr.active = true
    ) time_limit_agg ON true
),

-- Filter options: simulations (from ALL filtered data)
simulation_options AS (
    SELECT
        (ba.simulation_id::text, ba.simulation_name, COUNT(*)::int)::types.q_get_simulation_history_view_v4_filter_option AS option
    FROM base_attempts ba
    GROUP BY ba.simulation_id, ba.simulation_name
    ORDER BY COUNT(*) DESC, ba.simulation_name ASC
),

-- Filter options: scenarios (from ALL filtered data)
scenario_options AS (
    SELECT
        (sid::text, scr.name, COUNT(*)::int)::types.q_get_simulation_history_view_v4_filter_option AS option
    FROM base_attempts ba
    CROSS JOIN LATERAL unnest(ba.scenario_ids) AS sid
    JOIN scenarios_resource scr ON scr.id = sid AND scr.active = true
    GROUP BY sid, scr.name
    ORDER BY COUNT(*) DESC, scr.name ASC
),

-- Filter options: profiles (from ALL filtered data - for multi-user view)
profile_options AS (
    SELECT
        (ba.profile_id::text, pr.name, COUNT(*)::int)::types.q_get_simulation_history_view_v4_filter_option AS option
    FROM base_attempts ba
    JOIN profiles_resource pr ON pr.id = ba.profile_id AND pr.active = true
    GROUP BY ba.profile_id, pr.name
    ORDER BY COUNT(*) DESC, pr.name ASC
),

-- Aggregate attempts
attempts_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (attempt_id, profile_id, simulation_id, cohort_id, department_id,
         simulation_name, profile_name, cohort_name, department_name,
         persona_color, persona_icon, time_limit, attempt_created_at,
         practice, infinite_mode, is_archived, num_chats, num_chats_completed,
         num_scenarios, num_scenarios_completed, score_percent, has_passed,
         total_time_seconds, rubric_total_points, rubric_pass_points,
         scenario_ids, persona_ids, scenario_names, persona_names, persona_colors, department_ids
        )::types.q_get_simulation_history_view_v4_item
        ORDER BY attempt_created_at DESC
    ), ARRAY[]::types.q_get_simulation_history_view_v4_item[]) AS items
    FROM attempts_with_metadata
),

-- Aggregate filter options
simulation_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_simulation_history_view_v4_filter_option[]) AS options
    FROM simulation_options
),
scenario_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_simulation_history_view_v4_filter_option[]) AS options
    FROM scenario_options
),
profile_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_simulation_history_view_v4_filter_option[]) AS options
    FROM profile_options
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    (SELECT total_count FROM total_count_cte) AS total_count,
    (SELECT items FROM attempts_agg) AS items,
    (SELECT options FROM simulation_options_agg) AS simulation_options,
    (SELECT options FROM scenario_options_agg) AS scenario_options,
    (SELECT options FROM profile_options_agg) AS profile_options
FROM profile_info pi;
$$;
