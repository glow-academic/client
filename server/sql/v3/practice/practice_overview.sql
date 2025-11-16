-- Practice overview query - complete analytics with embedded history and all entity mappings
-- Parameters: $1 = profile_id (uuid), $2 = department_ids (uuid[])

WITH
-- Resolve guest-profile-id to actual profile ID
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
-- 1) Simulation meta (practice only)
sim_meta AS (
    SELECT
        s.id AS simulation_id,
        s.title AS simulation_title,
        s.description AS simulation_description,
        stl.time_limit_seconds AS time_limit,
        s.rubric_id,
        COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
        r.points AS rubric_points,
        r.pass_points AS rubric_pass_points,
        s.updated_at
    FROM simulations s
    LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
    JOIN rubrics r ON r.id = s.rubric_id
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.active = TRUE
      AND s.practice_simulation = TRUE
    GROUP BY s.id, s.title, s.description, stl.time_limit_seconds, s.rubric_id, r.points, r.pass_points, s.updated_at
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
),
-- 2) Persona color/icon
sim_persona_meta AS (
    SELECT
        sm.simulation_id,
        (ARRAY_AGG(p.color ORDER BY cnt DESC, COALESCE(p.color, '') DESC))[1] AS color,
        (ARRAY_AGG(p.icon ORDER BY cnt DESC, COALESCE(p.icon, '') DESC))[1] AS icon
    FROM (
        SELECT
            s.id AS simulation_id,
            sp.persona_id,
            COUNT(*) AS cnt
        FROM simulations s
        LEFT JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
        LEFT JOIN scenarios sc ON sc.id = ss_link.scenario_id
        LEFT JOIN scenario_personas sp ON sp.scenario_id = sc.id AND sp.active = TRUE
        LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
        WHERE s.practice_simulation = TRUE
        GROUP BY s.id, sp.persona_id
        HAVING 
            (cardinality($2::uuid[]) = 0 OR COUNT(sd.simulation_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
            OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
    ) sm
    LEFT JOIN personas p ON p.id = sm.persona_id
    GROUP BY sm.simulation_id
),
-- 3) All-time analytics slice (lifetime data for this user)
filt_all AS (
    SELECT a.*
    FROM analytics a, resolve_profile_id rpi
    WHERE a.profile_id = rpi.resolved_profile_id
      AND a.is_practice = TRUE
      -- Department filtering removed - departments are already filtered at profile level via profile_departments
),
-- 4) Per-attempt progression (completed-only average - lifetime)
attempt_progress AS (
    SELECT
        attempt_id,
        profile_id,
        simulation_id,
        COUNT(DISTINCT scenario_id) FILTER (WHERE completed) AS completed_root_scenarios,
        AVG(grade_percent) FILTER (WHERE completed) AS avg_score_completed,
        BOOL_OR(passed) AS any_passed_attempt,
        MAX(chat_created_at) AS last_time
    FROM filt_all
    GROUP BY attempt_id, profile_id, simulation_id
),
-- 5) Latest attempt per (profile, simulation) for completionPct
latest_attempt_per_profile_sim AS (
    SELECT DISTINCT ON (profile_id, simulation_id)
           profile_id, simulation_id, attempt_id,
           completed_root_scenarios, any_passed_attempt, last_time
    FROM attempt_progress
    ORDER BY profile_id, simulation_id, last_time DESC
),
-- 6) Activity by (profile, simulation) - lifetime
activity_by_profile_sim AS (
    SELECT
        profile_id,
        simulation_id,
        COUNT(DISTINCT chat_id) AS chats,
        BOOL_OR(passed) AS any_passed
    FROM filt_all
    GROUP BY profile_id, simulation_id
),
-- 7) Pass threshold
sim_pass_pct AS (
    SELECT DISTINCT ON (s.id)
           s.id AS simulation_id,
           CASE WHEN r.points > 0
                THEN (r.pass_points::numeric / r.points::numeric) * 100.0
                ELSE 70 END AS pass_pct
    FROM simulations s
    JOIN rubrics r ON r.id = s.rubric_id
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.practice_simulation = TRUE
      AND s.active = TRUE
      AND (
          (cardinality($2::uuid[]) = 0 OR sd.department_id = ANY($2::uuid[]))
          OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true))
      )
    ORDER BY s.id, s.title, s.description
),
-- 8) Standard groups/standards for rubrics
all_rubric_ids AS (
    SELECT DISTINCT rubric_id FROM sim_meta
),
standard_groups_mapping AS (
    SELECT jsonb_object_agg(
        sg.id::text,
        jsonb_build_object(
            'name', sg.name,
            'description', sg.description,
            'points', sg.points,
            'passPoints', sg.pass_points
        )
    ) AS mapping
    FROM standard_groups sg
    WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
),
standards_mapping AS (
    SELECT jsonb_object_agg(
        st.id::text,
        jsonb_build_object(
            'name', st.name,
            'description', st.description,
            'points', st.points
        )
    ) AS mapping
    FROM standards st
    WHERE st.standard_group_id IN (
        SELECT sg.id FROM standard_groups sg
        WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
    )
),
-- 9) Final items
rows AS (
    SELECT
        json_build_object(
            'viewMode', 'practice',
            'id', sm.simulation_id::text,
            'simulationTitle', sm.simulation_title,
            'simulationDescription', sm.simulation_description,
            'simulationName', sm.simulation_title,
            'timeLimit', NULL,
            'numSessions', sm.num_scenarios,
            'highestScore', (
                SELECT ROUND(MAX(ap.avg_score_completed))::int
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ),
            'rubric_id', sm.rubric_id::text,
            'color', spm.color,
            'icon', spm.icon,
            'hasPassed', COALESCE((
                SELECT MAX(ap.avg_score_completed) >= (
                    SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
                )
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ), false),
            'passRate', CASE
                           WHEN sm.rubric_points > 0
                             THEN ROUND(100.0 * sm.rubric_pass_points::numeric / sm.rubric_points)::int
                           ELSE NULL
                         END,
            'status', CASE
                         WHEN COALESCE((
                                SELECT MAX(ap.avg_score_completed) >= (
                                    SELECT pass_pct FROM sim_pass_pct WHERE simulation_id = sm.simulation_id LIMIT 1
                                )
                                FROM attempt_progress ap, resolve_profile_id rpi
                                WHERE ap.profile_id = rpi.resolved_profile_id
                                  AND ap.simulation_id = sm.simulation_id
                              ), false) THEN 'passed'
                         WHEN COALESCE(aps.chats, 0) > 0 THEN 'in-progress'
                         ELSE 'not-started'
                       END,
            'completionPct', COALESCE((
                SELECT ROUND(100.0 * lap.completed_root_scenarios::numeric / GREATEST(sm.num_scenarios, 1))::int
                FROM latest_attempt_per_profile_sim lap, resolve_profile_id rpi
                WHERE lap.profile_id = rpi.resolved_profile_id
                  AND lap.simulation_id = sm.simulation_id
                LIMIT 1
            ), 0),
            'passedCount', NULL,
            'inProgressCount', NULL,
            'notStartedCount', NULL,
            'passPct', NULL,
            'cohortName', NULL,
            'updatedAt', sm.updated_at,
            'lastActivityTs', (
                SELECT MAX(ap.last_time)
                FROM attempt_progress ap, resolve_profile_id rpi
                WHERE ap.profile_id = rpi.resolved_profile_id
                  AND ap.simulation_id = sm.simulation_id
            ),
            'hasActivity', (COALESCE(aps.chats, 0) > 0),
            'standard_groups', COALESCE((
                SELECT jsonb_object_agg(
                    sg.id::text,
                    (
                        SELECT jsonb_agg(st.id::text ORDER BY st.points DESC)
                        FROM standards st
                        WHERE st.standard_group_id = sg.id
                    )
                )
                FROM standard_groups sg
                WHERE sg.rubric_id = sm.rubric_id
            ), '{}'::jsonb)
        ) AS item,
        sm.simulation_title AS sort_title,
        (
            SELECT MAX(ap.last_time)
            FROM attempt_progress ap, resolve_profile_id rpi
            WHERE ap.profile_id = rpi.resolved_profile_id
              AND ap.simulation_id = sm.simulation_id
        ) AS sort_last_activity
    FROM sim_meta sm
    LEFT JOIN sim_persona_meta spm ON spm.simulation_id = sm.simulation_id
    LEFT JOIN activity_by_profile_sim aps
           ON aps.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
          AND aps.simulation_id = sm.simulation_id
),
-- FRESH HISTORY DATA: Query base tables directly, not analytics MV
-- Filter practice attempts by profile
practice_history_attempts AS (
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
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sim.practice_simulation = TRUE
      AND ap.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
      AND (cardinality($2::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && $2::text[])
),
-- Aggregate chats per attempt
practice_history_chat_rollup AS (
    SELECT
        ac.attempt_id,
        COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
        MIN(sc.created_at) AS first_chat_at,
        MAX(sc.created_at) AS last_activity_at,
        array_agg(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids_seen
    FROM attempt_chats ac
    JOIN simulation_chats sc ON sc.id = ac.chat_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM practice_history_attempts)
    GROUP BY ac.attempt_id
),
-- Get latest grade per chat
practice_history_chat_grades AS (
    SELECT DISTINCT ON (scg.simulation_chat_id)
        scg.simulation_chat_id AS chat_id,
        scg.score,
        scg.rubric_id
    FROM simulation_chat_grades scg
    WHERE scg.simulation_chat_id IN (
        SELECT sc.id FROM attempt_chats ac
        JOIN simulation_chats sc ON sc.id = ac.chat_id
        WHERE ac.attempt_id IN (SELECT attempt_id FROM practice_history_attempts)
    )
    ORDER BY scg.simulation_chat_id, scg.created_at DESC
),
-- Aggregate grades per attempt
practice_history_grade_rollup AS (
    SELECT
        ac.attempt_id,
        COUNT(*) FILTER (WHERE phcg.score IS NOT NULL) AS completed_with_grade,
        SUM(CASE WHEN phcg.score IS NOT NULL AND r.points > 0
            THEN (phcg.score / r.points::numeric * 100.0)
            ELSE 0 END) AS sum_grade_percent
    FROM attempt_chats ac
    JOIN simulation_chats sc ON sc.id = ac.chat_id
    LEFT JOIN practice_history_chat_grades phcg ON phcg.chat_id = sc.id
    LEFT JOIN rubrics r ON r.id = phcg.rubric_id
    WHERE ac.attempt_id IN (SELECT attempt_id FROM practice_history_attempts)
    GROUP BY ac.attempt_id
),
-- Get personas for each attempt
practice_history_personas AS (
    SELECT
        ac.attempt_id,
        array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
    FROM attempt_chats ac
    JOIN simulation_chats sc ON sc.id = ac.chat_id
    JOIN scenarios scn ON scn.id = sc.scenario_id
    LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
    WHERE ac.attempt_id IN (SELECT attempt_id FROM practice_history_attempts)
    GROUP BY ac.attempt_id
),
-- Count scenarios per simulation
practice_history_sim_scenario_count AS (
    SELECT
        s.id AS simulation_id,
        COUNT(ss.scenario_id)::int AS scenario_count
    FROM simulations s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM practice_history_attempts)
    GROUP BY s.id
),
-- Get scenario info
practice_history_scenario_ids AS (
    SELECT
        s.id AS simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY ss.position)::uuid[] AS scenario_ids_assigned
    FROM simulations s
    LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM practice_history_attempts)
    GROUP BY s.id
),
-- Join all history data
practice_attempt_rollup AS (
    SELECT
        pha.attempt_id,
        pha.simulation_id,
        pha.profile_id,
        pha.attempt_date,
        pha.is_archived,
        pha.infinite_mode,
        pha.simulation_name,
        pha.practice_simulation,
        pha.department_ids,
        COALESCE(phgr.completed_with_grade, 0) AS completed_with_grade,
        COALESCE(phssc.scenario_count, 0) AS sim_scenario_count,
        COALESCE(phgr.sum_grade_percent, 0) AS sum_grade_percent_zero_fill,
        COALESCE(php.persona_ids, ARRAY[]::uuid[]) AS persona_ids_distinct,
        COALESCE(phcr.scenario_ids_seen, ARRAY[]::uuid[]) AS leaf_scenarios_seen
    FROM practice_history_attempts pha
    LEFT JOIN practice_history_chat_rollup phcr ON phcr.attempt_id = pha.attempt_id
    LEFT JOIN practice_history_grade_rollup phgr ON phgr.attempt_id = pha.attempt_id
    LEFT JOIN practice_history_personas php ON php.attempt_id = pha.attempt_id
    LEFT JOIN practice_history_sim_scenario_count phssc ON phssc.simulation_id = pha.simulation_id
),
practice_attempt_joined AS (
    SELECT
        ar.*,
        phsi.scenario_ids_assigned,
        CASE
            WHEN r.points IS NULL OR r.points = 0 THEN NULL
            ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
        END AS pass_pct,
        (p.first_name || ' ' || p.last_name) AS profile_name
    FROM practice_attempt_rollup ar
    JOIN simulations s ON s.id = ar.simulation_id
    LEFT JOIN practice_history_scenario_ids phsi ON phsi.simulation_id = ar.simulation_id
    LEFT JOIN rubrics r ON r.id = s.rubric_id
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = ar.attempt_id AND ap.active = TRUE
    LEFT JOIN profiles p ON p.id = ap.profile_id
),
practice_final_rows AS (
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
        (NOT aj.is_archived) AS show_view,
        (NOT aj.is_archived) AND (
            aj.infinite_mode
            OR (aj.sim_scenario_count IS NOT NULL
                AND COALESCE(aj.completed_with_grade, 0) < aj.sim_scenario_count)
        ) AS show_continue,
        aj.persona_ids_distinct
    FROM practice_attempt_joined aj
),
practice_persona_labels AS (
    SELECT
        fr.attempt_id,
        COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names,
        COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors
    FROM practice_final_rows fr
    LEFT JOIN LATERAL (
        SELECT DISTINCT per.name, per.color
        FROM unnest(fr.persona_ids_distinct) AS pid
        JOIN personas per ON per.id = pid
    ) per ON TRUE
    GROUP BY fr.attempt_id
),
practice_scenario_names AS (
    SELECT
        fr.attempt_id,
        COALESCE(sn.names, ARRAY[]::text[]) AS names
    FROM practice_final_rows fr
    LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(s.name ORDER BY s.name) AS names
        FROM unnest(fr.scenario_ids_assigned) sid
        JOIN scenarios s ON s.id = sid
    ) sn ON TRUE
),
attempt_history_data AS (
    SELECT COALESCE(
        json_agg(
            json_build_object(
                'attemptId', fr.attempt_id::text,
                'date', fr.attempt_date,
                'profileId', fr.profile_id::text,
                'profileName', fr.profile_name,
                'simulationName', fr.simulation_name,
                'numScenarios', fr.num_scenarios,
                'numScenariosCompleted', fr.num_scenarios_completed,
                'infiniteMode', fr.infinite_mode,
                'timeLimit', (SELECT stl.time_limit_seconds FROM simulation_time_limits stl WHERE stl.simulation_id = fr.simulation_id AND stl.active = true LIMIT 1),
                'personaNames', COALESCE(pl.persona_names, ARRAY[]::text[]),
                'personaColors', COALESCE(pl.persona_colors, ARRAY[]::text[]),
                'score', fr.score_percent,
                'simulation_id', fr.simulation_id::text,
                'scenario_ids', COALESCE(fr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
                'scenario_titles', COALESCE(sn.names, ARRAY[]::text[]),
                'isArchived', fr.is_archived,
                'showView', fr.show_view,
                'showContinue', fr.show_continue,
                'practiceSimulation', COALESCE(fr.practice_simulation, false),
                'passPct', fr.pass_pct,
                'department_ids', fr.department_ids,
                'cohortNames', ARRAY[]::text[]
            )
            ORDER BY fr.attempt_date DESC, fr.attempt_id
        ),
        '[]'::json
    ) AS history
    FROM practice_final_rows fr
    LEFT JOIN practice_persona_labels pl ON pl.attempt_id = fr.attempt_id
    LEFT JOIN practice_scenario_names sn ON sn.attempt_id = fr.attempt_id
),
simulation_data AS (
    SELECT
        sim.id,
        sim.title,
        sim.description,
        (SELECT stl.time_limit_seconds FROM simulation_time_limits stl WHERE stl.simulation_id = sim.id AND stl.active = true LIMIT 1) as time_limit,
        sdd.department_ids
    FROM simulations sim
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = sim.id
    WHERE sim.active = true
      AND sim.practice_simulation = true
    GROUP BY sim.id, sim.title, sim.description, sdd.department_ids
    HAVING 
        (cardinality($2::uuid[]) = 0 OR sdd.department_ids IS NULL OR sdd.department_ids && $2::text[])
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = sim.id AND sd2.active = true))
),
simulation_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            sim.id::text,
            jsonb_build_object(
                'name', sim.title, 
                'description', sim.description,
                'time_limit', sim.time_limit,
                'department_ids', CASE 
                    WHEN sim.department_ids IS NOT NULL THEN to_jsonb(sim.department_ids)
                    ELSE NULL::jsonb
                END
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM simulation_data sim
),
persona_data AS (
    SELECT
        p.id,
        p.name,
        COALESCE(p.description, '') as description,
        p.color,
        p.icon
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    WHERE p.active = true
    GROUP BY p.id, p.name, p.description, p.color, p.icon
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true))
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', p.description,
                'color', p.color,
                'icon', p.icon
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM persona_data p
),
practice_scenario_ids AS (
    SELECT DISTINCT ss.scenario_id
    FROM simulation_scenarios ss
    JOIN simulations sim ON sim.id = ss.simulation_id
    WHERE sim.active = true
      AND sim.practice_simulation = true
),
scenario_data AS (
    SELECT
        s.id,
        s.name,
        COALESCE(sps.problem_statement, '') as description
    FROM scenarios s
    JOIN practice_scenario_ids psi ON psi.scenario_id = s.id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
    WHERE s.active = true
    GROUP BY s.id, s.name, sps.problem_statement
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(sd.scenario_id) FILTER (WHERE sd.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true))
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object('name', s.name, 'description', s.description)
        ),
        '{}'::jsonb
    ) as mapping
    FROM scenario_data s
),
parameter_data AS (
    SELECT
        par.id,
        par.name,
        COALESCE(par.description, '') as description,
        par.numerical,
        par.document_parameter
    FROM parameters par
    JOIN parameter_items pi ON pi.parameter_id = par.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE par.active = true
      AND par.practice_parameter = true
    GROUP BY par.id, par.name, par.description, par.numerical, par.document_parameter
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                  JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                  WHERE pi2.parameter_id = par.id AND pid2.active = true))
),
parameter_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            par.id::text,
            jsonb_build_object('name', par.name, 'description', par.description, 'numerical', par.numerical, 'document_parameter', par.document_parameter)
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_data par
),
parameter_item_data AS (
    SELECT
        pi.id,
        pi.name,
        COALESCE(pi.description, '') as description,
        pi.parameter_id,
        par.name as parameter_name,
        pi.value
    FROM parameter_items pi
    JOIN parameters par ON pi.parameter_id = par.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE par.active = true
      AND par.practice_parameter = true
    GROUP BY pi.id, pi.name, pi.description, pi.parameter_id, par.id, par.name, pi.value
    HAVING 
        (cardinality($2::uuid[]) = 0 OR COUNT(pid.parameter_item_id) FILTER (WHERE pid.department_id = ANY($2::uuid[])) > 0)
        OR (cardinality($2::uuid[]) = 0 OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                  WHERE pid2.parameter_item_id = pi.id AND pid2.active = true))
),
parameter_item_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            pi.id::text,
            jsonb_build_object(
                'name', pi.name,
                'description', pi.description,
                'parameter_id', pi.parameter_id::text,
                'parameter_name', pi.parameter_name,
                'value', pi.value
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM parameter_item_data pi
)
SELECT json_build_object(
    'mode', 'practice',
    'hasData', EXISTS(SELECT 1 FROM rows),
    'items', COALESCE((
        SELECT json_agg(item
            ORDER BY
                (item->>'simulationTitle') ILIKE 'general%' DESC,
                sort_last_activity DESC NULLS LAST,
                sort_title
        )
        FROM rows
    ), '[]'::json),
    'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping LIMIT 1), '{}'::jsonb),
    'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping LIMIT 1), '{}'::jsonb),
    'history', COALESCE((SELECT history FROM attempt_history_data LIMIT 1), '[]'::json),
    'simulation_mapping', COALESCE((SELECT mapping FROM simulation_mapping_data LIMIT 1), '{}'::jsonb),
    'persona_mapping', COALESCE((SELECT mapping FROM persona_mapping_data LIMIT 1), '{}'::jsonb),
    'scenario_mapping', COALESCE((SELECT mapping FROM scenario_mapping_data LIMIT 1), '{}'::jsonb),
    'parameter_mapping', COALESCE((SELECT mapping FROM parameter_mapping_data LIMIT 1), '{}'::jsonb),
    'parameter_item_mapping', COALESCE((SELECT mapping FROM parameter_item_mapping_data LIMIT 1), '{}'::jsonb)
) AS result
