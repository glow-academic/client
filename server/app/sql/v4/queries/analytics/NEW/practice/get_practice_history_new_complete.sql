-- Get NEW practice history - attempt data with metadata JOINed
-- REFACTORED: All JOINs done in SQL, only business logic in Python
--
-- SQL handles:
--   - Reading from mv_practice_attempt_history
--   - Filtering (date, cohort, department, simulation, scenario, search, infinite_mode, archived, profile)
--   - Sorting and pagination
--   - JOINs to _resource tables for names, colors, titles
--   - Filter options
--
-- Python handles (business logic only):
--   - score_status (classification based on pass_threshold)
--   - show_view, show_continue (conditional logic)
--   - pass_pct (calculation from rubric points)

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_practice_history_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_history_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_practice_history_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Attempt data with all metadata JOINed (Python only computes derived fields)
CREATE TYPE types.q_get_practice_history_new_v4_attempt AS (
    -- Core attempt data
    attempt_id uuid,
    attempt_created_at timestamptz,
    profile_id uuid,
    simulation_id uuid,
    -- JOINed metadata (no Python lookups needed)
    profile_name text,
    simulation_name text,
    department_ids uuid[],
    cohort_name text,
    persona_names text[],
    persona_colors text[],
    scenario_ids uuid[],
    scenario_titles text[],
    time_limit_seconds int,
    -- Raw data for Python business logic
    infinite_mode boolean,
    num_chats int,
    num_chats_completed int,
    num_scenarios int,
    num_scenarios_completed int,
    score_percent numeric,
    has_passed boolean,
    total_time_seconds int,
    rubric_total_points int,
    rubric_pass_points int,
    -- Practice-specific
    is_archived boolean,
    practice_simulation boolean,
    practice_scenario_id uuid
);

-- Filter option for dropdowns
CREATE TYPE types.q_get_practice_history_new_v4_filter_option AS (
    value text,
    label text,
    count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_practice_history_new_v4(
    start_date text,
    end_date text,
    profile_id uuid,
    -- Filters
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    infinite_mode boolean DEFAULT NULL,
    show_archived boolean DEFAULT FALSE,
    search text DEFAULT NULL,
    -- Sorting
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    -- Pagination
    page int DEFAULT 0,
    page_size int DEFAULT 20
)
RETURNS TABLE (
    actor_name text,
    total_count int,
    -- Attempt data with metadata already JOINed
    attempts types.q_get_practice_history_new_v4_attempt[],
    -- Filter options
    simulation_options types.q_get_practice_history_new_v4_filter_option[],
    scenario_options types.q_get_practice_history_new_v4_filter_option[],
    profile_options types.q_get_practice_history_new_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        start_date::timestamptz AS start_date,
        end_date::timestamptz AS end_date,
        profile_id AS viewer_profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        infinite_mode AS infinite_mode,
        COALESCE(show_archived, FALSE) AS show_archived,
        NULLIF(TRIM(search), '') AS search,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page, 0) AS page,
        COALESCE(page_size, 20) AS page_size
),

-- Get viewer profile info (for actor_name)
profile_info AS (
    SELECT
        pr.id,
        pr.name,
        pr.role
    FROM profiles_resource pr
    WHERE pr.id = (SELECT viewer_profile_id FROM params)
      AND pr.active = true
),

-- Determine if user can view others' attempts (instructional/admin/superadmin)
viewer_permissions AS (
    SELECT
        pi.role IN ('instructional', 'admin', 'superadmin') AS can_view_others
    FROM profile_info pi
),

-- Base attempt data from MV with simulation JOIN for filtering/sorting
base_attempts AS (
    SELECT
        mpah.attempt_id,
        mpah.attempt_created_at,
        mpah.profile_id,
        mpah.simulation_id,
        mpah.cohort_id,
        mpah.department_id,
        mpah.infinite_mode,
        mpah.num_chats,
        mpah.num_chats_completed,
        mpah.num_scenarios,
        mpah.num_scenarios_completed,
        mpah.score_percent,
        mpah.has_passed,
        mpah.total_time_seconds,
        mpah.rubric_total_points,
        mpah.rubric_pass_points,
        mpah.scenario_ids,
        mpah.persona_ids,
        mpah.is_archived,
        -- JOIN simulation for name (needed for search/sort)
        sr.name AS simulation_name,
        sr.department_ids AS sim_department_ids,
        -- Get first scenario_id for practice_scenario_id
        mpah.scenario_ids[1] AS practice_scenario_id
    FROM params p
    CROSS JOIN viewer_permissions vp
    CROSS JOIN mv_practice_attempt_history mpah
    JOIN simulations_resource sr ON sr.id = mpah.simulation_id AND sr.active = true
    WHERE mpah.attempt_created_at >= p.start_date
      AND mpah.attempt_created_at < p.end_date
      -- Profile filter: if profile_ids specified, use those; otherwise use viewer's profile
      -- (unless viewer can view others - then show all)
      AND (
          cardinality(p.profile_ids) > 0 AND mpah.profile_id = ANY(p.profile_ids)
          OR cardinality(p.profile_ids) = 0 AND (
              NOT vp.can_view_others AND mpah.profile_id = p.viewer_profile_id
              OR vp.can_view_others
          )
      )
      -- Archive filter
      AND (p.show_archived OR NOT mpah.is_archived)
      -- Cohort filter
      AND (cardinality(p.cohort_ids) = 0 OR mpah.cohort_id = ANY(p.cohort_ids))
      -- Department filter
      AND (cardinality(p.department_ids) = 0 OR mpah.department_id = ANY(p.department_ids))
      -- Simulation filter
      AND (cardinality(p.simulation_ids) = 0 OR mpah.simulation_id = ANY(p.simulation_ids))
      -- Scenario filter (any match)
      AND (cardinality(p.scenario_ids) = 0 OR mpah.scenario_ids && p.scenario_ids)
      -- Infinite mode filter
      AND (p.infinite_mode IS NULL OR mpah.infinite_mode = p.infinite_mode)
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
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT page * page_size FROM params)
),

