-- Reports history query with pagination, search, filters, and sorting
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
--
-- Parameters: start_date, end_date, actor_profile_id (required), target_profile_id (required),
--            cohort_ids, department_ids, roles (kept for compatibility, not used),
--            simulation_filters, search, profile_ids, simulation_ids, scenario_ids, infinite_mode, sort_by, sort_order, page_size, offset
-- Returns: Paginated history data with options arrays
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_reports_history_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_reports_history_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_reports_history_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types

-- Attempt history row (independent from bundle endpoint)
CREATE TYPE types.q_reports_history_v4_attempt_history_row AS (
    attempt_id uuid,
    date timestamptz,
    profile_id uuid,
    profile_name text,
    simulation_name text,
    num_scenarios int,
    num_scenarios_completed int,
    infinite_mode boolean,
    time_limit int,
    persona_names_junction text[],
    persona_colors_junction text[],
    score int,
    score_status text,
    simulation_id uuid,
    scenario_ids text[],
    scenario_titles text[],
    is_archived boolean,
    show_view boolean,
    show_continue boolean,
    practice_simulation boolean,
    pass_pct int,
    department_ids text[],
    cohort_names_junction text[],
    practice_scenario_id uuid
);

-- Filter option (for facet filters - used for profile, simulation, and scenario options)
CREATE TYPE types.q_reports_history_v4_filter_option AS (
    value text,
    label text,
    count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_reports_history_v4(
    start_date text,
    end_date text,
    actor_profile_id uuid,
    target_profile_id uuid,
    cohort_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    roles profile_type[] DEFAULT ARRAY[]::profile_type[],
    simulation_filters text[] DEFAULT ARRAY[]::text[],
    search text DEFAULT NULL,
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    infinite_mode boolean DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page int DEFAULT 0,
    page_size int DEFAULT 20
)
RETURNS TABLE (
    actor_name text,
    data types.q_reports_history_v4_attempt_history_row[],
    total_count bigint,
    archived_count bigint,
    unarchived_count bigint,
    page int,
    page_size int,
    total_pages bigint,
    profile_options types.q_reports_history_v4_filter_option[],
    simulation_options types.q_reports_history_v4_filter_option[],
    scenario_options_junction types.q_reports_history_v4_filter_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- Unified attempts (general + practice)
all_attempts AS (
    SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active
    FROM simulation_attempts_entry
),
-- Unified chats (general + practice)
all_chats AS (
    SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active
    FROM simulation_chats_entry
),
-- Unified attempt→simulation connections
all_attempt_simulations AS (
    SELECT attempt_id, simulations_id FROM simulation_attempts_simulations_connection
),
-- Unified attempt→profile connections
all_attempt_profiles AS (
    SELECT attempt_id, profiles_id FROM simulation_attempts_profiles_connection
),
-- Unified chat→scenario connections
all_chat_scenarios AS (
    SELECT chat_id, scenarios_id FROM simulation_chats_scenarios_connection
),
params AS (
    SELECT 
        (start_date::timestamptz) AS start_date,
        (end_date::timestamptz) AS end_date,
        actor_profile_id AS actor_profile_id,
        target_profile_id AS target_profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(roles, ARRAY[]::profile_type[]) AS roles,
        COALESCE(NULLIF(simulation_filters, ARRAY[]::text[]), ARRAY['general']::text[]) AS simulation_filters,
        COALESCE(NULLIF(search, ''), NULL) AS search,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        infinite_mode AS infinite_mode,
        COALESCE(NULLIF(sort_by, ''), 'date') AS sort_by,
        COALESCE(NULLIF(UPPER(sort_order), ''), 'DESC') AS sort_order,
        GREATEST(0, COALESCE(page, 0)) AS page,
        GREATEST(1, COALESCE(page_size, 20)) AS page_size,
        GREATEST(0, COALESCE(page, 0) * GREATEST(1, COALESCE(page_size, 20))) AS offset_val
),
-- Get actor name FROM profile_artifact
user_profile AS (
    SELECT COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT actor_profile_id FROM params)
),
-- Expanded cohort list: union of provided cohortIds + profileId cohorts (reports always filters by profile)
expanded_history_cohort_ids AS (
    SELECT DISTINCT cohort_id
    FROM (
        SELECT unnest((SELECT cohort_ids FROM params)::uuid[]) as cohort_id
        WHERE cardinality((SELECT cohort_ids FROM params)::uuid[]) > 0
        UNION
        SELECT cp.cohort_id
        FROM params p
        JOIN profile_cohorts_junction cp ON cp.profile_id = p.target_profile_id
    ) combined
),
-- Filter attempts by date, profile, cohorts, departments
history_attempts AS (
    SELECT DISTINCT
        sa.id AS attempt_id,
        ssj.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        ppj.profile_id,
        (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AS practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM all_attempts sa
    JOIN all_attempt_simulations aas ON aas.attempt_id = sa.id
    JOIN simulation_simulations_junction ssj ON ssj.simulations_id = aas.simulations_id
    JOIN all_attempt_profiles aap ON aap.attempt_id = sa.id
    JOIN profile_profiles_junction ppj ON ppj.profiles_id = aap.profiles_id
    JOIN simulation_artifact sim ON sim.id = ssj.simulation_id
    JOIN profile_artifact p_attempt ON p_attempt.id = ppj.profile_id
    LEFT JOIN (
        SELECT
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments_junction sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    CROSS JOIN params p
    WHERE sa.created_at >= (SELECT start_date FROM params)
      AND sa.created_at <= (SELECT end_date FROM params)
      -- Reports always filters by profile_id (required parameter)
      AND ppj.profile_id = (SELECT target_profile_id FROM params)
      -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
      -- If no filters provided (NULL or empty), default to general only (matching old behavior: sim.practice_simulation = FALSE)
      AND (
        (cardinality((SELECT simulation_filters FROM params)::text[]) = 0) AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
        OR
        (cardinality((SELECT simulation_filters FROM params)::text[]) > 0 AND (
          ('general' = ANY((SELECT simulation_filters FROM params)::text[]) AND NOT EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
          ('practice' = ANY((SELECT simulation_filters FROM params)::text[]) AND EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)) OR
          ('archived' = ANY((SELECT simulation_filters FROM params)::text[]) AND sa.archived = TRUE)
        ))
      )
      -- Exclude archived attempts unless 'archived' is explicitly in the filter list
      AND (
        cardinality((SELECT simulation_filters FROM params)::text[]) = 0 OR 'archived' = ANY((SELECT simulation_filters FROM params)::text[]) OR sa.archived = FALSE
      )
      AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && (SELECT department_ids FROM params)::text[])
),
-- Get cohorts for each attempt's profile (includes inactive links for history)
history_attempt_cohorts AS (
    SELECT
        ha.attempt_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(ARRAY_AGG(DISTINCT (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names_junction
    FROM history_attempts ha
    LEFT JOIN profile_cohorts_junction cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohort_artifact c ON c.id = cp.cohort_id AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = TRUE)
    LEFT JOIN cohort_simulations_junction cs ON cs.cohort_id = c.id
    WHERE (
        -- If no cohort filter, include all attempts
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        -- Otherwise, only include cohorts in the expanded list
        OR c.id IN (SELECT cohort_id FROM expanded_history_cohort_ids)
    )
    GROUP BY ha.attempt_id
),
-- Filter attempts by cohort membership (uses expanded cohort list)
history_attempts_filtered AS (
    SELECT ha.*
    FROM history_attempts ha
    JOIN history_attempt_cohorts hac ON hac.attempt_id = ha.attempt_id
    WHERE (
        -- If no cohort filter, include all attempts
        (SELECT COUNT(*) FROM expanded_history_cohort_ids) = 0
        -- Otherwise, only include attempts with matching cohorts
        OR cardinality(hac.cohort_ids) > 0
    )
),
-- Get all unique profile options from filtered attempts (before history-specific filters)
profile_options_cte AS (
    SELECT 
        haf.profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN profile_artifact p ON p.id = haf.profile_id
    GROUP BY haf.profile_id, p.id
    ORDER BY profile_name
),
-- Get all unique simulation options from filtered attempts (before history-specific filters)
simulation_options_cte AS (
    SELECT 
        haf.simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN simulation_artifact s ON s.id = haf.simulation_id
    GROUP BY haf.simulation_id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
    ORDER BY simulation_name
),
-- Get all unique scenario options from filtered attempts (before history-specific filters)
scenario_options_cte AS (
    SELECT
        ssj.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN all_chats sc ON sc.attempt_id = haf.attempt_id
    JOIN all_chat_scenarios acs ON acs.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = acs.scenarios_id
    JOIN scenarios_resource s ON s.id = ssj.scenario_id
    WHERE ssj.scenario_id IS NOT NULL
    GROUP BY ssj.scenario_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1)
    ORDER BY scenario_title
),
-- Apply additional filters (profileIds, simulationIds, scenarioIds, infiniteMode)
history_attempts_with_filters AS (
    SELECT haf.*
    FROM history_attempts_filtered haf
    WHERE 
        -- Profile filter
        (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR haf.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
        -- Simulation filter
        AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR haf.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
        -- Infinite mode filter
        AND ((SELECT infinite_mode FROM params) IS NULL OR haf.infinite_mode = (SELECT infinite_mode FROM params))
),
-- Get scenario IDs for each attempt (for scenario filtering)
attempt_scenario_ids AS (
    SELECT DISTINCT
        sc.attempt_id,
        ARRAY_AGG(DISTINCT ssj2.scenario_id) FILTER (WHERE ssj2.scenario_id IS NOT NULL) AS scenario_ids
    FROM all_chats sc
    JOIN all_chat_scenarios acs2 ON acs2.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj2 ON ssj2.scenarios_id = acs2.scenarios_id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_with_filters)
    GROUP BY sc.attempt_id
),
-- Apply scenario filter
history_attempts_final AS (
    SELECT haf.*
    FROM history_attempts_with_filters haf
    LEFT JOIN attempt_scenario_ids asi ON asi.attempt_id = haf.attempt_id
    WHERE 
        -- Scenario filter (if any scenario matches, include the attempt)
        (cardinality((SELECT scenario_ids FROM params)) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && (SELECT scenario_ids FROM params))
),
-- Aggregate chats_entry per attempt
history_chat_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        COUNT(*) FILTER (WHERE sc.completed = FALSE) AS incomplete_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT ssj3.scenario_id) FILTER (WHERE ssj3.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM all_chats sc
    JOIN all_chat_scenarios acs3 ON acs3.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj3 ON ssj3.scenarios_id = acs3.scenarios_id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Get latest grade per chat
history_chat_grades AS (
    SELECT DISTINCT ON (scg.chat_id)
        scg.chat_id AS chat_id,
        scg.score
    FROM grades_entry scg
    WHERE scg.chat_id IN (
        SELECT sc.id FROM all_chats sc
        WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    )
    ORDER BY scg.chat_id, scg.created_at DESC
),
-- Aggregate grades_entry per attempt
-- Score formula: grade.score / rubric total points * 100
history_grade_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) AS completed_with_grade,
        SUM(CASE WHEN hcg.score IS NOT NULL AND (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = ssj4.scenario_id LIMIT 1) > 0
            THEN TRUNC(hcg.score / (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = ssj4.scenario_id LIMIT 1)::numeric * 100.0, 2)
            ELSE 0 END) AS sum_grade_percent
    FROM all_chats sc
    JOIN all_chat_scenarios acs4 ON acs4.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj4 ON ssj4.scenarios_id = acs4.scenarios_id
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Calculate elapsed time per attempt (for infinite mode time limit checks)
history_elapsed_time AS (
    SELECT
        sc.attempt_id,
        COALESCE(
            SUM(
                CASE
                    WHEN sc.completed AND hcg.chat_id IS NOT NULL THEN
                        (SELECT COALESCE(scg.time_taken, 0) FROM grades_entry scg
                         WHERE scg.chat_id = sc.id
                         ORDER BY scg.created_at DESC LIMIT 1)
                    WHEN sc.completed THEN
                        EXTRACT(EPOCH FROM (
                            (SELECT scg.created_at FROM grades_entry scg
                             WHERE scg.chat_id = sc.id
                             ORDER BY scg.created_at DESC LIMIT 1) - sc.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - sc.created_at))::integer
                END
            ),
            0
        ) AS elapsed_seconds
    FROM all_chats sc
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Get personas for each attempt
history_personas AS (
    SELECT
        sc.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM all_chats sc
    JOIN all_chat_scenarios acs5 ON acs5.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj5 ON ssj5.scenarios_id = acs5.scenarios_id
    JOIN scenarios_resource scn ON scn.id = ssj5.scenario_id
    LEFT JOIN scenario_personas_junction sp ON sp.scenario_id = scn.id AND sp.active = TRUE
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Count scenarios per simulation
history_sim_scenario_count AS (
    SELECT
        s.id AS simulation_id,
        COUNT(ss.scenario_id)::int AS scenario_count
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get scenario info
history_scenario_ids AS (
    SELECT
        s.id AS simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY COALESCE((SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1), 999999))::uuid[] AS scenario_ids_assigned
    FROM simulation_artifact s
    LEFT JOIN simulation_scenarios_junction ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get first scenario_id from each attempt's first chat (for practice scenario retry)
history_first_scenario AS (
    SELECT DISTINCT ON (sc.attempt_id)
        sc.attempt_id,
        ssj6.scenario_id AS practice_scenario_id
    FROM all_chats sc
    JOIN all_chat_scenarios acs6 ON acs6.chat_id = sc.id
    JOIN scenario_scenarios_junction ssj6 ON ssj6.scenarios_id = acs6.scenarios_id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    ORDER BY sc.attempt_id, sc.created_at ASC
),
-- Join all history data
attempt_rollup AS (
    SELECT
        haf.attempt_id,
        haf.simulation_id,
        haf.attempt_date,
        haf.is_archived,
        haf.infinite_mode,
        haf.profile_id,
        haf.simulation_name,
        haf.practice_simulation,
        haf.department_ids,
        COALESCE(hcr.first_chat_at, haf.attempt_date) AS first_chat_at,
        COALESCE(hcr.last_activity_at, haf.attempt_date) AS last_activity_at,
        COALESCE(hgr.completed_with_grade, 0) AS completed_with_grade,
        COALESCE(hssc.scenario_count, 0) AS sim_scenario_count,
        COALESCE(hgr.sum_grade_percent, 0) AS sum_grade_percent_zero_fill,
        COALESCE(hp.persona_ids, ARRAY[]::uuid[]) AS persona_ids_distinct,
        COALESCE(hcr.scenario_ids_seen, ARRAY[]::uuid[]) AS leaf_scenarios_seen,
        COALESCE(hcr.incomplete_chats, 0) AS incomplete_chats,
        COALESCE(het.elapsed_seconds, 0) AS elapsed_seconds,
        hfs.practice_scenario_id
    FROM history_attempts_final haf
    LEFT JOIN history_chat_rollup hcr ON hcr.attempt_id = haf.attempt_id
    LEFT JOIN history_grade_rollup hgr ON hgr.attempt_id = haf.attempt_id
    LEFT JOIN history_personas hp ON hp.attempt_id = haf.attempt_id
    LEFT JOIN history_sim_scenario_count hssc ON hssc.simulation_id = haf.simulation_id
    LEFT JOIN history_elapsed_time het ON het.attempt_id = haf.attempt_id
    LEFT JOIN history_first_scenario hfs ON hfs.attempt_id = haf.attempt_id
),
attempt_cohort_ids AS (
    SELECT
        attempt_id,
        cohort_ids AS profile_cohort_ids
    FROM history_attempt_cohorts
    WHERE attempt_id IN (SELECT attempt_id FROM history_attempts_final)
),
-- Get rubric data per simulation (one row per simulation)
simulation_rubrics AS (
    SELECT DISTINCT ON (ss.simulation_id)
        ss.simulation_id,
        srr.rubric_id,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type LIMIT 1) AS rubric_points_junction,
        (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = srr.rubric_id AND rp.type = 'pass'::point_type LIMIT 1) AS rubric_pass_points
    FROM simulation_scenarios_junction ss
    LEFT JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
    LEFT JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id
        AND sfr.scenario_id = ss.scenario_id
        AND f.name = 'scenario_active'
        AND ssf.value = true)
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM attempt_rollup)
    ORDER BY ss.simulation_id, COALESCE((SELECT spr.value FROM simulation_scenario_positions_junction ssp JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id WHERE ssp.simulation_id = ss.simulation_id AND spr.scenario_id = ss.scenario_id LIMIT 1), 999999)
),
attempt_joined AS (
    SELECT
        ar.*,
        hsi.scenario_ids_assigned,
        sr.rubric_id,
        sr.rubric_points_junction,
        sr.rubric_pass_points,
        CASE
            WHEN sr.rubric_points_junction IS NULL OR sr.rubric_points_junction = 0 THEN NULL
            ELSE ROUND((sr.rubric_pass_points::numeric / sr.rubric_points_junction::numeric) * 100.0)::int
        END AS pass_pct,
        (COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '')) AS profile_name,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id 
               AND sstl.active = true 
               AND stlr.active = true
               AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id 
                   AND sfr.scenario_id = ss.scenario_id 
                   AND f.name = 'scenario_active' 
                   AND ssf.value = true)),
            0
        ) as time_limit_seconds
    FROM attempt_rollup ar
    JOIN simulation_artifact s ON s.id = ar.simulation_id
    LEFT JOIN history_scenario_ids hsi ON hsi.simulation_id = ar.simulation_id
    LEFT JOIN simulation_rubrics sr ON sr.simulation_id = s.id
    JOIN profile_artifact p ON p.id = ar.profile_id
),
attempt_cohort_names AS (
    SELECT
        attempt_id,
        cohort_names_junction
    FROM history_attempt_cohorts
    WHERE attempt_id IN (SELECT attempt_id FROM history_attempts_final)
),
final_rows AS (
    SELECT
        aj.attempt_id,
        aj.simulation_id,
        aj.profile_id,
        aj.profile_name,
        aj.simulation_name,
        aj.scenario_ids_assigned,
        aj.is_archived,
        aj.practice_simulation,
        aj.pass_pct,
        aj.infinite_mode,
        aj.attempt_date,
        aj.department_ids,
        aj.practice_scenario_id,
        CASE WHEN aj.infinite_mode THEN NULL ELSE COALESCE(aj.sim_scenario_count, 0) END AS num_scenarios,
        COALESCE(aj.completed_with_grade, 0) AS num_scenarios_completed,
        CASE
            WHEN aj.infinite_mode THEN
                CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
                    WHEN 0 THEN NULL
                    ELSE ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int
                END
            ELSE
                CASE COALESCE(aj.sim_scenario_count, 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                            WHEN aj.completed_with_grade = 0 THEN NULL
                            ELSE ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int
                        END
                END
        END AS score,
        CASE
            WHEN aj.infinite_mode THEN
                CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                        WHEN ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int >= 80 THEN 'high'
                        WHEN ROUND(aj.sum_grade_percent_zero_fill / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1))::int >= 70 THEN 'medium'
                        ELSE 'low'
                    END
                END
            ELSE
                CASE COALESCE(aj.sim_scenario_count, 0)
                    WHEN 0 THEN NULL
                    ELSE CASE
                        WHEN aj.completed_with_grade = 0 THEN NULL
                        ELSE CASE
                            WHEN ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int >= 80 THEN 'high'
                            WHEN ROUND(aj.sum_grade_percent_zero_fill / NULLIF(aj.sim_scenario_count, 0))::int >= 70 THEN 'medium'
                            ELSE 'low'
                        END
                    END
                END
        END AS score_status,
        (NOT aj.is_archived) AS show_view,
        (NOT aj.is_archived) AND (
            (aj.infinite_mode
                AND (
                    -- No time limit OR time limit not exceeded
                    (aj.time_limit_seconds IS NULL OR aj.elapsed_seconds < aj.time_limit_seconds)
                    -- AND there are incomplete chats_entry (pending work)
                    AND aj.incomplete_chats > 0
                ))
            OR
            (NOT aj.infinite_mode
                AND aj.sim_scenario_count IS NOT NULL
                AND COALESCE(aj.completed_with_grade, 0) < aj.sim_scenario_count)
        ) AS show_continue,
        aj.persona_ids_distinct
    FROM attempt_joined aj
),
-- Apply search filter (searches profile name, simulation name, persona names)
final_rows_with_search AS (
    SELECT fr.*
    FROM final_rows fr
    WHERE 
        -- Search filter: if search term provided, search in profile name, simulation name, or persona names
        ((SELECT search FROM params) IS NULL OR (SELECT search FROM params) = '' OR
         LOWER(fr.profile_name) LIKE '%' || LOWER((SELECT search FROM params)) || '%' OR
         LOWER(fr.simulation_name) LIKE '%' || LOWER((SELECT search FROM params)) || '%' OR
         EXISTS (
             SELECT 1
             FROM unnest(fr.persona_ids_distinct) AS pid
             JOIN personas_resource per ON per.id = pid
             JOIN persona_names_junction pn ON pn.persona_id = per.id
             JOIN names_resource n ON n.id = pn.name_id
             WHERE LOWER(n.name) LIKE '%' || LOWER((SELECT search FROM params)) || '%'
         ))
),
persona_labels AS (
    SELECT
        fr.attempt_id,
        COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names_junction,
        COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors_junction
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT DISTINCT n.name AS name, c.hex_code AS color
        FROM unnest(fr.persona_ids_distinct) AS pid
        JOIN personas_resource per ON per.id = pid
        LEFT JOIN persona_names_junction pn ON pn.persona_id = per.id
        LEFT JOIN names_resource n ON n.id = pn.name_id
        LEFT JOIN persona_colors_junction pc ON pc.persona_id = per.id
        LEFT JOIN colors_resource c ON c.id = pc.color_id
    ) per ON TRUE
    GROUP BY fr.attempt_id
),
scenario_names_junction AS (
    SELECT
        fr.attempt_id,
        COALESCE(sn.names, ARRAY[]::text[]) AS names
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG((SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1) ORDER BY (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1)) AS names
        FROM unnest(fr.scenario_ids_assigned) sid
        JOIN scenarios_resource s ON s.id = sid
        JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id
    ) sn ON TRUE
),
-- Get total count before pagination
total_count_cte AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM final_rows_with_search
),
-- Get archived and unarchived counts for filtered set
archive_counts_cte AS (
    SELECT 
        COUNT(*) FILTER (WHERE is_archived = true)::bigint AS archived_count,
        COUNT(*) FILTER (WHERE is_archived = false)::bigint AS unarchived_count
    FROM final_rows_with_search
),
-- Paginated and sorted results
paginated_rows AS (
    SELECT
        fr.attempt_id,
        fr.attempt_date,
        fr.profile_id,
        fr.profile_name,
        fr.simulation_name,
        fr.num_scenarios,
        fr.num_scenarios_completed,
        fr.infinite_mode,
        fr.score,
        fr.score_status,
        fr.simulation_id,
        fr.scenario_ids_assigned,
        fr.is_archived,
        fr.show_view,
        fr.show_continue,
        fr.practice_simulation,
        fr.pass_pct,
        fr.department_ids,
        fr.practice_scenario_id,
        fr.persona_ids_distinct
    FROM final_rows_with_search fr
    ORDER BY 
        CASE 
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN fr.attempt_date
        END DESC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN fr.attempt_date
        END ASC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN fr.simulation_name
        END DESC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN fr.simulation_name
        END ASC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(fr.score, -1)
        END DESC,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(fr.score, 999999)
        END ASC,
        fr.attempt_id DESC
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT offset_val FROM params)
),
-- Convert paginated rows to composite types
data_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (
                pr.attempt_id,
                pr.attempt_date,
                pr.profile_id,
                pr.profile_name,
                pr.simulation_name,
                pr.num_scenarios,
                pr.num_scenarios_completed,
                pr.infinite_mode,
                COALESCE(
                    (SELECT SUM(stlr.time_limit_seconds)
                     FROM simulation_scenario_time_limits_junction sstl
                     JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                     JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                     WHERE sstl.simulation_id = pr.simulation_id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
                    0
                ),
                COALESCE(pl.persona_names_junction, ARRAY[]::text[]),
                COALESCE(pl.persona_colors_junction, ARRAY[]::text[]),
                pr.score,
                pr.score_status,
                pr.simulation_id,
                COALESCE(pr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
                COALESCE(sn.names, ARRAY[]::text[]),
                pr.is_archived,
                pr.show_view,
                pr.show_continue,
                COALESCE(pr.practice_simulation, false),
                pr.pass_pct,
                pr.department_ids,
                COALESCE(acn.cohort_names_junction, ARRAY[]::text[]),
                pr.practice_scenario_id
            )::types.q_reports_history_v4_attempt_history_row
            ORDER BY 
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN pr.attempt_date
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN pr.attempt_date
                END ASC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN pr.simulation_name
                END DESC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN pr.simulation_name
                END ASC NULLS LAST,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(pr.score, -1)
                END DESC,
                CASE 
                    WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(pr.score, 999999)
                END ASC,
                pr.attempt_id DESC
        ),
        ARRAY[]::types.q_reports_history_v4_attempt_history_row[]
    ) AS data
    FROM paginated_rows pr
    LEFT JOIN persona_labels pl ON pl.attempt_id = pr.attempt_id
    LEFT JOIN scenario_names_junction sn ON sn.attempt_id = pr.attempt_id
    LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = pr.attempt_id
),
-- Convert options to composite types
profile_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (profile_id::text, profile_name, count)::types.q_reports_history_v4_filter_option
            ORDER BY profile_name
        ),
        ARRAY[]::types.q_reports_history_v4_filter_option[]
    ) AS profile_options
    FROM profile_options_cte
),
simulation_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (simulation_id::text, simulation_name, count)::types.q_reports_history_v4_filter_option
            ORDER BY simulation_name
        ),
        ARRAY[]::types.q_reports_history_v4_filter_option[]
    ) AS simulation_options
    FROM simulation_options_cte
),
scenario_options_agg AS (
    SELECT COALESCE(
        ARRAY_AGG(
            (scenario_id::text, scenario_title, count)::types.q_reports_history_v4_filter_option
            ORDER BY scenario_title
        ),
        ARRAY[]::types.q_reports_history_v4_filter_option[]
    ) AS scenario_options_junction
    FROM scenario_options_cte
)
SELECT
    (SELECT actor_name FROM user_profile)::text AS actor_name,
    COALESCE((SELECT data FROM data_agg LIMIT 1), ARRAY[]::types.q_reports_history_v4_attempt_history_row[]) AS data,
    COALESCE((SELECT total_count FROM total_count_cte LIMIT 1), 0)::bigint AS total_count,
    COALESCE((SELECT archived_count FROM archive_counts_cte LIMIT 1), 0)::bigint AS archived_count,
    COALESCE((SELECT unarchived_count FROM archive_counts_cte LIMIT 1), 0)::bigint AS unarchived_count,
    (SELECT page FROM params)::int AS page,
    (SELECT page_size FROM params)::int AS page_size,
    CASE 
        WHEN (SELECT page_size FROM params) > 0 
        THEN ((COALESCE((SELECT total_count FROM total_count_cte LIMIT 1), 0) + (SELECT page_size FROM params) - 1) / (SELECT page_size FROM params))::bigint
        ELSE 0::bigint
    END AS total_pages,
    COALESCE((SELECT profile_options FROM profile_options_agg LIMIT 1), ARRAY[]::types.q_reports_history_v4_filter_option[]) AS profile_options,
    COALESCE((SELECT simulation_options FROM simulation_options_agg LIMIT 1), ARRAY[]::types.q_reports_history_v4_filter_option[]) AS simulation_options,
    COALESCE((SELECT scenario_options_junction FROM scenario_options_agg LIMIT 1), ARRAY[]::types.q_reports_history_v4_filter_option[]) AS scenario_options_junction
$$;
