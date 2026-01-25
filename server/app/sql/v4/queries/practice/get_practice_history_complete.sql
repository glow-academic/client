-- Get practice history with pagination, search, filters, and sorting
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_practice_history_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_practice_history_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_practice_history_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_practice_history_v4_attempt AS (
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
    score_status text,  -- 'high' | 'medium' | 'low' | null
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
    practice_scenario_id text
);

CREATE TYPE types.q_get_practice_history_v4_profile_option AS (
    value text,  -- profile_id
    label text,  -- profile_name
    count int
);

CREATE TYPE types.q_get_practice_history_v4_simulation_option AS (
    value text,  -- simulation_id
    label text,  -- simulation_name
    count int
);

CREATE TYPE types.q_get_practice_history_v4_scenario_option AS (
    value text,  -- scenario_id
    label text,  -- scenario_title
    count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_practice_history_v4(
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    search text DEFAULT NULL,
    profile_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    infinite_mode boolean DEFAULT NULL,
    sort_by text DEFAULT 'date',
    sort_order text DEFAULT 'desc',
    page_size int DEFAULT 20,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    data types.q_get_practice_history_v4_attempt[],
    total_count int,
    page int,
    page_size int,
    total_pages int,
    profile_options types.q_get_practice_history_v4_profile_option[],
    simulation_options types.q_get_practice_history_v4_simulation_option[],
    scenario_options_junction types.q_get_practice_history_v4_scenario_option[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        search AS search,
        COALESCE(profile_ids, ARRAY[]::uuid[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
        COALESCE(scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
        infinite_mode AS infinite_mode,
        COALESCE(sort_by, 'date') AS sort_by,
        COALESCE(sort_order, 'desc') AS sort_order,
        COALESCE(page_size, 20) AS page_size,
        COALESCE(page_offset, 0) AS page_offset
),
resolve_profile_id AS (
    -- Resolve profile ID FROM parameter_artifact
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
-- Filter attempts by profile and departments (practice simulations only)
history_attempts AS (
    SELECT DISTINCT
        sa.id AS attempt_id,
        saj.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        paj.profile_id,
        (SELECT n.name FROM simulation_names_junction simn JOIN names_resource n ON simn.name_id = n.id WHERE simn.simulation_id = sim.id LIMIT 1) AS simulation_name,
        EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE) AS practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM attempts_entry sa
    JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
    JOIN profile_attempts_junction paj ON paj.attempt_id = sa.id
    JOIN simulation_artifact sim ON sim.id = saj.simulation_id
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments_junction sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE EXISTS (SELECT 1 FROM simulation_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.simulation_id = sim.id AND f.name = 'practice' AND sf.value = TRUE)
      AND paj.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
      AND (cardinality((SELECT department_ids FROM params)::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && ARRAY(SELECT dept_id::text FROM unnest((SELECT department_ids FROM params)::uuid[]) as dept_id))
),
-- Get cohorts for each attempt's profile
history_attempt_cohorts AS (
    SELECT
        ha.attempt_id,
        COALESCE(ARRAY_AGG(DISTINCT (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names_junction
    FROM history_attempts ha
    LEFT JOIN profile_cohorts_junction cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohort_artifact c ON c.id = cp.cohort_id AND EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'cohort_active' AND cf.value = TRUE)
    LEFT JOIN cohort_simulations_junction cs ON cs.cohort_id = c.id
    GROUP BY ha.attempt_id
),
-- Get all unique profile options from filtered attempts (before history-specific filters)
profile_options_cte AS (
    SELECT 
        ha.profile_id,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') AS profile_name,
        COUNT(DISTINCT ha.attempt_id) AS count
    FROM history_attempts ha
    JOIN profile_artifact p ON p.id = ha.profile_id
    GROUP BY ha.profile_id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), (SELECT n2.name FROM profile_names_junction pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1)
    ORDER BY profile_name
),
-- Get all unique simulation options from filtered attempts (before history-specific filters)
simulation_options_cte AS (
    SELECT 
        ha.simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) AS simulation_name,
        COUNT(DISTINCT ha.attempt_id) AS count
    FROM history_attempts ha
    JOIN simulation_artifact s ON s.id = ha.simulation_id
    GROUP BY ha.simulation_id, (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1)
    ORDER BY simulation_name
),
-- Get all unique scenario options from filtered attempts (before history-specific filters)
scenario_options_cte AS (
    SELECT
        scj.scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1) AS scenario_title,
        COUNT(DISTINCT ha.attempt_id) AS count
    FROM history_attempts ha
    JOIN chats_entry sc ON sc.attempt_id = ha.attempt_id
    JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
    JOIN scenarios_resource s ON s.id = scj.scenario_id
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id
    WHERE scj.scenario_id IS NOT NULL
    GROUP BY scj.scenario_id, (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = ssj.scenario_id LIMIT 1)
    ORDER BY scenario_title
),
-- Apply additional filters (profileIds, simulationIds, scenarioIds, infiniteMode)
history_attempts_with_filters AS (
    SELECT ha.*
    FROM history_attempts ha
    WHERE 
        -- Profile filter
        (cardinality((SELECT profile_ids FROM params)::uuid[]) = 0 OR ha.profile_id = ANY((SELECT profile_ids FROM params)::uuid[]))
        -- Simulation filter
        AND (cardinality((SELECT simulation_ids FROM params)::uuid[]) = 0 OR ha.simulation_id = ANY((SELECT simulation_ids FROM params)::uuid[]))
        -- Infinite mode filter
        AND ((SELECT infinite_mode FROM params) IS NULL OR ha.infinite_mode = (SELECT infinite_mode FROM params))
),
-- Get scenario IDs for each attempt (for scenario filtering)
attempt_scenario_ids AS (
    SELECT DISTINCT
        sc.attempt_id,
        ARRAY_AGG(DISTINCT scj2.scenario_id) FILTER (WHERE scj2.scenario_id IS NOT NULL) AS scenario_ids
    FROM chats_entry sc
    JOIN scenario_chats_junction scj2 ON scj2.chat_id = sc.id
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
        (cardinality((SELECT scenario_ids FROM params)::uuid[]) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && (SELECT scenario_ids FROM params)::uuid[])
),
-- Aggregate chats_entry per attempt
history_chat_rollup AS (
    SELECT
        sc.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        COUNT(*) FILTER (WHERE sc.completed = FALSE) AS incomplete_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT scj3.scenario_id) FILTER (WHERE scj3.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM chats_entry sc
    JOIN scenario_chats_junction scj3 ON scj3.chat_id = sc.id
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
        SELECT sc.id FROM chats_entry sc
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
        SUM(CASE WHEN hcg.score IS NOT NULL AND (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = scj4.scenario_id LIMIT 1) > 0
            THEN TRUNC(hcg.score / (SELECT p.value FROM scenario_rubrics_resource srr JOIN rubric_points_junction rp ON rp.rubric_id = srr.rubric_id AND rp.type = 'total'::point_type JOIN points_resource p ON p.id = rp.point_id WHERE srr.scenario_id = scj4.scenario_id LIMIT 1)::numeric * 100.0, 2)
            ELSE 0 END) AS sum_grade_percent
    FROM chats_entry sc
    JOIN scenario_chats_junction scj4 ON scj4.chat_id = sc.id
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
    FROM chats_entry sc
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY sc.attempt_id
),
-- Get personas for each attempt
history_personas AS (
    SELECT
        sc.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM chats_entry sc
    JOIN scenario_chats_junction scj5 ON scj5.chat_id = sc.id
    JOIN scenarios_resource scn ON scn.id = scj5.scenario_id
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
        scj6.scenario_id::text AS practice_scenario_id
    FROM chats_entry sc
    JOIN scenario_chats_junction scj6 ON scj6.chat_id = sc.id
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
    WHERE EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)
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
             WHERE sstl.simulation_id = s.id AND sstl.active = true AND stlr.active = true AND EXISTS (SELECT 1 FROM simulation_scenario_flags_junction ssf JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id JOIN flags_resource f ON sfr.flag_id = f.id WHERE ssf.simulation_id = ss.simulation_id AND sfr.scenario_id = ss.scenario_id AND f.name = 'scenario_active' AND ssf.value = true)),
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
        END AS score_percent,
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
        aj.persona_ids_distinct,
        aj.time_limit_seconds
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
    SELECT COUNT(*)::int AS total_count
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
        fr.score_percent,
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
        fr.persona_ids_distinct,
        fr.time_limit_seconds,
        -- Computed sort columns for ordering
        CASE 
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN fr.attempt_date
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN fr.attempt_date
        END AS sort_date,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN fr.simulation_name
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN fr.simulation_name
        END AS sort_simulation_name,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(fr.score_percent, -1)
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(fr.score_percent, 999999)
        END AS sort_score
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
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN COALESCE(fr.score_percent, -1)
        END DESC,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN COALESCE(fr.score_percent, 999999)
        END ASC,
        fr.attempt_id DESC
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT page_offset FROM params)
),
-- Convert paginated rows to composite types
attempts_array AS (
    SELECT 
        (pr.attempt_id,
         pr.attempt_date,
         pr.profile_id,
         pr.profile_name,
         pr.simulation_name,
         pr.num_scenarios,
         pr.num_scenarios_completed,
         pr.infinite_mode,
         pr.time_limit_seconds,
         COALESCE(pl.persona_names_junction, ARRAY[]::text[]),
         COALESCE(pl.persona_colors_junction, ARRAY[]::text[]),
         pr.score_percent,
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
        )::types.q_get_practice_history_v4_attempt AS attempt
    FROM paginated_rows pr
    LEFT JOIN persona_labels pl ON pl.attempt_id = pr.attempt_id
    LEFT JOIN scenario_names_junction sn ON sn.attempt_id = pr.attempt_id
    LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = pr.attempt_id
    ORDER BY 
        CASE 
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'desc' THEN pr.sort_date
        END DESC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'date' AND (SELECT sort_order FROM params) = 'asc' THEN pr.sort_date
        END ASC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'desc' THEN pr.sort_simulation_name
        END DESC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'simulationName' AND (SELECT sort_order FROM params) = 'asc' THEN pr.sort_simulation_name
        END ASC NULLS LAST,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'desc' THEN pr.sort_score
        END DESC,
        CASE 
            WHEN (SELECT sort_by FROM params) = 'score' AND (SELECT sort_order FROM params) = 'asc' THEN pr.sort_score
        END ASC,
        pr.attempt_id DESC
),
-- Aggregate attempts
attempts_agg AS (
    SELECT COALESCE(ARRAY_AGG(attempt), '{}'::types.q_get_practice_history_v4_attempt[]) as data
    FROM attempts_array
),
-- Convert options to composite types
profile_options_array AS (
    SELECT 
        (poc.profile_id::text, poc.profile_name, poc.count)::types.q_get_practice_history_v4_profile_option AS profile_option
    FROM profile_options_cte poc
),
simulation_options_array AS (
    SELECT 
        (soc.simulation_id::text, soc.simulation_name, soc.count)::types.q_get_practice_history_v4_simulation_option AS simulation_option
    FROM simulation_options_cte soc
),
scenario_options_array AS (
    SELECT 
        (scoc.scenario_id::text, scoc.scenario_title, scoc.count)::types.q_get_practice_history_v4_scenario_option AS scenario_option
    FROM scenario_options_cte scoc
),
-- Aggregate options
profile_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(profile_option), '{}'::types.q_get_practice_history_v4_profile_option[]) as profile_options
    FROM profile_options_array
),
simulation_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(simulation_option), '{}'::types.q_get_practice_history_v4_simulation_option[]) as simulation_options
    FROM simulation_options_array
),
scenario_options_agg AS (
    SELECT COALESCE(ARRAY_AGG(scenario_option), '{}'::types.q_get_practice_history_v4_scenario_option[]) as scenario_options_junction
    FROM scenario_options_array
),
-- Calculate pagination
pagination_calc AS (
    SELECT 
        (SELECT total_count FROM total_count_cte) AS total_count,
        (SELECT page_size FROM params) AS page_size,
        (SELECT page_offset FROM params) AS page_offset
)
SELECT 
    COALESCE((SELECT data FROM attempts_agg), '{}'::types.q_get_practice_history_v4_attempt[]) as data,
    COALESCE((SELECT total_count FROM pagination_calc), 0)::int as total_count,
    CASE 
        WHEN (SELECT page_size FROM params) > 0 
        THEN (SELECT page_offset FROM params) / (SELECT page_size FROM params)
        ELSE 0
    END::int as page,
    (SELECT page_size FROM params)::int as page_size,
    CASE 
        WHEN (SELECT total_count FROM pagination_calc) > 0 AND (SELECT page_size FROM params) > 0
        THEN ((SELECT total_count FROM pagination_calc) + (SELECT page_size FROM params) - 1) / (SELECT page_size FROM params)
        ELSE 0
    END::int as total_pages,
    COALESCE((SELECT profile_options FROM profile_options_agg), '{}'::types.q_get_practice_history_v4_profile_option[]) as profile_options,
    COALESCE((SELECT simulation_options FROM simulation_options_agg), '{}'::types.q_get_practice_history_v4_simulation_option[]) as simulation_options,
    COALESCE((SELECT scenario_options_junction FROM scenario_options_agg), '{}'::types.q_get_practice_history_v4_scenario_option[]) as scenario_options_junction
$$;
