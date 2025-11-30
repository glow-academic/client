-- Reports history query with pagination, search, filters, and sorting
-- Assumes profile_id ($3) may be "guest-profile-id" which needs resolution
-- Parameters (in order):
-- $1, $2: start_date (datetime), end_date (datetime)
-- $3: profile_id (uuid or "guest-profile-id", required, non-null)
-- $4: cohort_ids (uuid[])
-- $5: department_ids (uuid[])
-- $6: roles (profile_role[], kept for compatibility but not used for filtering)
-- Note: Cast explicitly in SQL as $6::profile_role[] to help PostgreSQL determine type
-- $7: simulationFilters (text[], optional) - ["general", "practice", "archived"]
-- $8: search (text, optional) - searches profile name, simulation name, persona names
-- $9: profileIds filter (uuid[], optional)
-- $10: simulationIds filter (uuid[], optional)
-- $11: scenarioIds filter (uuid[], optional)
-- $12: infiniteMode filter (bool, optional)
-- $13: sortBy (text, default: "date")
-- $14: sortOrder (text, default: "desc")
-- $15: pageSize (int, LIMIT)
-- $16: offset (int, OFFSET)

WITH 
-- Resolve guest-profile-id to actual profile ID
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $3::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $3::text IS NULL OR $3::text = '' THEN NULL::uuid
            ELSE $3::uuid
        END as resolved_profile_id
),
-- Cast roles parameter to help PostgreSQL determine type
roles_param AS (
    SELECT $6::profile_role[] as roles_array
),
-- Expanded cohort list: union of provided cohortIds + profileId cohorts
expanded_history_cohort_ids AS (
    SELECT DISTINCT cohort_id
    FROM (
        SELECT unnest($4::uuid[]) as cohort_id
        WHERE cardinality($4::uuid[]) > 0
        UNION
        SELECT cp.cohort_id
        FROM resolve_profile_id rpi
        JOIN cohort_profiles cp ON cp.profile_id = rpi.resolved_profile_id
    ) combined
),
-- Filter attempts by date, profile, cohorts, departments
history_attempts AS (
    SELECT DISTINCT
        sa.id AS attempt_id,
        sa.simulation_id,
        sa.created_at AS attempt_date,
        sa.archived AS is_archived,
        sa.infinite_mode,
        ap.profile_id,
        sim.title AS simulation_name,
        sim.practice_simulation,
        COALESCE(sdd.department_ids, NULL) as department_ids
    FROM simulation_attempts sa
    JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
    JOIN simulations sim ON sim.id = sa.simulation_id
    JOIN profiles p_attempt ON p_attempt.id = ap.profile_id
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    CROSS JOIN resolve_profile_id rpi
    WHERE sa.created_at >= $1
      AND sa.created_at <= $2
      -- Profile_id is always non-null for reports - always filter by it
      AND ap.profile_id = rpi.resolved_profile_id
      -- Simulation type filtering: general (practice_simulation = FALSE), practice (practice_simulation = TRUE), archived (archived = TRUE)
      -- If no filters provided (NULL or empty), default to general only (matching old behavior: sim.practice_simulation = FALSE)
      AND (
        ($7::text[] IS NULL OR cardinality($7::text[]) = 0) AND sim.practice_simulation = FALSE
        OR
        ($7::text[] IS NOT NULL AND cardinality($7::text[]) > 0 AND (
          ('general' = ANY($7::text[]) AND sim.practice_simulation = FALSE) OR
          ('practice' = ANY($7::text[]) AND sim.practice_simulation = TRUE) OR
          ('archived' = ANY($7::text[]) AND sa.archived = TRUE)
        ))
      )
      -- Exclude archived attempts unless 'archived' is explicitly in the filter list
      AND (
        $7::text[] IS NULL OR cardinality($7::text[]) = 0 OR 'archived' = ANY($7::text[]) OR sa.archived = FALSE
      )
      AND (cardinality($5::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && $5::uuid[]::text[])
),
-- Get cohorts for each attempt's profile (includes inactive links for history)
history_attempt_cohorts AS (
    SELECT
        ha.attempt_id,
        COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(ARRAY_AGG(DISTINCT c.title) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names
    FROM history_attempts ha
    LEFT JOIN cohort_profiles cp ON cp.profile_id = ha.profile_id
    LEFT JOIN cohorts c ON c.id = cp.cohort_id AND c.active = TRUE
    LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
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
        p.first_name || ' ' || p.last_name AS profile_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN profiles p ON p.id = haf.profile_id
    GROUP BY haf.profile_id, p.first_name, p.last_name
    ORDER BY profile_name
),
-- Get all unique simulation options from filtered attempts (before history-specific filters)
simulation_options_cte AS (
    SELECT 
        haf.simulation_id,
        s.title AS simulation_name,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN simulations s ON s.id = haf.simulation_id
    GROUP BY haf.simulation_id, s.title
    ORDER BY simulation_name
),
-- Get all unique scenario options from filtered attempts (before history-specific filters)
scenario_options_cte AS (
    SELECT 
        sc.scenario_id,
        s.name AS scenario_title,
        COUNT(DISTINCT haf.attempt_id) AS count
    FROM history_attempts_filtered haf
    JOIN attempt_chats ac ON ac.attempt_id = haf.attempt_id
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN scenarios s ON s.id = sc.scenario_id
    WHERE sc.scenario_id IS NOT NULL
    GROUP BY sc.scenario_id, s.name
    ORDER BY scenario_title
),
-- Apply additional filters (profileIds, simulationIds, scenarioIds, infiniteMode)
history_attempts_with_filters AS (
    SELECT haf.*
    FROM history_attempts_filtered haf
    WHERE 
        -- Profile filter
        (cardinality($9::uuid[]) = 0 OR haf.profile_id = ANY($9::uuid[]))
        -- Simulation filter
        AND (cardinality($10::uuid[]) = 0 OR haf.simulation_id = ANY($10::uuid[]))
        -- Infinite mode filter
        AND ($12::bool IS NULL OR haf.infinite_mode = $12::bool)
),
-- Get scenario IDs for each attempt (for scenario filtering)
attempt_scenario_ids AS (
    SELECT DISTINCT
        ac.attempt_id,
        ARRAY_AGG(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_with_filters)
    GROUP BY ac.attempt_id
),
-- Apply scenario filter
history_attempts_final AS (
    SELECT haf.*
    FROM history_attempts_with_filters haf
    LEFT JOIN attempt_scenario_ids asi ON asi.attempt_id = haf.attempt_id
    WHERE 
        -- Scenario filter (if any scenario matches, include the attempt)
        (cardinality($11::uuid[]) = 0 OR asi.scenario_ids IS NULL OR asi.scenario_ids && $11::uuid[])
),
-- Aggregate chats per attempt
history_chat_rollup AS (
    SELECT
        ac.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        COUNT(*) FILTER (WHERE sc.completed = FALSE) AS incomplete_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY ac.attempt_id
),
-- Get latest grade per chat
history_chat_grades AS (
    SELECT DISTINCT ON (rc.chat_id)
        rc.chat_id,
        scg.score,
        scg.rubric_id
    FROM grades scg
    JOIN runs r ON r.id = scg.run_id
    JOIN chat_runs rc ON rc.run_id = r.id
    WHERE scg.eval = false
      AND rc.chat_id IN (
        SELECT sc.id FROM attempt_chats ac
        JOIN chats sc ON sc.id = ac.chat_id
        WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    )
    ORDER BY rc.chat_id, scg.created_at DESC
),
-- Aggregate grades per attempt
history_grade_rollup AS (
    SELECT
        ac.attempt_id,
        COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) AS completed_with_grade,
        SUM(CASE WHEN hcg.score IS NOT NULL AND r.points > 0
            THEN (hcg.score / r.points::numeric * 100.0)
            ELSE 0 END) AS sum_grade_percent
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    LEFT JOIN rubrics r ON r.id = hcg.rubric_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY ac.attempt_id
),
-- Calculate elapsed time per attempt (for infinite mode time limit checks)
history_elapsed_time AS (
    SELECT
        ac.attempt_id,
        COALESCE(
            SUM(
                CASE 
                    WHEN sc.completed AND hcg.chat_id IS NOT NULL THEN
                        (SELECT scg.time_taken FROM grades scg 
                         JOIN runs r ON r.id = scg.run_id
                         JOIN chat_runs rc ON rc.run_id = r.id
                         WHERE rc.chat_id = sc.id 
                           AND scg.eval = false
                         ORDER BY scg.created_at DESC LIMIT 1)
                    WHEN sc.completed THEN
                        EXTRACT(EPOCH FROM (
                            (SELECT scg.created_at FROM grades scg 
                             JOIN runs r ON r.id = scg.run_id
                             JOIN chat_runs rc ON rc.run_id = r.id
                             WHERE rc.chat_id = sc.id 
                               AND scg.eval = false
                             ORDER BY scg.created_at DESC LIMIT 1) - sc.created_at
                        ))::integer
                    ELSE
                        EXTRACT(EPOCH FROM (NOW() - sc.created_at))::integer
                END
            ),
            0
        ) AS elapsed_seconds
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY ac.attempt_id
),
-- Get personas for each attempt
history_personas AS (
    SELECT
        ac.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN scenarios scn ON scn.id = sc.scenario_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    GROUP BY ac.attempt_id
),
-- Count scenarios per simulation
history_sim_scenario_count AS (
    SELECT
        s.id AS simulation_id,
        COUNT(ss.scenario_id)::int AS scenario_count
    FROM simulations s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get scenario info
history_scenario_ids AS (
    SELECT
        s.id AS simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY ss.position)::uuid[] AS scenario_ids_assigned
    FROM simulations s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM history_attempts_final)
    GROUP BY s.id
),
-- Get first scenario_id from each attempt's first chat (for practice scenario retry)
history_first_scenario AS (
    SELECT DISTINCT ON (ac.attempt_id)
        ac.attempt_id,
        sc.scenario_id::text AS practice_scenario_id
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM history_attempts_final)
    ORDER BY ac.attempt_id, sc.created_at ASC
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
        r.id AS rubric_id,
        r.points AS rubric_points,
        r.pass_points AS rubric_pass_points
    FROM simulation_scenarios ss
    LEFT JOIN rubrics r ON r.id = ss.rubric_id
    WHERE ss.active = true
      AND ss.simulation_id IN (SELECT DISTINCT simulation_id FROM attempt_rollup)
    ORDER BY ss.simulation_id, ss.position
),
attempt_joined AS (
    SELECT
        ar.*,
        hsi.scenario_ids_assigned,
        sr.rubric_id,
        sr.rubric_points,
        sr.rubric_pass_points,
        CASE
            WHEN sr.rubric_points IS NULL OR sr.rubric_points = 0 THEN NULL
            ELSE ROUND((sr.rubric_pass_points::numeric / sr.rubric_points::numeric) * 100.0)::int
        END AS pass_pct,
        (p.first_name || ' ' || p.last_name) AS profile_name,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit_seconds
    FROM attempt_rollup ar
    JOIN simulations s ON s.id = ar.simulation_id
    LEFT JOIN history_scenario_ids hsi ON hsi.simulation_id = ar.simulation_id
    LEFT JOIN simulation_rubrics sr ON sr.simulation_id = s.id
    JOIN profiles p ON p.id = ar.profile_id
),
attempt_cohort_names AS (
    SELECT
        attempt_id,
        cohort_names
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
                    -- AND there are incomplete chats (pending work)
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
        ($8::text IS NULL OR $8::text = '' OR
         LOWER(fr.profile_name) LIKE '%' || LOWER($8::text) || '%' OR
         LOWER(fr.simulation_name) LIKE '%' || LOWER($8::text) || '%' OR
         EXISTS (
             SELECT 1
             FROM unnest(fr.persona_ids_distinct) AS pid
             JOIN personas per ON per.id = pid
             WHERE LOWER(per.name) LIKE '%' || LOWER($8::text) || '%'
         ))
),
persona_labels AS (
    SELECT
        fr.attempt_id,
        COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names,
        COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT DISTINCT per.name, per.color
        FROM unnest(fr.persona_ids_distinct) AS pid
        JOIN personas per ON per.id = pid
    ) per ON TRUE
    GROUP BY fr.attempt_id
),
scenario_names AS (
    SELECT
        fr.attempt_id,
        COALESCE(sn.names, ARRAY[]::text[]) AS names
    FROM final_rows_with_search fr
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(s.name ORDER BY s.name) AS names
        FROM unnest(fr.scenario_ids_assigned) sid
        JOIN scenarios s ON s.id = sid
    ) sn ON TRUE
),
-- Get total count before pagination
total_count_cte AS (
    SELECT COUNT(*)::int AS total_count
    FROM final_rows_with_search
),
-- Get archived and unarchived counts for filtered set
archive_counts_cte AS (
    SELECT 
        COUNT(*) FILTER (WHERE is_archived = true)::int AS archived_count,
        COUNT(*) FILTER (WHERE is_archived = false)::int AS unarchived_count
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
        -- Computed sort columns for json_agg ordering
        CASE 
            WHEN $13 = 'date' AND $14 = 'desc' THEN fr.attempt_date
            WHEN $13 = 'date' AND $14 = 'asc' THEN fr.attempt_date
        END AS sort_date,
        CASE 
            WHEN $13 = 'simulationName' AND $14 = 'desc' THEN fr.simulation_name
            WHEN $13 = 'simulationName' AND $14 = 'asc' THEN fr.simulation_name
        END AS sort_simulation_name,
        CASE 
            WHEN $13 = 'score' AND $14 = 'desc' THEN COALESCE(fr.score_percent, -1)
            WHEN $13 = 'score' AND $14 = 'asc' THEN COALESCE(fr.score_percent, 999999)
        END AS sort_score
    FROM final_rows_with_search fr
    ORDER BY 
        CASE 
            WHEN $13 = 'date' AND $14 = 'desc' THEN fr.attempt_date
        END DESC NULLS LAST,
        CASE 
            WHEN $13 = 'date' AND $14 = 'asc' THEN fr.attempt_date
        END ASC NULLS LAST,
        CASE 
            WHEN $13 = 'simulationName' AND $14 = 'desc' THEN fr.simulation_name
        END DESC NULLS LAST,
        CASE 
            WHEN $13 = 'simulationName' AND $14 = 'asc' THEN fr.simulation_name
        END ASC NULLS LAST,
        CASE 
            WHEN $13 = 'score' AND $14 = 'desc' THEN COALESCE(fr.score_percent, -1)
        END DESC,
        CASE 
            WHEN $13 = 'score' AND $14 = 'asc' THEN COALESCE(fr.score_percent, 999999)
        END ASC,
        fr.attempt_id DESC
    LIMIT $15
    OFFSET $16
)
SELECT json_build_object(
    'data', COALESCE(
        json_agg(
            json_build_object(
                'attemptId', pr.attempt_id::text,
                'date', pr.attempt_date,
                'profileId', pr.profile_id::text,
                'profileName', pr.profile_name,
                'simulationName', pr.simulation_name,
                'numScenarios', pr.num_scenarios,
                'numScenariosCompleted', pr.num_scenarios_completed,
                'infiniteMode', pr.infinite_mode,
                'timeLimit', COALESCE(
                    (SELECT SUM(stl.time_limit_seconds)
                     FROM scenario_time_limits stl
                     JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                     WHERE stl.simulation_id = pr.simulation_id AND stl.active = true AND ss.active = true),
                    0
                ),
                'personaNames', COALESCE(pl.persona_names, ARRAY[]::text[]),
                'personaColors', COALESCE(pl.persona_colors, ARRAY[]::text[]),
                'score', pr.score_percent,
                'scoreStatus', pr.score_status,
                'simulation_id', pr.simulation_id::text,
                'scenario_ids', COALESCE(pr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
                'scenario_titles', COALESCE(sn.names, ARRAY[]::text[]),
                'isArchived', pr.is_archived,
                'showView', pr.show_view,
                'showContinue', pr.show_continue,
                'practiceSimulation', COALESCE(pr.practice_simulation, false),
                'passPct', pr.pass_pct,
                'department_ids', pr.department_ids,
                'cohortNames', COALESCE(acn.cohort_names, ARRAY[]::text[]),
                'practiceScenarioId', pr.practice_scenario_id
            )
            ORDER BY 
                CASE 
                    WHEN $13 = 'date' AND $14 = 'desc' THEN pr.sort_date
                END DESC NULLS LAST,
                CASE 
                    WHEN $13 = 'date' AND $14 = 'asc' THEN pr.sort_date
                END ASC NULLS LAST,
                CASE 
                    WHEN $13 = 'simulationName' AND $14 = 'desc' THEN pr.sort_simulation_name
                END DESC NULLS LAST,
                CASE 
                    WHEN $13 = 'simulationName' AND $14 = 'asc' THEN pr.sort_simulation_name
                END ASC NULLS LAST,
                CASE 
                    WHEN $13 = 'score' AND $14 = 'desc' THEN pr.sort_score
                END DESC,
                CASE 
                    WHEN $13 = 'score' AND $14 = 'asc' THEN pr.sort_score
                END ASC,
                pr.attempt_id DESC
        ),
        '[]'::json
    ),
    'totalCount', COALESCE((SELECT total_count FROM total_count_cte), 0),
    'archivedCount', COALESCE((SELECT archived_count FROM archive_counts_cte), 0),
    'unarchivedCount', COALESCE((SELECT unarchived_count FROM archive_counts_cte), 0),
    'profileOptions', COALESCE(
        (SELECT json_agg(json_build_object(
            'value', profile_id::text, 
            'label', profile_name,
            'count', count
        ))
         FROM profile_options_cte),
        '[]'::json
    ),
    'simulationOptions', COALESCE(
        (SELECT json_agg(json_build_object(
            'value', simulation_id::text, 
            'label', simulation_name,
            'count', count
        ))
         FROM simulation_options_cte),
        '[]'::json
    ),
    'scenarioOptions', COALESCE(
        (SELECT json_agg(json_build_object(
            'value', scenario_id::text, 
            'label', scenario_title,
            'count', count
        ))
         FROM scenario_options_cte),
        '[]'::json
    )
) AS result
FROM paginated_rows pr
LEFT JOIN persona_labels pl ON pl.attempt_id = pr.attempt_id
LEFT JOIN scenario_names sn ON sn.attempt_id = pr.attempt_id
LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = pr.attempt_id

