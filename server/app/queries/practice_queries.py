"""Practice overview analytics queries."""

from typing import Any


class PracticeQueries:
    """Query builders for practice overview analytics."""

    def __init__(self) -> None:
        """Initialize practice queries."""
        pass

    def practice_overview(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build practice overview query - uses LIFETIME data for personal practice."""
        # Practice uses lifetime data, not date-filtered for scores
        # Only profile_id and department_ids matter
        params: list[Any] = []
        param_idx = 1

        # Add profile_id parameter
        profile_param_placeholder = f"${param_idx}::uuid"
        params.append(profile_id if profile_id else None)
        param_idx += 1

        # Add department_ids parameter
        dept_param_placeholder = f"${param_idx}::uuid[]"
        params.append(department_ids if department_ids else [])
        param_idx += 1

        query = f"""
            WITH
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
                WHERE s.active = TRUE
                  AND s.practice_simulation = TRUE
                  AND (cardinality({dept_param_placeholder}) = 0 OR s.department_id = ANY({dept_param_placeholder}))
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
                    WHERE s.practice_simulation = TRUE
                      AND (cardinality({dept_param_placeholder}) = 0 OR s.department_id = ANY({dept_param_placeholder}))
                    GROUP BY s.id, sp.persona_id
                ) sm
                LEFT JOIN personas p ON p.id = sm.persona_id
                GROUP BY sm.simulation_id
            ),
            -- 3) All-time analytics slice (lifetime data for this user)
            filt_all AS (
                SELECT a.*
                FROM analytics a
                WHERE a.profile_id = {profile_param_placeholder}
                  AND a.is_practice = TRUE
                  AND (cardinality({dept_param_placeholder}) = 0 OR a.department_id = ANY({dept_param_placeholder}))
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
                SELECT s.id AS simulation_id,
                       CASE WHEN r.points > 0
                            THEN (r.pass_points::numeric / r.points::numeric) * 100.0
                            ELSE 70 END AS pass_pct
                FROM simulations s
                JOIN rubrics r ON r.id = s.rubric_id
                WHERE s.practice_simulation = TRUE
                  AND s.active = TRUE
                  AND (cardinality({dept_param_placeholder}) = 0 OR s.department_id = ANY({dept_param_placeholder}))
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
                            FROM attempt_progress ap
                            WHERE ap.profile_id = {profile_param_placeholder}
                              AND ap.simulation_id = sm.simulation_id
                        ),
                        'rubric_id', sm.rubric_id::text,
                        'color', spm.color,
                        'icon', spm.icon,
                        'hasPassed', COALESCE((
                            SELECT MAX(ap.avg_score_completed) >= spp.pass_pct
                            FROM attempt_progress ap
                            JOIN sim_pass_pct spp ON spp.simulation_id = ap.simulation_id
                            WHERE ap.profile_id = {profile_param_placeholder}
                              AND ap.simulation_id = sm.simulation_id
                            GROUP BY spp.pass_pct
                        ), false),
                        'passRate', CASE
                                       WHEN sm.rubric_points > 0
                                         THEN ROUND(100.0 * sm.rubric_pass_points::numeric / sm.rubric_points)::int
                                       ELSE NULL
                                     END,
                        'status', CASE
                                     WHEN COALESCE((
                                            SELECT MAX(ap.avg_score_completed) >= spp.pass_pct
                                            FROM attempt_progress ap
                                            JOIN sim_pass_pct spp ON spp.simulation_id = ap.simulation_id
                                            WHERE ap.profile_id = {profile_param_placeholder}
                                              AND ap.simulation_id = sm.simulation_id
                                            GROUP BY spp.pass_pct
                                          ), false) THEN 'passed'
                                     WHEN COALESCE(aps.chats, 0) > 0 THEN 'in-progress'
                                     ELSE 'not-started'
                                   END,
                        'completionPct', COALESCE((
                            SELECT ROUND(100.0 * lap.completed_root_scenarios::numeric / GREATEST(sm.num_scenarios, 1))::int
                            FROM latest_attempt_per_profile_sim lap
                            WHERE lap.profile_id = {profile_param_placeholder}
                              AND lap.simulation_id = sm.simulation_id
                        ), 0),
                        'passedCount', NULL,
                        'inProgressCount', NULL,
                        'notStartedCount', NULL,
                        'passPct', NULL,
                        'cohortName', NULL,
                        'updatedAt', sm.updated_at,
                        'lastActivityTs', (
                            SELECT MAX(ap.last_time)
                            FROM attempt_progress ap
                            WHERE ap.profile_id = {profile_param_placeholder}
                              AND ap.simulation_id = sm.simulation_id
                        ),
                        'hasActivity', (COALESCE(aps.chats, 0) > 0),
                        'standard_groups', (
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
                        )
                    ) AS item,
                    sm.simulation_title AS sort_title,
                    (
                        SELECT MAX(ap.last_time)
                        FROM attempt_progress ap
                        WHERE ap.profile_id = {profile_param_placeholder}
                          AND ap.simulation_id = sm.simulation_id
                    ) AS sort_last_activity
                FROM sim_meta sm
                LEFT JOIN sim_persona_meta spm ON spm.simulation_id = sm.simulation_id
                LEFT JOIN activity_by_profile_sim aps
                       ON aps.profile_id = {profile_param_placeholder}
                      AND aps.simulation_id = sm.simulation_id
            ),
            -- Embedded: Attempt history data for practice
            practice_attempt_rollup AS (
                SELECT
                    a.attempt_id,
                    a.simulation_id,
                    MIN(a.attempt_created_at) AS attempt_date,
                    COUNT(*) FILTER (WHERE a.completed AND a.grade_percent IS NOT NULL) AS completed_with_grade,
                    MAX(a.sim_scenario_count) AS sim_scenario_count,
                    SUM(COALESCE(a.grade_percent, 0)) AS sum_grade_percent_zero_fill,
                    array_agg(DISTINCT a.persona_id) FILTER (WHERE a.persona_id IS NOT NULL) AS persona_ids_distinct,
                    array_agg(DISTINCT a.leaf_scenario_id) FILTER (WHERE a.leaf_scenario_id IS NOT NULL) AS leaf_scenarios_seen,
                    MIN(a.department_id::text)::uuid AS department_id
                FROM filt_all a
                GROUP BY a.attempt_id, a.simulation_id
            ),
            practice_attempt_joined AS (
                SELECT
                    ar.*,
                    ap.profile_id,
                    sa.archived AS is_archived,
                    sa.infinite_mode,
                    s.title AS simulation_name,
                    ARRAY(SELECT ss.scenario_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id ORDER BY ss.position) AS scenario_ids_assigned,
                    s.practice_simulation,
                    CASE
                        WHEN r.points IS NULL OR r.points = 0 THEN NULL
                        ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
                    END AS pass_pct,
                    (p.first_name || ' ' || p.last_name) AS profile_name
                FROM practice_attempt_rollup ar
                JOIN simulation_attempts sa ON sa.id = ar.attempt_id
                LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
                JOIN simulations s ON s.id = ar.simulation_id
                LEFT JOIN rubrics r ON r.id = s.rubric_id
                JOIN profiles p ON p.id = ap.profile_id
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
                    aj.department_id,
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
                    COALESCE(ARRAY_AGG(per.name ORDER BY per.name), ARRAY[]::text[]) AS persona_names,
                    COALESCE(ARRAY_AGG(per.color ORDER BY per.name), ARRAY[]::text[]) AS persona_colors
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
                            'timeLimit', (SELECT stl.time_limit_seconds FROM simulation_time_limits stl WHERE stl.simulation_id = fr.simulation_id AND stl.active = true),
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
                            'department_id', fr.department_id::text,
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
            simulation_mapping_data AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        sim.id::text,
                        jsonb_build_object(
                            'name', sim.title, 
                            'description', sim.description,
                            'time_limit', stl.time_limit_seconds
                        )
                    ),
                    '{{}}'::jsonb
                ) as mapping
                FROM simulations sim
                LEFT JOIN simulation_time_limits stl ON stl.simulation_id = sim.id AND stl.active = true
                WHERE sim.active = true
                  AND sim.practice_simulation = true
                  AND (cardinality({dept_param_placeholder}) = 0 OR sim.department_id = ANY({dept_param_placeholder}))
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
                    '{{}}'::jsonb
                ) as mapping
                FROM personas p
                WHERE p.active = true
                  AND (cardinality({dept_param_placeholder}) = 0 OR p.department_id = ANY({dept_param_placeholder}))
            ),
            scenario_mapping_data AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        s.id::text,
                        jsonb_build_object('name', s.name, 'description', COALESCE(sps.problem_statement, ''))
                    ),
                    '{{}}'::jsonb
                ) as mapping
                FROM scenarios s
                LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
                WHERE s.active = true
                  AND (cardinality({dept_param_placeholder}) = 0 OR s.department_id = ANY({dept_param_placeholder}))
            ),
            parameter_mapping_data AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        par.id::text,
                        jsonb_build_object('name', par.name, 'description', par.description)
                    ),
                    '{{}}'::jsonb
                ) as mapping
                FROM parameters par
                WHERE par.active = true
                  AND par.practice_parameter = true
                  AND (cardinality({dept_param_placeholder}) = 0 OR par.department_id = ANY({dept_param_placeholder}))
            ),
            parameter_item_mapping_data AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        pi.id::text,
                        jsonb_build_object(
                            'name', pi.name,
                            'description', pi.description,
                            'parameter_id', pi.parameter_id::text,
                            'parameter_name', par.name
                        )
                    ),
                    '{{}}'::jsonb
                ) as mapping
                FROM parameter_items pi
                JOIN parameters par ON pi.parameter_id = par.id
                WHERE par.active = true
                  AND par.practice_parameter = true
                  AND pi.default_item = true
                  AND (cardinality({dept_param_placeholder}) = 0 OR par.department_id = ANY({dept_param_placeholder}))
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
                'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping), '{{}}'::jsonb),
                'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{{}}'::jsonb),
                'history', (SELECT history FROM attempt_history_data),
                'simulation_mapping', (SELECT mapping FROM simulation_mapping_data),
                'persona_mapping', (SELECT mapping FROM persona_mapping_data),
                'scenario_mapping', (SELECT mapping FROM scenario_mapping_data),
                'parameter_mapping', (SELECT mapping FROM parameter_mapping_data),
                'parameter_item_mapping', (SELECT mapping FROM parameter_item_mapping_data)
            ) AS result
        """

        return query, params
