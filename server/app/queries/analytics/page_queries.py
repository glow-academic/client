"""Page-specific analytics queries - 3 metrics."""

from typing import Any, Dict, List, Optional, Tuple

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
    ) -> Tuple[str, Dict[str, Any]]:
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
                    simulation_id,
                    simulation_title,
                    simulation_description,
                    MAX(grade_percent) AS highest_score,
                    COUNT(DISTINCT attempt_id)::int AS num_sessions,
                    CASE 
                        WHEN MAX(grade_percent) >= MAX(pass_percent) THEN 'passed'
                        WHEN COUNT(*) > 0 THEN 'in-progress'
                        ELSE 'not-started'
                    END AS status
                FROM filt
                WHERE simulation_id IS NOT NULL
                GROUP BY simulation_id, simulation_title, simulation_description
            )
            SELECT json_build_object(
                'mode', '{view_mode}',
                'hasData', (SELECT COUNT(*) > 0 FROM simulation_items),
                'items', COALESCE((SELECT json_agg(json_build_object(
                    'viewMode', '{view_mode}',
                    'id', simulation_id::text,
                    'simulationTitle', simulation_title,
                    'simulationDescription', simulation_description,
                    'simulationName', simulation_title,
                    'numSessions', num_sessions,
                    'highestScore', ROUND(highest_score),
                    'status', status,
                    'completionPct', 0
                ) ORDER BY simulation_title) FROM simulation_items), '[]'::json)
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
    ) -> Tuple[str, Dict[str, Any]]:
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
                SELECT DISTINCT ON (attempt_id)
                    attempt_id,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    profile_id,
                    profile_first_name || ' ' || profile_last_name AS profile_name,
                    simulation_title AS simulation_name,
                    simulation_id,
                    department_id,
                    AVG(grade_percent) OVER (PARTITION BY attempt_id) AS score,
                    COUNT(*) FILTER (WHERE completed) OVER (PARTITION BY attempt_id) AS num_scenarios_completed,
                    is_archived,
                    is_practice AS practice_simulation
                FROM filt
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
    ) -> Tuple[str, Dict[str, Any]]:
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
                    simulation_id,
                    simulation_title,
                    simulation_description,
                    MAX(grade_percent) AS highest_score,
                    COUNT(DISTINCT attempt_id)::int AS num_sessions
                FROM filt
                WHERE simulation_id IS NOT NULL
                GROUP BY simulation_id, simulation_title, simulation_description
            )
            SELECT json_build_object(
                'mode', 'practice',
                'hasData', (SELECT COUNT(*) > 0 FROM practice_items),
                'items', COALESCE((SELECT json_agg(json_build_object(
                    'viewMode', 'practice',
                    'id', simulation_id::text,
                    'simulationTitle', simulation_title,
                    'simulationDescription', simulation_description,
                    'simulationName', simulation_title,
                    'numSessions', num_sessions,
                    'highestScore', ROUND(highest_score)
                ) ORDER BY simulation_title) FROM practice_items), '[]'::json)
            ) AS result
        """

        return query, params

