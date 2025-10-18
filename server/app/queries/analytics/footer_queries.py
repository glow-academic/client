"""Footer analytics queries - 4 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class FooterQueries:
    """Query builders for footer analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def scenario_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build scenario performance query."""
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
            -- get categorical (non-numerical) parameters
            param_ids AS (
                SELECT id
                FROM parameters
                WHERE active = TRUE AND numerical = FALSE
            ),
            -- map parameter items to scenarios (categorical only)
            cat_map AS (
                SELECT 
                    pi.id AS parameter_item_id,
                    pi.parameter_id,
                    s.id AS scenario_id
                FROM parameter_items pi
                JOIN param_ids p ON p.id = pi.parameter_id
                JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
                JOIN scenarios s ON s.id = spi.scenario_id
                WHERE s.active = TRUE
            ),
            -- scenarios that appear in filtered data
            scenario_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            -- filter cat_map to only seen scenarios
            cat_map_seen AS (
                SELECT cm.parameter_id, cm.parameter_item_id, cm.scenario_id
                FROM cat_map cm
                JOIN scenario_seen ss ON ss.scenario_id = cm.scenario_id
            ),
            -- aggregate attempts daily by parameter item
            attempt_daily AS (
                SELECT
                    cm.parameter_id,
                    cm.parameter_item_id,
                    to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(EPOCH FROM date_trunc('day', f.chat_created_at))::bigint AS ts,
                    AVG(f.grade_percent)::float AS avg_score,
                    COUNT(*)::int AS attempts,
                    SUM((f.passed)::int)::int AS passed_attempts
                FROM filt f
                JOIN cat_map_seen cm ON cm.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY cm.parameter_id, cm.parameter_item_id, date_trunc('day', f.chat_created_at)
            ),
            -- valid parameter IDs with data
            valid_params AS (
                SELECT DISTINCT parameter_id FROM cat_map_seen
            )
            SELECT json_build_object(
                'validParameterIds', COALESCE((
                    SELECT json_agg(parameter_id::text ORDER BY parameter_id::text)
                    FROM valid_params
                ), '[]'::json),
                'attributeAttemptFacts', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'parameterId', parameter_id::text,
                            'parameterItemId', parameter_item_id::text,
                            'date', date,
                            'timestamp', ts,
                            'avgScore', ROUND(avg_score)::int,
                            'attempts', attempts,
                            'passedAttempts', passed_attempts
                        )
                    ) FROM attempt_daily
                ), '[]'::json),
                'attributeScenarioFacts', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'parameterId', parameter_id::text,
                            'parameterItemId', parameter_item_id::text,
                            'scenarioId', scenario_id::text
                        )
                    ) FROM (SELECT DISTINCT * FROM cat_map_seen) d
                ), '[]'::json)
            ) AS result
        """

        return query, params

    def scenario_stats(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build scenario stats query."""
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
            -- get numeric parameters
            nums AS (
                SELECT id
                FROM parameters
                WHERE active = TRUE AND numerical = TRUE
            ),
            -- map scenarios to parameter levels (numeric only)
            num_map AS (
                SELECT 
                    s.id AS scenario_id, 
                    pi.parameter_id, 
                    pi.value::numeric AS level
                FROM scenarios s
                JOIN scenario_parameter_items spi ON spi.scenario_id = s.id
                JOIN parameter_items pi ON pi.id = spi.parameter_item_id
                JOIN nums n ON n.id = pi.parameter_id
                WHERE s.active = TRUE
            ),
            -- scenarios that appear in filtered data
            scenario_seen AS (
                SELECT DISTINCT f.scenario_id 
                FROM filt f 
                WHERE f.scenario_id IS NOT NULL
            ),
            -- filter num_map to only seen scenarios
            num_map_seen AS (
                SELECT nm.*
                FROM num_map nm
                JOIN scenario_seen ss ON ss.scenario_id = nm.scenario_id
            ),
            -- get attempts with scores
            attempts AS (
                SELECT
                    nms.parameter_id,
                    nms.level,
                    f.grade_percent::float AS score
                FROM filt f
                JOIN num_map_seen nms ON nms.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
            ),
            -- format level labels and values
            levels AS (
                SELECT
                    parameter_id,
                    CASE 
                        WHEN level = floor(level) THEN level::int::text 
                        ELSE to_char(level, 'FM999D0') 
                    END AS level_label,
                    CASE 
                        WHEN level = floor(level) THEN level::numeric 
                        ELSE round(level::numeric, 1) 
                    END AS level_value,
                    score
                FROM attempts
            ),
            -- aggregate by parameter + level
            agg AS (
                SELECT 
                    parameter_id, 
                    level_label, 
                    level_value,
                    AVG(score)::float AS avg_score,
                    COUNT(*)::int AS attempts
                FROM levels
                GROUP BY parameter_id, level_label, level_value
            ),
            -- valid parameter IDs with data
            valid_params AS (
                SELECT DISTINCT parameter_id FROM levels
            )
            SELECT json_build_object(
                'validNumericParameterIds', COALESCE((
                    SELECT json_agg(parameter_id::text ORDER BY parameter_id::text) 
                    FROM valid_params
                ), '[]'::json),
                'numericAttemptFacts', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'parameterId', parameter_id::text,
                            'levelLabel', level_label,
                            'levelValue', level_value,
                            'score', ROUND(avg_score)::int,
                            'attempts', attempts
                        )
                    ) FROM agg
                ), '[]'::json),
                'numericScenarioFacts', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'parameterId', parameter_id::text,
                            'scenarioId', scenario_id::text,
                            'levelLabel', CASE 
                                WHEN level = floor(level) THEN level::int::text 
                                ELSE to_char(level, 'FM999D0') 
                            END,
                            'levelValue', CASE 
                                WHEN level = floor(level) THEN level::numeric 
                                ELSE round(level::numeric, 1) 
                            END
                        )
                    ) FROM (SELECT DISTINCT * FROM num_map_seen) d
                ), '[]'::json)
            ) AS result
        """

        return query, params

    def simulation_composition(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build simulation composition query."""
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
            -- simulations and scenarios that appear in filtered data
            sim_seen AS (
                SELECT DISTINCT f.simulation_id
                FROM filt f
                WHERE f.simulation_id IS NOT NULL
            ),
            scen_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            -- per-simulation performance facts from attempts
            sim_summary AS (
                SELECT
                    f.simulation_id,
                    AVG(f.grade_percent)::float AS avg_score,
                    (100.0 * AVG((f.passed)::int))::float AS pass_rate,
                    (100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int))::float AS completion_rate,
                    COUNT(*)::int AS attempts
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.simulation_id
            ),
            -- scenario count per simulation restricted to scenarios seen in this window
            sim_scenarios_seen AS (
                SELECT 
                    s.id AS simulation_id,
                    COUNT(DISTINCT sc.id)::int AS scenario_count
                FROM simulations s
                JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios sc ON sc.id = ss_link.scenario_id
                JOIN scen_seen ss ON ss.scenario_id = sc.id
                WHERE s.active = TRUE AND sc.active = TRUE
                GROUP BY s.id
            ),
            -- categorical parameter composition per simulation (count of chats having the item)
            sim_param_items_seen AS (
                SELECT
                    s.id AS simulation_id,
                    p.id AS parameter_id,
                    pi.id AS parameter_item_id,
                    COUNT(a.chat_id)::int AS cnt
                FROM simulations s
                JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios sc ON sc.id = ss_link.scenario_id
                JOIN scen_seen ss ON ss.scenario_id = sc.id
                JOIN scenario_parameter_items spi ON spi.scenario_id = sc.id
                JOIN parameter_items pi ON pi.id = spi.parameter_item_id
                JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = FALSE
                JOIN analytics a ON a.scenario_id = sc.id
                WHERE s.active = TRUE AND sc.active = TRUE
                GROUP BY s.id, p.id, pi.id
            ),
            -- numeric parameter composition per simulation (most common value across chats)
            sim_param_nums_seen AS (
                SELECT
                    s.id AS simulation_id,
                    p.id AS parameter_id,
                    pi.value::numeric AS most_common_level,
                    COUNT(a.chat_id)::int AS chat_count
                FROM simulations s
                JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios sc ON sc.id = ss_link.scenario_id
                JOIN scen_seen ss ON ss.scenario_id = sc.id
                JOIN scenario_parameter_items spi ON spi.scenario_id = sc.id
                JOIN parameter_items pi ON pi.id = spi.parameter_item_id
                JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = TRUE
                JOIN analytics a ON a.scenario_id = sc.id
                WHERE s.active = TRUE AND sc.active = TRUE
                GROUP BY s.id, p.id, pi.value
            ),
            -- get the most frequent parameter value per simulation/parameter
            sim_param_nums_most_common AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    most_common_level,
                    chat_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY simulation_id, parameter_id 
                        ORDER BY chat_count DESC, most_common_level DESC
                    ) as rn
                FROM sim_param_nums_seen
            ),
            -- per-sim rolled facts for list & sorting
            simulation_facts AS (
                SELECT
                    s.id AS simulation_id,
                    s.title AS simulation_title,
                    COALESCE(ROUND(ss.avg_score), 0)::int AS avg_score,
                    COALESCE(ROUND(ss.pass_rate), 0)::int AS pass_rate,
                    COALESCE(ROUND(ss.completion_rate), 0)::int AS completion_rate,
                    COALESCE(ss.attempts, 0) AS total_attempts,
                    COALESCE(sc_seen.scenario_count, 0) AS scenario_count
                FROM simulations s
                LEFT JOIN sim_summary ss ON ss.simulation_id = s.id
                LEFT JOIN sim_scenarios_seen sc_seen ON sc_seen.simulation_id = s.id
                WHERE s.active = TRUE
                  AND s.id IN (SELECT simulation_id FROM sim_seen)
            ),
            -- categorical composition facts
            param_facts_cat AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    parameter_item_id,
                    cnt AS scenario_count
                FROM sim_param_items_seen
            ),
            -- numeric composition facts
            param_facts_num AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    most_common_level AS avg_level,
                    CASE
                        WHEN most_common_level = floor(most_common_level) 
                        THEN (most_common_level::int)::text
                        ELSE to_char(most_common_level, 'FM999D0')
                    END AS level_label,
                    chat_count AS scenario_count
                FROM sim_param_nums_most_common
                WHERE rn = 1
            )
            SELECT json_build_object(
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text ORDER BY simulation_id::text) 
                    FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json),
                'simulationFacts', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'simulationId', simulation_id::text,
                            'title', simulation_title,
                            'avgScore', avg_score,
                            'passRate', pass_rate,
                            'completionRate', completion_rate,
                            'totalAttempts', total_attempts,
                            'scenarioCount', scenario_count
                        ) ORDER BY simulation_title
                    ) FROM simulation_facts
                ), '[]'::json),
                'simulationParameterFactsCategorical', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'simulationId', simulation_id::text,
                            'parameterId', parameter_id::text,
                            'parameterItemId', parameter_item_id::text,
                            'scenarioCount', scenario_count
                        )
                    ) FROM param_facts_cat
                ), '[]'::json),
                'simulationParameterFactsNumeric', COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'simulationId', simulation_id::text,
                            'parameterId', parameter_id::text,
                            'avgLevel', avg_level,
                            'levelLabel', level_label,
                            'scenarioCount', scenario_count
                        )
                    ) FROM param_facts_num
                ), '[]'::json),
                'hasData', EXISTS (SELECT 1 FROM sim_summary)
            ) AS result
        """

        return query, params

    def simulation_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build simulation performance query."""
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
            scenario_facts AS (
                SELECT
                    f.simulation_id,
                    f.scenario_id,
                    MIN(sc.name) AS scenario_name,
                    COALESCE(AVG(f.grade_percent), 0)::float AS avg_score,
                    COALESCE((100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int)), 0)::float AS success_rate,
                    COUNT(*)::int AS total_attempts,
                    SUM((f.completed OR f.grade_percent IS NOT NULL)::int)::int AS completed_attempts
                FROM filt f
                JOIN scenarios sc ON sc.id = f.scenario_id
                WHERE f.simulation_id IS NOT NULL AND f.scenario_id IS NOT NULL
                GROUP BY f.simulation_id, f.scenario_id
            )
            SELECT json_build_object(
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text ORDER BY simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json),
                'scenarioFacts', COALESCE((SELECT json_agg(json_build_object(
                    'simulationId', simulation_id::text,
                    'scenarioId', scenario_id::text,
                    'scenarioName', scenario_name,
                    'avgScore', ROUND(COALESCE(avg_score, 0))::int,
                    'successRate', ROUND(COALESCE(success_rate, 0))::int,
                    'totalAttempts', total_attempts,
                    'completedAttempts', completed_attempts
                )) FROM scenario_facts), '[]'::json)
            ) AS result
        """

        return query, params

