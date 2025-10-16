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
        """Build home overview query."""
        where_clause, params = self.builder.filters.build_base_filter(
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

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            simulation_items AS (
                SELECT
                    f.simulation_id,
                    s.title AS simulation_title,
                    s.description AS simulation_description,
                    MAX(f.grade_percent) AS highest_score,
                    COUNT(DISTINCT f.attempt_id)::int AS num_sessions,
                    CASE 
                        WHEN MAX(f.grade_percent) >= MAX(f.rubric_pass_points * 100.0 / NULLIF(f.rubric_points, 0)) THEN 'passed'
                        WHEN COUNT(*) > 0 THEN 'in-progress'
                        ELSE 'not-started'
                    END AS status
                FROM filt f
                JOIN simulations s ON s.id = f.simulation_id
                WHERE f.simulation_id IS NOT NULL
                GROUP BY f.simulation_id, s.title, s.description
            ),
            simulation_rubrics AS (
                SELECT DISTINCT
                    si.simulation_id,
                    s.rubric_id,
                    (
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
                    ) AS standard_groups
                FROM simulation_items si
                JOIN simulations s ON s.id = si.simulation_id
            ),
            all_rubric_ids AS (
                SELECT DISTINCT rubric_id FROM simulation_rubrics
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
                'hasData', (SELECT COUNT(*) > 0 FROM simulation_items),
                'items', COALESCE((SELECT json_agg(json_build_object(
                    'viewMode', '{view_mode}',
                    'id', si.simulation_id::text,
                    'simulationTitle', si.simulation_title,
                    'simulationDescription', si.simulation_description,
                    'simulationName', si.simulation_title,
                    'numSessions', si.num_sessions,
                    'highestScore', ROUND(si.highest_score),
                    'standard_groups', sr.standard_groups,
                    'status', si.status,
                    'completionPct', 0
                ) ORDER BY si.simulation_title) 
                FROM simulation_items si
                LEFT JOIN simulation_rubrics sr ON sr.simulation_id = si.simulation_id
                ), '[]'::json),
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
        """Build attempt history query."""
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
            attempts AS (
                SELECT DISTINCT ON (f.attempt_id)
                    f.attempt_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    f.profile_id,
                    p.first_name || ' ' || p.last_name AS profile_name,
                    s.title AS simulation_name,
                    f.simulation_id,
                    f.department_id,
                    AVG(f.grade_percent) OVER (PARTITION BY f.attempt_id) AS score,
                    COUNT(*) FILTER (WHERE f.completed) OVER (PARTITION BY f.attempt_id) AS num_scenarios_completed,
                    f.is_archived,
                    f.is_practice AS practice_simulation
                FROM filt f
                JOIN profiles p ON p.id = f.profile_id
                JOIN simulations s ON s.id = f.simulation_id
                ORDER BY f.attempt_id, f.attempt_created_at DESC
            )
            SELECT COALESCE((SELECT json_agg(json_build_object(
                'attemptId', attempt_id::text,
                'date', date,
                'profileId', profile_id::text,
                'profileName', profile_name,
                'simulationName', simulation_name,
                'numScenarios', NULL,
                'numScenariosCompleted', num_scenarios_completed,
                'infiniteMode', false,
                'infiniteModeTimeLimit', NULL,
                'personaNames', '[]'::json,
                'personaColors', '[]'::json,
                'score', ROUND(score),
                'simulation_id', simulation_id::text,
                'department_id', department_id::text,
                'scenario_ids', '[]'::json,
                'isArchived', is_archived,
                'showView', true,
                'showContinue', false,
                'practiceSimulation', practice_simulation,
                'passPct', NULL
            ) ORDER BY date DESC) FROM attempts), '[]'::json) AS result
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
        """Build practice overview query."""
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
                SELECT * FROM analytics a WHERE {where_clause} AND a.is_practice = TRUE
            ),
            practice_items AS (
                SELECT
                    f.simulation_id,
                    s.title AS simulation_title,
                    s.description AS simulation_description,
                    MAX(f.grade_percent) AS highest_score,
                    COUNT(DISTINCT f.attempt_id)::int AS num_sessions
                FROM filt f
                JOIN simulations s ON s.id = f.simulation_id
                WHERE f.simulation_id IS NOT NULL
                GROUP BY f.simulation_id, s.title, s.description
            ),
            simulation_rubrics AS (
                SELECT DISTINCT
                    pi.simulation_id,
                    s.rubric_id,
                    (
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
                    ) AS standard_groups
                FROM practice_items pi
                JOIN simulations s ON s.id = pi.simulation_id
            ),
            all_rubric_ids AS (
                SELECT DISTINCT rubric_id FROM simulation_rubrics
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
                'mode', 'practice',
                'hasData', (SELECT COUNT(*) > 0 FROM practice_items),
                'items', COALESCE((SELECT json_agg(json_build_object(
                    'viewMode', 'practice',
                    'id', pi.simulation_id::text,
                    'simulationTitle', pi.simulation_title,
                    'simulationDescription', pi.simulation_description,
                    'simulationName', pi.simulation_title,
                    'numSessions', pi.num_sessions,
                    'highestScore', ROUND(pi.highest_score),
                    'standard_groups', sr.standard_groups
                ) ORDER BY pi.simulation_title) 
                FROM practice_items pi
                LEFT JOIN simulation_rubrics sr ON sr.simulation_id = pi.simulation_id
                ), '[]'::json),
                'standard_groups_mapping', COALESCE((SELECT mapping FROM standard_groups_mapping), '{{}}'::jsonb),
                'standards_mapping', COALESCE((SELECT mapping FROM standards_mapping), '{{}}'::jsonb)
            ) AS result
        """

        return query, params

