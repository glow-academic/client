"""Bundle analytics queries - 2 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class BundleQueries:
    """Query builders for bundle analytics (reports and leaderboard)."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def reports_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build reports bundle query - aggregated metrics per profile."""
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
            profile_metrics AS (
                SELECT
                    f.profile_id,
                    p.first_name,
                    p.last_name,
                    p.alias,
                    p.role,
                    AVG(f.grade_percent) AS avg_score,
                    MAX(f.grade_percent) AS highest_score,
                    COUNT(*)::int AS total_attempts,
                    AVG(f.num_messages_total) AS avg_messages,
                    AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
                FROM filt f
                JOIN profiles p ON f.profile_id = p.id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.profile_id, p.first_name, p.last_name, p.alias, p.role
            )
            SELECT json_build_object(
                'data', COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id::text,
                    'firstName', first_name,
                    'lastName', last_name,
                    'alias', alias,
                    'role', role,
                    'metrics', json_build_object(
                        'averageScore', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'mean', ROUND(avg_score),
                                'median', ROUND(avg_score),
                                'mode', ROUND(avg_score)
                            )
                        ),
                        'highestScore', json_build_object(
                            'hasData', true,
                            'method', 'max',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('top', ARRAY[ROUND(highest_score)])
                        ),
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'attempts', total_attempts,
                                'uniqueSimulations', 0,
                                'perSimulationMean', 0
                            )
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'mean', ROUND(avg_messages),
                                'median', ROUND(avg_messages),
                                'count', total_attempts
                            )
                        ),
                        'timeSpent', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'avgSessionMinutes', ROUND(avg_time_minutes),
                                'avgChatMinutes', ROUND(avg_time_minutes),
                                'avgOverallMinutes', ROUND(avg_time_minutes)
                            )
                        ),
                        'completionPercentage', json_build_object(
                            'hasData', true,
                            'method', 'rate',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('completed', 0, 'total', 0, 'percent', 0)
                        ),
                        'firstAttemptPassRate', json_build_object(
                            'hasData', true,
                            'method', 'rate',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('passed', 0, 'total', 0, 'percent', 0)
                        ),
                        'personaResponseTimes', json_build_object(
                            'hasData', false,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('meanSeconds', 0, 'medianSeconds', 0, 'samples', 0)
                        ),
                        'sessionEfficiency', json_build_object(
                            'hasData', false,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('avgScorePercent', 0, 'avgMinutes', 0, 'efficiency', 0)
                        ),
                        'stagnationRate', json_build_object(
                            'hasData', false,
                            'method', 'rate',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('tracked', 0, 'stagnant', 0, 'ratePercent', 0)
                        )
                    )
                )) FROM profile_metrics), '[]'::json)
            ) AS result
        """

        return query, params

    def leaderboard_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build leaderboard bundle query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """ + where_clause + """
            ),
            profile_stats AS (
                SELECT
                    profile_id,
                    profile_first_name,
                    profile_last_name,
                    COUNT(*)::int AS total_attempts,
                    MAX(grade_percent) AS highest_score,
                    AVG(num_messages_total) AS avg_messages,
                    AVG(time_taken_seconds / 60.0) AS avg_time
                FROM filt
                WHERE grade_percent IS NOT NULL
                GROUP BY profile_id, profile_first_name, profile_last_name
            )
            SELECT json_build_object(
                'data', COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id::text,
                    'firstName', profile_first_name,
                    'lastName', profile_last_name,
                    'metrics', json_build_object(
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'highestScoreAvg', json_build_object(
                            'hasData', true,
                            'method', 'max',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'personaResponseSeconds', json_build_object(
                            'hasData', false,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'timeSpentMinutes', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'improvementRatePerDay', json_build_object(
                            'hasData', false,
                            'method', 'slope',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'perfectScoreCount', json_build_object(
                            'hasData', false,
                            'method', 'sum',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'quickestPassMinutes', json_build_object(
                            'hasData', false,
                            'method', 'min',
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        )
                    )
                ) ORDER BY highest_score DESC) FROM profile_stats), '[]'::json)
            ) AS result
        """

        return query, params