-- JOIN all metadata for paginated results
-- This is the key change: JOINs happen in SQL, not Python
attempts_with_metadata AS (
    SELECT
        sp.attempt_id,
        sp.attempt_created_at,
        sp.profile_id,
        sp.simulation_id,
        -- Profile name
        profile_r.name AS profile_name,
        -- Simulation metadata
        sp.simulation_name,
        sp.sim_department_ids AS department_ids,
        -- Cohort name
        cr.name AS cohort_name,
        -- Persona names and colors (via LATERAL)
        COALESCE(persona_agg.names, ARRAY[]::text[]) AS persona_names,
        COALESCE(persona_agg.colors, ARRAY[]::text[]) AS persona_colors,
        -- Scenario IDs and titles (via LATERAL)
        sp.scenario_ids,
        COALESCE(scenario_agg.titles, ARRAY[]::text[]) AS scenario_titles,
        -- Time limit (sum of scenario time limits)
        COALESCE(time_limit_agg.total_seconds, 0)::int AS time_limit_seconds,
        -- Raw data for Python business logic
        sp.infinite_mode,
        sp.num_chats,
        sp.num_chats_completed,
        sp.num_scenarios,
        sp.num_scenarios_completed,
        sp.score_percent,
        sp.has_passed,
        sp.total_time_seconds,
        sp.rubric_total_points,
        sp.rubric_pass_points,
        -- Practice-specific
        sp.is_archived,
        TRUE AS practice_simulation,
        sp.practice_scenario_id
    FROM sorted_paginated sp
    LEFT JOIN profiles_resource profile_r ON profile_r.id = sp.profile_id AND profile_r.active = true
    LEFT JOIN cohorts_resource cr ON cr.id = sp.cohort_id AND cr.active = true
    -- Aggregate persona names/colors
    LEFT JOIN LATERAL (
        SELECT
            ARRAY_AGG(pr.name ORDER BY ord) AS names,
            ARRAY_AGG(pr.color ORDER BY ord) AS colors
        FROM UNNEST(sp.persona_ids) WITH ORDINALITY AS u(pid, ord)
        JOIN personas_resource pr ON pr.id = pid AND pr.active = true
    ) persona_agg ON true
    -- Aggregate scenario titles
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(scr.name ORDER BY ord) AS titles
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
        (ba.simulation_id::text, ba.simulation_name, COUNT(*)::int)::types.q_get_practice_history_new_v4_filter_option AS option
    FROM base_attempts ba
    GROUP BY ba.simulation_id, ba.simulation_name
    ORDER BY COUNT(*) DESC, ba.simulation_name ASC
),

-- Filter options: scenarios (from ALL filtered data)
scenario_options AS (
    SELECT
        (sid::text, scr.name, COUNT(*)::int)::types.q_get_practice_history_new_v4_filter_option AS option
    FROM base_attempts ba
    CROSS JOIN LATERAL unnest(ba.scenario_ids) AS sid
    JOIN scenarios_resource scr ON scr.id = sid AND scr.active = true
    GROUP BY sid, scr.name
    ORDER BY COUNT(*) DESC, scr.name ASC
),

-- Filter options: profiles (from ALL filtered data - for multi-user view)
profile_options AS (
    SELECT
        (ba.profile_id::text, pr.name, COUNT(*)::int)::types.q_get_practice_history_new_v4_filter_option AS option
    FROM base_attempts ba
    JOIN profiles_resource pr ON pr.id = ba.profile_id AND pr.active = true
    GROUP BY ba.profile_id, pr.name
    ORDER BY COUNT(*) DESC, pr.name ASC
),

-- Aggregate attempts
attempts_agg AS (
    SELECT COALESCE(ARRAY_AGG(
        (attempt_id, attempt_created_at, profile_id, simulation_id,
         profile_name, simulation_name, department_ids, cohort_name,
         persona_names, persona_colors, scenario_ids, scenario_titles, time_limit_seconds,
         infinite_mode, num_chats, num_chats_completed, num_scenarios, num_scenarios_completed,
         score_percent, has_passed, total_time_seconds, rubric_total_points, rubric_pass_points,
         is_archived, practice_simulation, practice_scenario_id
        )::types.q_get_practice_history_new_v4_attempt
    ), ARRAY[]::types.q_get_practice_history_new_v4_attempt[]) AS attempts
    FROM attempts_with_metadata
),

-- Aggregate filter options
simulation_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_practice_history_new_v4_filter_option[]) AS options
    FROM simulation_options
),
scenario_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_practice_history_new_v4_filter_option[]) AS options
    FROM scenario_options
),
profile_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(option), ARRAY[]::types.q_get_practice_history_new_v4_filter_option[]) AS options
    FROM profile_options
)

SELECT
    COALESCE(pi.name, 'System')::text AS actor_name,
    (SELECT total_count FROM total_count_cte) AS total_count,
    (SELECT attempts FROM attempts_agg) AS attempts,
    (SELECT options FROM simulation_options_agg) AS simulation_options,
    (SELECT options FROM scenario_options_agg) AS scenario_options,
    (SELECT options FROM profile_options_agg) AS profile_options
FROM profile_info pi
$$;
