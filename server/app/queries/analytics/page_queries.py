"""Page-specific analytics queries - 3 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class PageQueries:
    """Query builders for page-specific analytics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def home_overview(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build home overview query with proper cohort filtering and scoring logic."""
        where_clause, base_params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        # Determine mode based on profile_id
        view_mode = "ta" if profile_id else "instructional"
        
        # We need to add separate parameters for CTEs that aren't covered by the filt CTE
        # Start params list with base params
        params = list(base_params)
        param_idx = len(params) + 1
        
        # Add parameters for cohort_sim CTE filtering
        cohort_param_placeholder = f"${param_idx}::uuid[]"
        params.append(cohort_ids if cohort_ids else [])
        param_idx += 1
        
        dept_param_placeholder = f"${param_idx}::uuid[]"
        params.append(department_ids if department_ids else [])
        param_idx += 1
        
        # Add separate param for profile_id (used in TA view)
        profile_param_placeholder = f"${param_idx}::uuid"
        params.append(profile_id if profile_id else None)
        param_idx += 1
        
        # Add separate param for roles (used in cohort_membership)
        roles_param_placeholder = f"${param_idx}::profile_role[]"
        params.append(roles if roles else [])
        param_idx += 1

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            -- Get cohort-simulation pairs (includes empty cohorts)
            cohort_sim AS (
                SELECT c.id AS cohort_id, c.title AS cohort_title, cs.simulation_id
                FROM cohorts c
                JOIN cohort_simulations cs ON cs.cohort_id = c.id
                WHERE (cardinality({cohort_param_placeholder}) = 0 OR c.id = ANY({cohort_param_placeholder}))
                  AND (cardinality({dept_param_placeholder}) = 0 OR c.department_id = ANY({dept_param_placeholder}))
            ),
            -- Expected scenarios per simulation
            sim_expected AS (
                SELECT s.id AS simulation_id,
                       COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS expected_scenarios
                FROM simulations s
            ),
            -- Per attempt: sum grade_percent over completed root scenarios
            attempt_scores AS (
                SELECT
                    ap.attempt_id,
                    ap.profile_id,
                    ap.simulation_id,
                    COALESCE(SUM(ap.grade_percent) FILTER (WHERE ap.completed AND ap.grade_percent IS NOT NULL), 0)::numeric AS sum_completed_pct,
                    se.expected_scenarios
                FROM filt ap
                JOIN sim_expected se ON se.simulation_id = ap.simulation_id
                GROUP BY ap.attempt_id, ap.profile_id, ap.simulation_id, se.expected_scenarios
            ),
            -- Average over expected scenarios (missing = 0)
            attempt_avg AS (
                SELECT
                    attempt_id,
                    profile_id,
                    simulation_id,
                    CASE WHEN expected_scenarios > 0
                         THEN (sum_completed_pct / expected_scenarios)
                         ELSE 0 END AS avg_pct_over_expected
                FROM attempt_scores
            ),
            -- Best attempt per (profile, simulation)
            best_user_sim AS (
                SELECT DISTINCT ON (profile_id, simulation_id)
                       profile_id, simulation_id, avg_pct_over_expected
                FROM attempt_avg
                ORDER BY profile_id, simulation_id, avg_pct_over_expected DESC
            ),
            -- Pass threshold per simulation
            sim_pass_pct AS (
                SELECT s.id AS simulation_id,
                       CASE WHEN r.points > 0
                            THEN (r.pass_points::numeric / r.points::numeric) * 100.0
                            ELSE 70 END AS pass_pct
                FROM simulations s
                JOIN rubrics r ON r.id = s.rubric_id
            ),
            -- Compute per user status using best attempt & threshold
            user_sim_status AS (
                SELECT
                    b.profile_id,
                    b.simulation_id,
                    b.avg_pct_over_expected,
                    sp.pass_pct,
                    (b.avg_pct_over_expected >= sp.pass_pct) AS passed,
                    COALESCE(abps.completed_chats, 0) AS chats_completed
                FROM best_user_sim b
                JOIN sim_pass_pct sp ON sp.simulation_id = b.simulation_id
                LEFT JOIN (
                    SELECT profile_id, simulation_id,
                           COUNT(DISTINCT chat_id) FILTER (WHERE completed) AS completed_chats
                    FROM filt
                    GROUP BY profile_id, simulation_id
                ) abps ON abps.profile_id = b.profile_id AND abps.simulation_id = b.simulation_id
            ),
            -- Cohort membership exploded & filtered
            cohort_membership AS (
                SELECT
                    c.id    AS cohort_id,
                    c.title AS cohort_title,
                    cs.simulation_id,
                    cp.profile_id
                FROM cohorts c
                JOIN cohort_simulations cs ON cs.cohort_id = c.id
                JOIN cohort_profiles cp ON cp.cohort_id = c.id
                LEFT JOIN profiles pr ON pr.id = cp.profile_id
                WHERE (cardinality({cohort_param_placeholder}) = 0 OR c.id = ANY({cohort_param_placeholder}))
                  AND (cardinality({roles_param_placeholder}) = 0 OR pr.role = ANY({roles_param_placeholder}))
                  AND (cardinality({dept_param_placeholder}) = 0 OR c.department_id = ANY({dept_param_placeholder}))
            ),
            -- Simulation metadata with persona color/icon
            sim_meta AS (
                SELECT
                    s.id AS simulation_id,
                    s.title,
                    s.description,
                    stl.time_limit_seconds as time_limit,
                    s.rubric_id,
                    COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
                    r.points AS rubric_points,
                    r.pass_points AS rubric_pass_points
                FROM simulations s
                LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
                JOIN rubrics r ON r.id = s.rubric_id
                WHERE (cardinality({dept_param_placeholder}) = 0 OR s.department_id = ANY({dept_param_placeholder}))
            ),
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
                    GROUP BY s.id, sp.persona_id
                ) sm
                LEFT JOIN personas p ON p.id = sm.persona_id
                GROUP BY sm.simulation_id
            ),
            -- TA VIEW: sims the TA is part of
            ta_sim_space AS (
                SELECT DISTINCT m.simulation_id
                FROM cohort_membership m
                WHERE {profile_param_placeholder} IS NOT NULL 
                  AND m.profile_id = {profile_param_placeholder}
                UNION
                SELECT DISTINCT uss.simulation_id
                FROM user_sim_status uss
                WHERE {profile_param_placeholder} IS NOT NULL 
                  AND uss.profile_id = {profile_param_placeholder}
            ),
            ta_primary_cohort AS (
                SELECT
                    c.id AS cohort_id,
                    c.title AS cohort_title,
                    cs.simulation_id,
                    ROW_NUMBER() OVER (ORDER BY c.id, cs.simulation_id) AS order_idx,
                    ROW_NUMBER() OVER (PARTITION BY cs.simulation_id ORDER BY c.id) AS rn
                FROM cohorts c
                JOIN cohort_simulations cs ON cs.cohort_id = c.id
                JOIN cohort_profiles cp ON cp.cohort_id = c.id 
                    AND cp.profile_id = {profile_param_placeholder}
                WHERE (cardinality({cohort_param_placeholder}) = 0 OR c.id = ANY({cohort_param_placeholder}))
                  AND (cardinality({dept_param_placeholder}) = 0 OR c.department_id = ANY({dept_param_placeholder}))
            ),
            ta_rows AS (
                SELECT
                    json_build_object(
                        'viewMode', 'ta',
                        'id', s.simulation_id::text,
                        'simulationTitle', s.title,
                        'simulationDescription', s.description,
                        'simulationName', s.title,
                        'timeLimit', s.time_limit,
                        'numSessions', s.num_scenarios,
                        'highestScore', (
                            SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ),
                        'rubric_id', s.rubric_id::text,
                        'color', spm.color,
                        'icon', spm.icon,
                        'hasPassed', (
                            SELECT COALESCE(uss.passed, false)
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ),
                        'passRate', CASE WHEN s.rubric_points > 0
                                         THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                         ELSE NULL END,
                        'status', (
                            SELECT CASE
                                      WHEN COALESCE(uss.passed, false) THEN 'passed'
                                      WHEN COALESCE(uss.chats_completed, 0) > 0 THEN 'in-progress'
                                      ELSE 'not-started'
                                    END
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ),
                        'completionPct', (
                            SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ),
                        'passedCount', NULL,
                        'inProgressCount', NULL,
                        'notStartedCount', NULL,
                        'passPct', CASE WHEN s.rubric_points > 0
                                        THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                        ELSE NULL END,
                        'cohortName', (
                            SELECT tpc.cohort_title
                            FROM ta_primary_cohort tpc
                            WHERE tpc.simulation_id = s.simulation_id AND tpc.rn = 1
                        ),
                        'cohortNames', (
                            SELECT CASE
                                      WHEN array_length(titles, 1) IS NULL OR array_length(titles, 1) = 0 THEN NULL
                                      WHEN array_length(titles, 1) = 1 THEN titles[1]
                                      WHEN array_length(titles, 1) = 2 THEN titles[1] || ' and ' || titles[2]
                                      ELSE array_to_string(titles[1:array_length(titles,1)-1], ', ')
                                           || ', and ' || titles[array_length(titles,1)]
                                    END
                            FROM (
                                SELECT ARRAY_AGG(DISTINCT c.cohort_title ORDER BY c.cohort_title) AS titles
                                FROM cohort_membership c
                                WHERE c.simulation_id = s.simulation_id 
                                  AND c.profile_id = {profile_param_placeholder}
                            ) x
                        ),
                        'orderIndex', (
                            SELECT tpc.order_idx
                            FROM ta_primary_cohort tpc
                            WHERE tpc.simulation_id = s.simulation_id AND tpc.rn = 1
                        ),
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
                            WHERE sg.rubric_id = s.rubric_id
                        )
                    ) AS item
                FROM sim_meta s
                LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
                WHERE {profile_param_placeholder} IS NOT NULL
                  AND EXISTS (SELECT 1 FROM ta_sim_space t WHERE t.simulation_id = s.simulation_id)
            ),
            -- INSTRUCTIONAL VIEW: counts across all cohort members
            inst_counts AS (
                SELECT
                    cs.simulation_id,
                    COUNT(DISTINCT cm.profile_id) AS total_members,
                    COUNT(DISTINCT CASE WHEN uss.passed THEN cm.profile_id END) AS passed_count,
                    COUNT(DISTINCT CASE WHEN (NOT uss.passed) AND uss.chats_completed > 0 THEN cm.profile_id END) AS in_progress_count
                FROM cohort_sim cs
                LEFT JOIN cohort_membership cm ON cm.cohort_id = cs.cohort_id AND cm.simulation_id = cs.simulation_id
                LEFT JOIN user_sim_status uss ON uss.profile_id = cm.profile_id AND uss.simulation_id = cs.simulation_id
                GROUP BY cs.simulation_id
            ),
            inst_cohort_names AS (
                SELECT
                    cs.simulation_id,
                    ARRAY_AGG(DISTINCT cs.cohort_title ORDER BY cs.cohort_title) AS titles
                FROM cohort_sim cs
                GROUP BY cs.simulation_id
            ),
            inst_rows AS (
                SELECT
                    json_build_object(
                        'viewMode', 'instructional',
                        'id', s.simulation_id::text,
                        'simulationTitle', s.title,
                        'simulationDescription', s.description,
                        'simulationName', s.title,
                        'timeLimit', s.time_limit,
                        'numSessions', s.num_scenarios,
                        'highestScore', NULL,
                        'rubric_id', s.rubric_id::text,
                        'color', spm.color,
                        'icon', spm.icon,
                        'hasPassed', CASE
                                        WHEN COALESCE(ic.total_members, 0) = 0 THEN true
                                        WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN true
                                        ELSE false END,
                        'passRate', CASE WHEN s.rubric_points > 0
                                         THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                         ELSE NULL END,
                        'status', CASE
                                     WHEN COALESCE(ic.total_members, 0) = 0 THEN 'passed'
                                     WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN 'passed'
                                     WHEN COALESCE(ic.passed_count, 0) > 0 OR COALESCE(ic.in_progress_count, 0) > 0 THEN 'in-progress'
                                     ELSE 'not-started'
                                   END,
                        'completionPct', CASE
                                            WHEN COALESCE(ic.total_members, 0) > 0
                                            THEN ROUND(100.0 * (COALESCE(ic.passed_count, 0) + COALESCE(ic.in_progress_count, 0))::numeric / ic.total_members)::int
                                            ELSE 0
                                          END,
                        'passedCount', COALESCE(ic.passed_count, 0),
                        'inProgressCount', COALESCE(ic.in_progress_count, 0),
                        'notStartedCount', GREATEST(COALESCE(ic.total_members, 0) - COALESCE(ic.passed_count, 0) - COALESCE(ic.in_progress_count, 0), 0),
                        'passPct', NULL,
                        'cohortName', (icn.titles)[1],
                        'cohortNames', CASE
                                          WHEN array_length(icn.titles, 1) IS NULL OR array_length(icn.titles, 1) = 0 THEN NULL
                                          WHEN array_length(icn.titles, 1) = 1 THEN icn.titles[1]
                                          WHEN array_length(icn.titles, 1) = 2 THEN icn.titles[1] || ' and ' || icn.titles[2]
                                          ELSE array_to_string(icn.titles[1:array_length(icn.titles,1)-1], ', ')
                                               || ', and ' || icn.titles[array_length(icn.titles,1)]
                                        END,
                        'orderIndex', ROW_NUMBER() OVER (ORDER BY s.simulation_id),
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
                        WHERE sg.rubric_id = s.rubric_id
                        )
                    ) AS item,
                    CASE
                        WHEN COALESCE(ic.total_members, 0) = 0 THEN true
                        WHEN COALESCE(ic.passed_count, 0) = COALESCE(ic.total_members, 0) THEN true
                        ELSE false
                    END AS has_passed_bool,
                    (icn.titles)[1] AS sort_cohort_name,
                    s.title AS sort_title
                FROM sim_meta s
                JOIN inst_counts ic ON ic.simulation_id = s.simulation_id
                LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
                LEFT JOIN inst_cohort_names icn ON icn.simulation_id = s.simulation_id
                WHERE {profile_param_placeholder} IS NULL
            ),
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
            )
            SELECT json_build_object(
                'mode', '{view_mode}',
                'hasData', CASE WHEN '{view_mode}' = 'ta' THEN EXISTS(SELECT 1 FROM ta_rows) ELSE EXISTS(SELECT 1 FROM inst_rows) END,
                'items', CASE 
                    WHEN '{view_mode}' = 'ta' THEN COALESCE((SELECT json_agg(item ORDER BY (item->>'simulationTitle')) FROM ta_rows), '[]'::json)
                    ELSE COALESCE((SELECT json_agg(item ORDER BY has_passed_bool ASC, sort_cohort_name NULLS LAST, sort_title) FROM inst_rows), '[]'::json)
                END,
                'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping), '{{}}'::jsonb),
                'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{{}}'::jsonb)
            ) AS result
        """

        return query, params

    def attempt_history(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build attempt history query with infinite mode, personas, and scenarios."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            -- Attempt-level aggregates from chat-grain MV
            attempt_rollup AS (
                SELECT
                    a.attempt_id,
                    a.simulation_id,
                    MIN(a.attempt_created_at) AS attempt_date,
                    MIN(a.chat_created_at) AS first_chat_at,
                    MAX(a.chat_created_at) AS last_activity_at,
                    COUNT(*) FILTER (WHERE a.completed AND a.grade_percent IS NOT NULL) AS completed_with_grade,
                    MAX(a.sim_scenario_count) AS sim_scenario_count,
                    SUM(COALESCE(a.grade_percent, 0)) AS sum_grade_percent_zero_fill,
                    array_agg(DISTINCT a.persona_id) FILTER (WHERE a.persona_id IS NOT NULL) AS persona_ids_distinct,
                    array_agg(DISTINCT a.leaf_scenario_id) FILTER (WHERE a.leaf_scenario_id IS NOT NULL) AS leaf_scenarios_seen,
                    MIN(a.department_id::text)::uuid AS department_id
                FROM filt a
                GROUP BY a.attempt_id, a.simulation_id
            ),
            -- Join attempt + sim + rubric + profile + attempt flags
            attempt_joined AS (
                SELECT
                    ar.*,
                    ap.profile_id,
                    sa.archived AS is_archived,
                    sa.infinite_mode,
                    s.title AS simulation_name,
                    ARRAY(SELECT ss.scenario_id FROM simulation_scenarios ss WHERE ss.simulation_id = s.id ORDER BY ss.position) AS scenario_ids_assigned,
                    s.practice_simulation,
                    r.id AS rubric_id,
                    r.points AS rubric_points,
                    r.pass_points AS rubric_pass_points,
                    CASE
                        WHEN r.points IS NULL OR r.points = 0 THEN NULL
                        ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
                    END AS pass_pct,
                    (p.first_name || ' ' || p.last_name) AS profile_name
                FROM attempt_rollup ar
                JOIN simulation_attempts sa ON sa.id = ar.attempt_id
                LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
                JOIN simulations s ON s.id = ar.simulation_id
                LEFT JOIN rubrics r ON r.id = s.rubric_id
                JOIN profiles p ON p.id = ap.profile_id
            ),
            -- Final shaping with scoring semantics
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
                FROM attempt_joined aj
            ),
            -- Persona labels aggregated once per attempt
            persona_labels AS (
                SELECT
                    fr.attempt_id,
                    COALESCE(ARRAY_AGG(per.name ORDER BY per.name), ARRAY[]::text[]) AS persona_names,
                    COALESCE(ARRAY_AGG(per.color ORDER BY per.name), ARRAY[]::text[]) AS persona_colors
                FROM final_rows fr
                LEFT JOIN LATERAL (
                    SELECT DISTINCT per.name, per.color
                    FROM unnest(fr.persona_ids_distinct) AS pid
                    JOIN personas per ON per.id = pid
                ) per ON TRUE
                GROUP BY fr.attempt_id
            ),
            -- Scenario names via single LATERAL per attempt
            scenario_names AS (
                SELECT
                    fr.attempt_id,
                    COALESCE(sn.names, ARRAY[]::text[]) AS names
                FROM final_rows fr
                LEFT JOIN LATERAL (
                    SELECT ARRAY_AGG(s.name ORDER BY s.name) AS names
                    FROM unnest(fr.scenario_ids_assigned) sid
                    JOIN scenarios s ON s.id = sid
                ) sn ON TRUE
            )
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
                        'department_id', fr.department_id::text
                    )
                    ORDER BY fr.attempt_date DESC, fr.attempt_id
                ),
                '[]'::json
            ) AS result
            FROM final_rows fr
            LEFT JOIN persona_labels pl ON pl.attempt_id = fr.attempt_id
            LEFT JOIN scenario_names sn ON sn.attempt_id = fr.attempt_id
        """

        return query, params

    def practice_overview(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build practice overview query - uses LIFETIME data for personal practice."""
        # Practice uses lifetime data, not date-filtered for scores
        # Only profile_id and department_ids matter
        params: List[Any] = []
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
                    NULL::int AS time_limit,
                    s.rubric_id,
                    COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
                    r.points AS rubric_points,
                    r.pass_points AS rubric_pass_points,
                    s.updated_at
                FROM simulations s
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
                'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{{}}'::jsonb)
            ) AS result
        """

        return query, params

