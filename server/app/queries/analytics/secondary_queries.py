"""Secondary analytics queries - 3 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class SecondaryQueries:
    """Query builders for secondary analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def attempt_improvement(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build attempt improvement query."""
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
            attempt_numbers AS (
                SELECT
                    simulation_id,
                    profile_id,
                    attempt_id,
                    attempt_created_at,
                    grade_percent,
                    (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0)) AS pass_percent,
                    time_taken_seconds / 60.0 AS minutes,
                    ROW_NUMBER() OVER (PARTITION BY simulation_id, profile_id ORDER BY attempt_created_at) AS attempt_no
                FROM filt
                WHERE grade_percent IS NOT NULL
            ),
            by_attempt AS (
                SELECT
                    simulation_id,
                    attempt_no,
                    AVG(grade_percent)::float AS avg_grade,
                    AVG(minutes)::float AS avg_minutes,
                    (100.0 * COUNT(*) FILTER (WHERE grade_percent >= pass_percent) / NULLIF(COUNT(*), 0))::float AS pass_rate
                FROM attempt_numbers
                WHERE attempt_no <= 5  -- Limit to first 5 attempts
                GROUP BY simulation_id, attempt_no
            ),
            chart_data AS (
                SELECT
                    'Attempt ' || attempt_no AS attempt,
                    ROUND(AVG(avg_grade))::int AS "Average Score",
                    ROUND(AVG(avg_minutes))::int AS "Average Time",
                    ROUND(AVG(pass_rate))::int AS "Pass Rate"
                FROM by_attempt
                GROUP BY attempt_no
                ORDER BY attempt_no
            ),
            facts AS (
                SELECT
                    simulation_id::text,
                    attempt_no::int,
                    ROUND(avg_grade)::int AS avg_grade,
                    ROUND(avg_minutes)::int AS avg_minutes,
                    ROUND(pass_rate)::int AS pass_rate
                FROM by_attempt
            )
            SELECT json_build_object(
                'chartData', COALESCE((SELECT json_agg(row_to_json(cd)) FROM chart_data cd), '[]'::json),
                'facts', COALESCE((SELECT json_agg(json_build_object(
                    'simulationId', simulation_id,
                    'attemptNo', attempt_no,
                    'avgGrade', avg_grade,
                    'avgMinutes', avg_minutes,
                    'passRate', pass_rate
                )) FROM facts), '[]'::json),
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json)
            ) AS result
        """

        return query, params

    def cohort_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build cohort performance query."""
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
            cohort_data AS (
                SELECT
                    c_id AS cohort_id
                FROM filt f,
                LATERAL unnest(f.cohort_ids) AS c_id
            ),
            cohort_names AS (
                SELECT DISTINCT
                    cd.cohort_id,
                    c.title AS cohort_name
                FROM cohort_data cd
                JOIN cohorts c ON c.id = cd.cohort_id
            ),
            cohort_stats AS (
                SELECT
                    cn.cohort_id,
                    cn.cohort_name,
                    COUNT(DISTINCT f.profile_id)::int AS total_students,
                    COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
                    AVG(f.grade_percent)::float AS avg_score,
                    (100.0 * COUNT(*) FILTER (WHERE f.grade_percent >= (f.rubric_pass_points * 100.0 / NULLIF(f.rubric_points, 0))) / NULLIF(COUNT(*), 0))::float AS pass_rate
                FROM cohort_names cn
                LEFT JOIN filt f ON cn.cohort_id = ANY(f.cohort_ids)
                GROUP BY cn.cohort_id, cn.cohort_name
            ),
            daily_data AS (
                SELECT
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(f.grade_percent)::float AS avg_score,
                    c_id::text AS cohort_id
                FROM filt f,
                LATERAL unnest(f.cohort_ids) AS c_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY date, c_id
            )
            SELECT json_build_object(
                'cohortData', COALESCE((SELECT json_agg(json_build_object(
                    'id', cohort_id::text,
                    'name', cohort_name,
                    'passRate', ROUND(COALESCE(pass_rate, 0))::int,
                    'avgPercentageScore', ROUND(COALESCE(avg_score, 0))::int,
                    'totalStudents', total_students,
                    'passedStudents', 0,
                    'totalAttempts', total_attempts,
                    'passedAttempts', 0,
                    'simulationCount', 0,
                    'requiredSimulations', 0
                )) FROM cohort_stats), '[]'::json),
                'dailyData', COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'avgScore', ROUND(avg_score)::int,
                    'cohortId', cohort_id
                )) FROM daily_data), '[]'::json),
                'cohortFacts', '[]'::json,
                'dailyFacts', '[]'::json,
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json)
            ) AS result
        """

        return query, params

    def skill_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build skill performance query."""
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
            rubric_ids AS (
                SELECT DISTINCT rubric_id FROM filt WHERE rubric_id IS NOT NULL
            ),
            standard_groups AS (
                SELECT
                    sg.id AS group_id,
                    sg.name AS group_name,
                    sg.description AS group_description,
                    sg.rubric_id,
                    sg.points
                FROM standard_groups sg
                WHERE sg.rubric_id IN (SELECT rubric_id FROM rubric_ids)
            ),
            packages AS (
                SELECT
                    sg.rubric_id,
                    COALESCE(json_agg(json_build_object(
                        'metric', sg.group_name,
                        'description', sg.group_description,
                        'value', 0.5,
                        'fullMark', 1.0
                    )), '[]'::json) AS radar_data,
                    '[]'::json AS group_facts
                FROM standard_groups sg
                GROUP BY sg.rubric_id
            )
            SELECT json_build_object(
                'packages', COALESCE((SELECT json_agg(json_build_object(
                    'rubricId', rubric_id::text,
                    'radarData', radar_data,
                    'groupFacts', group_facts
                )) FROM packages), '[]'::json),
                'validRubricIds', COALESCE((
                    SELECT json_agg(rubric_id::text) FROM rubric_ids
                ), '[]'::json)
            ) AS result
        """

        return query, params

