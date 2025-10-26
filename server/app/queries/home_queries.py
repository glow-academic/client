"""Home overview analytics queries - ONE query per service method."""

from datetime import datetime
from typing import Any

from app.queries.base_queries import AnalyticsQueryBuilder


class HomeQueries:
    """Query builders for home overview analytics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def home_overview(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """
        Build home overview query with embedded history and mappings.

        Returns ONE JSON object with all data:
        - mode: 'ta' | 'instructional' | 'empty'
        - hasData: boolean
        - items: array of simulation items
        - history: array of attempt history
        - standard_groups_mapping: JSONB mapping object
        - standards_mapping: JSONB mapping object
        - simulation_mapping: JSONB mapping object

        Parameters:
        - profile_id: User's profile ID
        - For TA users: profile_id filters both items and history
        - For non-TA users: profile_id only filters history, items show all cohort data
        - View mode determined in SQL by looking up profile's role
        """
        # Build base filter for items (hardcoded to general simulations only)
        # Note: roles filter for cohort_membership is added separately below
        where_clause, base_params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            None,  # Don't filter analytics by role here - only used for cohort_membership
            ["general"],  # Hardcoded to general simulations only
            None,  # Don't filter by profileId in base - handled in SQL
            department_ids,
        )

        # Build parameter list - start with base params
        params = list(base_params)
        param_idx = len(params) + 1

        # Parameters for cohort_sim CTE filtering
        cohort_param_placeholder = f"${param_idx}::uuid[]"
        params.append(cohort_ids if cohort_ids else [])
        param_idx += 1

        dept_param_placeholder = f"${param_idx}::uuid[]"
        params.append(department_ids if department_ids else [])
        param_idx += 1

        # Profile ID parameter (used for TA filtering)
        profile_param_placeholder = f"${param_idx}::uuid"
        params.append(profile_id if profile_id else None)
        param_idx += 1

        # Roles for cohort_membership CTE (hardcoded to "ta" for home page)
        roles_param_placeholder = f"${param_idx}::profile_role[]"
        params.append(["ta"])  # Always filter to TA role for home
        param_idx += 1

        # History query parameters (fresh data, not analytics MV)
        # Convert ISO strings to datetime objects for asyncpg
        history_start_date_param = f"${param_idx}"
        params.append(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
        param_idx += 1

        history_end_date_param = f"${param_idx}"
        params.append(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
        param_idx += 1

        history_profile_param = f"${param_idx}::uuid"
        params.append(profile_id if profile_id else None)
        param_idx += 1

        history_cohort_param = f"${param_idx}::uuid[]"
        params.append(cohort_ids if cohort_ids else [])
        param_idx += 1

        history_dept_param = f"${param_idx}::uuid[]"
        params.append(department_ids if department_ids else [])
        param_idx += 1

        query = f"""
            WITH 
            -- Look up profile role if profileId provided
            profile_role_lookup AS (
                SELECT 
                    CASE 
                        WHEN {profile_param_placeholder} IS NULL THEN 'instructional'
                        WHEN (SELECT role FROM profiles WHERE id = {profile_param_placeholder}) = 'ta' THEN 'ta'
                        ELSE 'instructional'
                    END AS mode,
                    CASE
                        WHEN {profile_param_placeholder} IS NULL THEN false
                        ELSE COALESCE((SELECT role = 'ta' FROM profiles WHERE id = {profile_param_placeholder}), false)
                    END AS is_ta_mode
            ),
            -- Filter analytics for items: for TA mode include profileId filter
            filt AS (
                SELECT a.* 
                FROM analytics a, profile_role_lookup prl
                WHERE {where_clause}
                  AND (NOT prl.is_ta_mode OR a.profile_id = {profile_param_placeholder})
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
            -- User-simulation status with best attempt + pass status
            user_sim_status AS (
                SELECT
                    aa.profile_id,
                    aa.simulation_id,
                    MAX(aa.avg_pct_over_expected) AS avg_pct_over_expected,
                    BOOL_OR(aa.avg_pct_over_expected >= COALESCE(
                        (SELECT ROUND(100.0 * r.pass_points::numeric / NULLIF(r.points,0))
                         FROM simulations s JOIN rubrics r ON r.id = s.rubric_id
                         WHERE s.id = aa.simulation_id), 0
                    )) AS passed,
                    COUNT(*) AS chats_completed
                FROM attempt_avg aa
                GROUP BY aa.profile_id, aa.simulation_id
            ),
            -- Cohort membership CTE
            cohort_membership AS (
                SELECT
                    cp.profile_id,
                    cp.cohort_id,
                    cs.simulation_id,
                    c.title AS cohort_title,
                    p.role
                FROM cohort_profiles cp
                JOIN cohorts c ON c.id = cp.cohort_id
                JOIN cohort_simulations cs ON cs.cohort_id = c.id
                JOIN profiles p ON p.id = cp.profile_id
                WHERE (cardinality({cohort_param_placeholder}) = 0 OR c.id = ANY({cohort_param_placeholder}))
                  AND (cardinality({dept_param_placeholder}) = 0 OR c.department_id = ANY({dept_param_placeholder}))
                  AND (cardinality({roles_param_placeholder}) = 0 OR p.role = ANY({roles_param_placeholder}))
            ),
            -- Simulation metadata
            sim_meta AS (
                SELECT DISTINCT
                    s.id AS simulation_id,
                    s.title,
                    s.description,
                    stl.time_limit_seconds as time_limit,
                    s.rubric_id,
                    COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
                    COALESCE(r.points, 0) AS rubric_points,
                    COALESCE(r.pass_points, 0) AS rubric_pass_points
                FROM simulations s
                LEFT JOIN rubrics r ON r.id = s.rubric_id
                LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
                WHERE s.id IN (SELECT simulation_id FROM cohort_sim)
            ),
            -- Simulation persona metadata
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
                    WHERE s.id IN (SELECT simulation_id FROM sim_meta)
                    GROUP BY s.id, sp.persona_id
                ) sm
                LEFT JOIN personas p ON p.id = sm.persona_id
                GROUP BY sm.simulation_id
            ),
            -- TA VIEW: Primary cohort per simulation for the TA
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
            ta_sim_space AS (
                SELECT DISTINCT simulation_id FROM ta_primary_cohort
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
                        'status', COALESCE((
                            SELECT CASE
                                      WHEN COALESCE(uss.passed, false) THEN 'passed'
                                      WHEN COALESCE(uss.chats_completed, 0) > 0 THEN 'in-progress'
                                      ELSE 'not-started'
                                    END
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ), 'not-started'),
                        'completionPct', COALESCE((
                            SELECT ROUND(GREATEST(0, LEAST(100, uss.avg_pct_over_expected)))::int
                            FROM user_sim_status uss
                            WHERE uss.profile_id = {profile_param_placeholder}
                              AND uss.simulation_id = s.simulation_id
                        ), 0),
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
                WHERE EXISTS (SELECT 1 FROM profile_role_lookup prl WHERE prl.is_ta_mode)
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
                WHERE NOT EXISTS (SELECT 1 FROM profile_role_lookup prl WHERE prl.is_ta_mode)
            ),
            all_rubric_ids AS (
                SELECT DISTINCT rubric_id FROM sim_meta
            ),
            standard_groups_mapping AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        sg.id::text,
                        jsonb_build_object(
                            'name', sg.name,
                            'description', sg.description,
                            'points', sg.points,
                            'passPoints', sg.pass_points
                        )
                    ),
                    '{{}}'::jsonb
                ) AS mapping
                FROM standard_groups sg
                WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
            ),
            standards_mapping AS (
                SELECT COALESCE(
                    jsonb_object_agg(
                        st.id::text,
                        jsonb_build_object(
                            'name', st.name,
                            'description', st.description,
                            'points', st.points
                        )
                    ),
                    '{{}}'::jsonb
                ) AS mapping
                FROM standards st
                WHERE st.standard_group_id IN (
                    SELECT sg.id FROM standard_groups sg
                    WHERE sg.rubric_id IN (SELECT rubric_id FROM all_rubric_ids)
                )
            ),
            -- FRESH HISTORY DATA: Query base tables directly, not analytics MV
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
                    sim.department_id
                FROM simulation_attempts sa
                JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
                JOIN simulations sim ON sim.id = sa.simulation_id
                WHERE sa.created_at >= {history_start_date_param}
                  AND sa.created_at <= {history_end_date_param}
                  AND sim.practice_simulation = FALSE
                  AND (cardinality({history_dept_param}) = 0 OR sim.department_id = ANY({history_dept_param}))
                  AND ({history_profile_param} IS NULL OR ap.profile_id = {history_profile_param})
            ),
            -- Get cohorts for each attempt's profile
            history_attempt_cohorts AS (
                SELECT
                    ha.attempt_id,
                    COALESCE(ARRAY_AGG(DISTINCT c.id) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::uuid[]) AS cohort_ids,
                    COALESCE(ARRAY_AGG(DISTINCT c.title) FILTER (WHERE c.id IS NOT NULL AND cs.simulation_id = ha.simulation_id), ARRAY[]::text[]) AS cohort_names
                FROM history_attempts ha
                LEFT JOIN cohort_profiles cp ON cp.profile_id = ha.profile_id
                LEFT JOIN cohorts c ON c.id = cp.cohort_id AND c.active = TRUE
                LEFT JOIN cohort_simulations cs ON cs.cohort_id = c.id
                WHERE (cardinality({history_cohort_param}) = 0 OR c.id = ANY({history_cohort_param}))
                GROUP BY ha.attempt_id
            ),
            -- Filter attempts by cohort membership
            history_attempts_filtered AS (
                SELECT ha.*
                FROM history_attempts ha
                JOIN history_attempt_cohorts hac ON hac.attempt_id = ha.attempt_id
                WHERE (cardinality({history_cohort_param}) = 0 OR cardinality(hac.cohort_ids) > 0)
            ),
            -- Aggregate chats per attempt
            history_chat_rollup AS (
                SELECT
                    sc.attempt_id,
                    COUNT(*) FILTER (WHERE sc.completed) AS completed_chats,
                    MIN(sc.created_at) AS first_chat_at,
                    MAX(sc.created_at) AS last_activity_at,
                    array_agg(DISTINCT sc.scenario_id) FILTER (WHERE sc.scenario_id IS NOT NULL) AS scenario_ids_seen
                FROM simulation_chats sc
                WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_filtered)
                GROUP BY sc.attempt_id
            ),
            -- Get latest grade per chat
            history_chat_grades AS (
                SELECT DISTINCT ON (scg.simulation_chat_id)
                    scg.simulation_chat_id AS chat_id,
                    scg.score,
                    scg.rubric_id
                FROM simulation_chat_grades scg
                WHERE scg.simulation_chat_id IN (
                    SELECT sc.id FROM simulation_chats sc
                    WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_filtered)
                )
                ORDER BY scg.simulation_chat_id, scg.created_at DESC
            ),
            -- Aggregate grades per attempt
            history_grade_rollup AS (
                SELECT
                    sc.attempt_id,
                    COUNT(*) FILTER (WHERE hcg.score IS NOT NULL) AS completed_with_grade,
                    SUM(CASE WHEN hcg.score IS NOT NULL AND r.points > 0
                        THEN (hcg.score / r.points::numeric * 100.0)
                        ELSE 0 END) AS sum_grade_percent
                FROM simulation_chats sc
                LEFT JOIN history_chat_grades hcg ON hcg.chat_id = sc.id
                LEFT JOIN rubrics r ON r.id = hcg.rubric_id
                WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_filtered)
                GROUP BY sc.attempt_id
            ),
            -- Get personas for each attempt
            history_personas AS (
                SELECT
                    sc.attempt_id,
                    array_agg(DISTINCT sp.persona_id) FILTER (WHERE sp.persona_id IS NOT NULL) AS persona_ids
                FROM simulation_chats sc
                JOIN scenarios scn ON scn.id = sc.scenario_id
                LEFT JOIN scenario_personas sp ON sp.scenario_id = scn.id AND sp.active = TRUE
                WHERE sc.attempt_id IN (SELECT attempt_id FROM history_attempts_filtered)
                GROUP BY sc.attempt_id
            ),
            -- Count scenarios per simulation
            history_sim_scenario_count AS (
                SELECT
                    s.id AS simulation_id,
                    COUNT(ss.scenario_id)::int AS scenario_count
                FROM simulations s
                LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
                WHERE s.id IN (SELECT simulation_id FROM history_attempts_filtered)
                GROUP BY s.id
            ),
            -- Get scenario info
            history_scenario_ids AS (
                SELECT
                    s.id AS simulation_id,
                    ARRAY_AGG(ss.scenario_id ORDER BY ss.position)::uuid[] AS scenario_ids_assigned
                FROM simulations s
                LEFT JOIN simulation_scenarios ss ON ss.simulation_id = s.id
                WHERE s.id IN (SELECT simulation_id FROM history_attempts_filtered)
                GROUP BY s.id
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
                    haf.department_id,
                    COALESCE(hcr.first_chat_at, haf.attempt_date) AS first_chat_at,
                    COALESCE(hcr.last_activity_at, haf.attempt_date) AS last_activity_at,
                    COALESCE(hgr.completed_with_grade, 0) AS completed_with_grade,
                    COALESCE(hssc.scenario_count, 0) AS sim_scenario_count,
                    COALESCE(hgr.sum_grade_percent, 0) AS sum_grade_percent_zero_fill,
                    COALESCE(hp.persona_ids, ARRAY[]::uuid[]) AS persona_ids_distinct,
                    COALESCE(hcr.scenario_ids_seen, ARRAY[]::uuid[]) AS leaf_scenarios_seen
                FROM history_attempts_filtered haf
                LEFT JOIN history_chat_rollup hcr ON hcr.attempt_id = haf.attempt_id
                LEFT JOIN history_grade_rollup hgr ON hgr.attempt_id = haf.attempt_id
                LEFT JOIN history_personas hp ON hp.attempt_id = haf.attempt_id
                LEFT JOIN history_sim_scenario_count hssc ON hssc.simulation_id = haf.simulation_id
            ),
            attempt_cohort_ids AS (
                SELECT
                    attempt_id,
                    cohort_ids AS profile_cohort_ids
                FROM history_attempt_cohorts
            ),
            attempt_joined AS (
                SELECT
                    ar.*,
                    hsi.scenario_ids_assigned,
                    r.id AS rubric_id,
                    r.points AS rubric_points,
                    r.pass_points AS rubric_pass_points,
                    CASE
                        WHEN r.points IS NULL OR r.points = 0 THEN NULL
                        ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
                    END AS pass_pct,
                    (p.first_name || ' ' || p.last_name) AS profile_name
                FROM attempt_rollup ar
                JOIN simulations s ON s.id = ar.simulation_id
                LEFT JOIN history_scenario_ids hsi ON hsi.simulation_id = ar.simulation_id
                LEFT JOIN rubrics r ON r.id = s.rubric_id
                JOIN profiles p ON p.id = ar.profile_id
            ),
            attempt_cohort_names AS (
                SELECT
                    attempt_id,
                    cohort_names
                FROM history_attempt_cohorts
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
            persona_labels AS (
                SELECT
                    fr.attempt_id,
                    COALESCE(ARRAY_AGG(per.name ORDER BY per.name) FILTER (WHERE per.name IS NOT NULL), ARRAY[]::text[]) AS persona_names,
                    COALESCE(ARRAY_AGG(per.color ORDER BY per.name) FILTER (WHERE per.color IS NOT NULL), ARRAY[]::text[]) AS persona_colors
                FROM final_rows fr
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
                FROM final_rows fr
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
                            'cohortNames', COALESCE(acn.cohort_names, ARRAY[]::text[])
                        )
                        ORDER BY fr.attempt_date DESC, fr.attempt_id
                    ),
                    '[]'::json
                ) AS history
                FROM final_rows fr
                LEFT JOIN persona_labels pl ON pl.attempt_id = fr.attempt_id
                LEFT JOIN scenario_names sn ON sn.attempt_id = fr.attempt_id
                LEFT JOIN attempt_cohort_names acn ON acn.attempt_id = fr.attempt_id
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
                  AND sim.department_id IN (SELECT DISTINCT department_id FROM filt)
            )
            SELECT json_build_object(
                'mode', (SELECT mode FROM profile_role_lookup),
                'hasData', CASE WHEN (SELECT is_ta_mode FROM profile_role_lookup) THEN EXISTS(SELECT 1 FROM ta_rows) ELSE EXISTS(SELECT 1 FROM inst_rows) END,
                'items', CASE
                    WHEN (SELECT is_ta_mode FROM profile_role_lookup) THEN COALESCE((SELECT json_agg(item ORDER BY (item->>'simulationTitle')) FROM ta_rows), '[]'::json)
                    ELSE COALESCE((SELECT json_agg(item ORDER BY has_passed_bool ASC, sort_cohort_name NULLS LAST, sort_title) FROM inst_rows), '[]'::json)
                END,
                'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping), '{{}}'::jsonb),
                'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{{}}'::jsonb),
                'history', (SELECT history FROM attempt_history_data),
                'simulation_mapping', (SELECT mapping FROM simulation_mapping_data)
            ) AS result
        """

        return query, params
