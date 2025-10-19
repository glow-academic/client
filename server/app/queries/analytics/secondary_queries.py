"""Secondary analytics queries - 3 metrics."""

from typing import Any

from app.queries.analytics.base import AnalyticsQueryBuilder


class SecondaryQueries:
    """Query builders for secondary analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def attempt_improvement(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build attempt improvement query matching stored procedure logic."""
        from datetime import datetime

        # Build params list matching stored procedure approach
        params: list[Any] = []

        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        cohort_ids = cohort_ids or []
        roles = roles or []
        sim_filters = sim_filters or ["general"]
        department_ids = department_ids or []

        params.extend(
            [
                start_dt,
                end_dt,
                cohort_ids,
                roles,
                sim_filters,
                profile_id,
                department_ids,
            ]
        )

        query = """
            WITH base_general AS (
                SELECT a.*
                FROM analytics a
                WHERE 'general' = ANY($5::text[])
                    AND a.is_general = TRUE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_practice AS (
                SELECT a.*
                FROM analytics a
                WHERE 'practice' = ANY($5::text[])
                    AND a.is_practice = TRUE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_archived_only AS (
                SELECT a.*
                FROM analytics a
                WHERE 'archived' = ANY($5::text[])
                    AND NOT ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[]))
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_archived_other AS (
                SELECT a.*
                FROM analytics a
                WHERE 'archived' = ANY($5::text[])
                    AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[]))
                    AND a.is_general = FALSE
                    AND a.is_practice = FALSE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_union AS (
                SELECT * FROM base_general
                UNION ALL
                SELECT * FROM base_practice
                UNION ALL
                SELECT * FROM base_archived_only
                UNION ALL
                SELECT * FROM base_archived_other
            ),
            base_archived AS (
                SELECT bu.*
                FROM base_union bu
                WHERE
                    CASE
                        WHEN 'archived' = ANY($5::text[]) AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN TRUE
                        WHEN 'archived' = ANY($5::text[]) AND NOT ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN bu.is_archived = TRUE
                        WHEN NOT ('archived' = ANY($5::text[])) AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN bu.is_archived = FALSE
                        ELSE FALSE
                    END
            ),
            cohort_scoped AS (
                SELECT b.*
                FROM base_archived b
                WHERE cardinality($3::uuid[]) = 0
                    OR (b.cohort_ids && $3::uuid[] OR b.profile_cohort_ids && $3::uuid[])
            ),
            filt AS (
                SELECT * FROM cohort_scoped
            ),
            -- Get first timestamp for each attempt
            attempt_first AS (
                SELECT 
            profile_id,
                    simulation_id, 
                    attempt_id, 
                    MIN(chat_created_at) AS first_ts
                FROM filt
                GROUP BY profile_id, simulation_id, attempt_id
            ),
            -- Assign attempt numbers per profile+simulation based on first timestamp
            attempt_ord AS (
                SELECT
                    af.*,
                    ROW_NUMBER() OVER (PARTITION BY af.profile_id, af.simulation_id ORDER BY af.first_ts) AS attempt_no
                FROM attempt_first af
            ),
            -- Aggregate stats for each attempt
            attempt_rows AS (
                SELECT
                    ao.profile_id,
                    ao.simulation_id,
                    ao.attempt_id,
                    ao.attempt_no,
                    AVG(f.grade_percent)::float AS avg_grade,
                    AVG(f.time_taken_seconds / 60.0)::float AS avg_time_minutes,
                    MAX((f.passed)::int)::int AS passed_any
                FROM attempt_ord ao
                JOIN filt f ON f.attempt_id = ao.attempt_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY ao.profile_id, ao.simulation_id, ao.attempt_id, ao.attempt_no
            ),
            -- Aggregate by simulation and attempt number for facts
            multiple_users_data AS (
                    SELECT
                        simulation_id,
                    attempt_no,
                    AVG(avg_grade)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    (100.0 * AVG(passed_any))::float AS pass_rate
                FROM attempt_rows
                WHERE avg_grade IS NOT NULL
                GROUP BY simulation_id, attempt_no
            ),
            -- Aggregate across all simulations for chart
            by_attempt AS (
                SELECT
                    attempt_no,
                    AVG(avg_grade)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    AVG(pass_rate)::float AS pass_rate
                FROM multiple_users_data
                WHERE attempt_no <= 5
                GROUP BY attempt_no
            ),
            chart_data AS (
                SELECT json_build_object(
                    'attempt', 'Attempt ' || attempt_no,
                    'average_score', ROUND(COALESCE(avg_grade, 0))::int,
                    'average_time', ROUND(COALESCE(avg_time_minutes, 0))::int,
                    'pass_rate', ROUND(COALESCE(pass_rate, 0))::int
                ) AS chart_row
                FROM by_attempt
                ORDER BY attempt_no
            ),
            facts AS (
                SELECT
                    simulation_id::text,
                    attempt_no::int,
                    ROUND(COALESCE(avg_grade, 0))::int AS avg_grade,
                    ROUND(COALESCE(avg_time_minutes, 0))::int AS avg_minutes,
                    ROUND(COALESCE(pass_rate, 0))::int AS pass_rate
                FROM multiple_users_data
            )
            SELECT json_build_object(
                'chartData', COALESCE((SELECT json_agg(chart_row ORDER BY (chart_row->>'attempt')) FROM chart_data), '[]'::json),
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
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build cohort performance query using stored procedure filtering logic."""
        from datetime import datetime

        # Build params list matching stored procedure approach
        params: list[Any] = []
        param_counter = 1

        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        cohort_ids = cohort_ids or []
        roles = roles or []
        sim_filters = sim_filters or ["general"]
        department_ids = department_ids or []

        params.extend(
            [
                start_dt,
                end_dt,
                cohort_ids,
                roles,
                sim_filters,
                profile_id,
                department_ids,
            ]
        )

        want_general = "general" in sim_filters
        want_practice = "practice" in sim_filters
        want_archived = "archived" in sim_filters
        want_nonarchived_or_any = want_general or want_practice

        query = """
            WITH base_general AS (
                SELECT a.*
                FROM analytics a
                WHERE 'general' = ANY($5::text[])
                    AND a.is_general = TRUE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.chat_created_at >= $1
                    AND a.chat_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_practice AS (
                SELECT a.*
                FROM analytics a
                WHERE 'practice' = ANY($5::text[])
                    AND a.is_practice = TRUE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.chat_created_at >= $1
                    AND a.chat_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_archived_only AS (
                SELECT a.*
                FROM analytics a
                WHERE 'archived' = ANY($5::text[])
                    AND NOT ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[]))
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_archived_other AS (
                SELECT a.*
                FROM analytics a
                WHERE 'archived' = ANY($5::text[])
                    AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[]))
                    AND a.is_general = FALSE
                    AND a.is_practice = FALSE
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND a.attempt_created_at >= $1
                    AND a.attempt_created_at < $2
                    AND (
                        $6::uuid IS NOT NULL
                        OR cardinality($4::text[]) = 0
                        OR a.profile_role = ANY($4::profile_role[])
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            base_union AS (
                SELECT * FROM base_general
                UNION ALL
                SELECT * FROM base_practice
                UNION ALL
                SELECT * FROM base_archived_only
                UNION ALL
                SELECT * FROM base_archived_other
            ),
            base_archived AS (
                SELECT bu.*
                FROM base_union bu
                WHERE
                    CASE
                        WHEN 'archived' = ANY($5::text[]) AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN TRUE
                        WHEN 'archived' = ANY($5::text[]) AND NOT ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN bu.is_archived = TRUE
                        WHEN NOT ('archived' = ANY($5::text[])) AND ('general' = ANY($5::text[]) OR 'practice' = ANY($5::text[])) THEN bu.is_archived = FALSE
                        ELSE FALSE
                    END
            ),
            cohort_scoped AS (
                SELECT b.*
                FROM base_archived b
                WHERE cardinality($3::uuid[]) = 0
                    OR (b.cohort_ids && $3::uuid[] OR b.profile_cohort_ids && $3::uuid[])
            ),
            filt AS (
                SELECT * FROM cohort_scoped
            ),
            filt_x AS (
                SELECT f.*, c_id
                FROM filt f,
                LATERAL unnest(f.cohort_ids) AS c_id
            ),
            cohort_list AS (
                SELECT DISTINCT 
                    c.id, 
                    c.title,
                    ARRAY(
                        SELECT cp.profile_id 
                        FROM cohort_profiles cp
                        JOIN profiles p ON p.id = cp.profile_id
                        WHERE cp.cohort_id = c.id
                            AND (cardinality($4::text[]) = 0 OR p.role = ANY($4::profile_role[]))
                    ) AS profile_ids,
                    ARRAY(SELECT cs.simulation_id FROM cohort_simulations cs WHERE cs.cohort_id = c.id) AS simulation_ids
                FROM cohorts c
                JOIN (SELECT DISTINCT c_id FROM filt_x) fx ON fx.c_id = c.id
            ),
            cohort_required AS (
                SELECT cl.id AS cohort_id,
                    ARRAY(
                        SELECT DISTINCT s FROM unnest(cl.simulation_ids) s
                        WHERE EXISTS (SELECT 1 FROM filt_x fx WHERE fx.c_id = cl.id AND fx.simulation_id = s)
                    ) AS sim_ids
                FROM cohort_list cl
            ),
            student_passes AS (
                SELECT
                    fx.c_id AS cohort_id,
                    fx.profile_id,
                    fx.simulation_id,
                    MAX((fx.passed)::int)::int AS passed_any
                FROM filt_x fx
                GROUP BY fx.c_id, fx.profile_id, fx.simulation_id
            ),
            cohort_attempts AS (
                SELECT
                    fx.c_id AS cohort_id,
                    fx.attempt_id,
                    MAX((fx.passed)::int)::int AS passed_any,
                    AVG(fx.grade_percent)::float AS avg_grade_attempt
                FROM filt_x fx
                GROUP BY fx.c_id, fx.attempt_id
            ),
            cohort_agg AS (
                SELECT
                    cl.id AS cohort_id,
                    cl.title AS cohort_name,
                    COALESCE(cardinality(cl.profile_ids), 0) AS total_students_declared,
                    cardinality(cl.profile_ids) AS total_students_seen,
                    COUNT(DISTINCT ca.attempt_id) AS total_attempts,
                    SUM(ca.passed_any)::int AS passed_attempts,
                    (100.0 * AVG(ca.passed_any))::float AS pass_rate_attempts,
                    AVG(ca.avg_grade_attempt)::float AS avg_percentage_score,
                    (SELECT COUNT(*) FROM (
                        SELECT profile_id
                        FROM filt_x fx2
                        WHERE fx2.c_id = cl.id
                        GROUP BY profile_id
                        HAVING 
                            COUNT(DISTINCT simulation_id) = cardinality(cl.simulation_ids)
                            AND NOT EXISTS (
                                SELECT 1 
                                FROM (
                                    SELECT 
                                        simulation_id,
                                        MAX(CASE WHEN grade_percent IS NULL THEN 0 ELSE grade_percent END) as best_score
                                    FROM filt_x fx3 
                                    WHERE fx3.c_id = cl.id 
                                        AND fx3.profile_id = fx2.profile_id
                                    GROUP BY simulation_id
                                ) sim_bests
                                WHERE sim_bests.best_score < 80.0
                            )
                    ) s) AS passed_students,
                    (SELECT COUNT(*) FROM (
                        SELECT 1
                        FROM filt_x fx2
                        WHERE fx2.c_id = cl.id
                        GROUP BY fx2.profile_id
                        HAVING MAX((fx2.passed)::int) = 1
                    ) s) AS passed_at_least_once,
                    cardinality(cl.simulation_ids) AS simulation_count,
                    cardinality(cl.simulation_ids) AS required_simulations
                FROM cohort_list cl
                LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
                GROUP BY cl.id, cl.title, cl.profile_ids, cl.simulation_ids
            ),
            daily_data AS (
                SELECT
                    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
                    AVG(fx.grade_percent)::float AS avg_score,
                    fx.c_id::text AS cohort_id
                FROM filt_x fx
                WHERE fx.grade_percent IS NOT NULL
                GROUP BY fx.c_id, date_trunc('day', fx.chat_created_at)
            )
            SELECT json_build_object(
                'cohortData', COALESCE((SELECT json_agg(json_build_object(
                    'id', cohort_id::text,
                    'name', cohort_name,
                    'passRate', ROUND(
                        CASE 
                            WHEN total_students_seen > 0 THEN (100.0 * passed_students / total_students_seen)::numeric
                            ELSE 0
                        END, 2
                    )::float,
                    'avgPercentageScore', ROUND(COALESCE(avg_percentage_score, 0))::int,
                    'totalStudents', GREATEST(total_students_declared, total_students_seen),
                    'passedStudents', COALESCE(passed_at_least_once, 0),
                    'totalAttempts', COALESCE(total_attempts, 0),
                    'passedAttempts', COALESCE(passed_attempts, 0),
                    'simulationCount', COALESCE(simulation_count, 0),
                    'requiredSimulations', COALESCE(required_simulations, 0)
                ) ORDER BY cohort_name) FROM cohort_agg), '[]'::json),
                'dailyData', COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'avgScore', ROUND(COALESCE(avg_score, 0))::int,
                    'cohortId', cohort_id
                ) ORDER BY cohort_id, date) FROM daily_data), '[]'::json),
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
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build skill performance query matching stored procedure logic."""
        from datetime import datetime

        # Build params list matching stored procedure approach
        params: list[Any] = []

        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        cohort_ids = cohort_ids or []
        roles = roles or []
        sim_filters = sim_filters or ["general"]
        department_ids = department_ids or []

        params.extend(
            [
                start_dt,
                end_dt,
                cohort_ids,
                roles,
                sim_filters,
                profile_id,
                department_ids,
            ]
        )

        query = """
            WITH filt AS MATERIALIZED (
                SELECT chat_id, simulation_id, cohort_ids, profile_cohort_ids, profile_role,
                       is_general, is_practice, is_archived, profile_id, chat_created_at
                FROM analytics a
                WHERE a.chat_created_at >= $1
                    AND a.chat_created_at < $2
                    AND (cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))
                    AND ($3::uuid[] IS NULL OR cardinality($3::uuid[]) = 0 OR (a.cohort_ids && $3::uuid[] OR a.profile_cohort_ids && $3::uuid[]))
                    AND ($3::uuid[] IS NOT NULL AND cardinality($3::uuid[]) > 0 OR $4::profile_role[] IS NULL OR cardinality($4::profile_role[]) = 0 OR a.profile_role = ANY($4::profile_role[])
                         OR ($6::uuid IS NOT NULL AND a.profile_id = $6::uuid))
                    AND ($5::text[] IS NULL OR cardinality($5::text[]) > 0)
                    AND (
                        $5::text[] IS NULL OR (
                            ('general'  = ANY ($5::text[]) AND a.is_general)  OR
                            ('practice' = ANY ($5::text[]) AND a.is_practice) OR
                            ('archived' = ANY ($5::text[]) AND a.is_archived)
                        )
                    )
                    AND ($6::uuid IS NULL OR a.profile_id = $6::uuid)
            ),
            latest_grade AS MATERIALIZED (
                SELECT DISTINCT ON (scg.simulation_chat_id, scg.rubric_id)
                       scg.id                 AS grade_id,
                       scg.simulation_chat_id AS chat_id,
                       scg.rubric_id,
                       scg.created_at
                FROM simulation_chat_grades scg
                ORDER BY scg.simulation_chat_id, scg.rubric_id, scg.created_at DESC
            ),
            per_grade_group AS MATERIALIZED (
                SELECT
                    lg.rubric_id,
                    sg.id             AS group_id,
                    sg.name           AS group_name,
                    f.simulation_id,
                    lg.grade_id       AS grade_id,
                    SUM(scf.total)::float8              AS score,
                    SUM(s.points)::float8               AS points,
                    CASE WHEN sg.points > 0
                         THEN 100.0 * SUM(scf.total)::float8 / sg.points::float8
                         ELSE NULL
                    END                                 AS pct
                FROM latest_grade lg
                JOIN filt f
                    ON f.chat_id = lg.chat_id
                JOIN simulation_chat_feedbacks scf
                    ON scf.simulation_chat_grade_id = lg.grade_id
                JOIN standards s
                    ON s.id = scf.standard_id
                JOIN standard_groups sg
                    ON sg.id = s.standard_group_id AND sg.rubric_id = lg.rubric_id
                GROUP BY lg.rubric_id, sg.id, sg.name, f.simulation_id, lg.grade_id
            ),
            radar_rows AS MATERIALIZED (
                SELECT 
                    pgg.rubric_id, 
                    sg.short_name AS group_name,
                    sg.description AS group_description,
                    AVG(pgg.pct)::float8 AS avg_pct
                FROM per_grade_group pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.short_name, sg.description
            ),
            radar_per_rubric AS MATERIALIZED (
                SELECT
                    rubric_id,
                    json_agg(
                        json_build_object(
                            'metric',   group_name,
                            'description', group_description,
                            'value',    GREATEST(0, LEAST(1, COALESCE(avg_pct, 0) / 100.0)),
                            'fullMark', 1
                        )
                        ORDER BY group_name
                    ) AS radar
                FROM radar_rows
                GROUP BY rubric_id
            ),
            group_stats AS MATERIALIZED (
                SELECT
                    pgg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    sg.description AS group_description,
                    pgg.simulation_id,
                    SUM(pgg.score)  AS score_sum,
                    SUM(pgg.points) AS points_sum,
                    ROUND(AVG(pgg.pct))::int AS avg_pct
                FROM per_grade_group pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.id, sg.name, sg.description, pgg.simulation_id
            ),
            facts_per_rubric AS MATERIALIZED (
                SELECT
                    rubric_id,
                    json_agg(
                        json_build_object(
                            'groupId',         group_id::text,
                            'groupName',       group_name,
                            'groupDescription', group_description,
                            'simulationId',    simulation_id::text,
                            'score',           COALESCE(score_sum, 0),
                            'points',          COALESCE(points_sum, 0),
                            'avgPct',          COALESCE(avg_pct, 0)
                        )
                        ORDER BY group_name, simulation_id
                    ) AS facts
                FROM group_stats
                GROUP BY rubric_id
            ),
            valid_rubrics AS MATERIALIZED (
                SELECT DISTINCT rubric_id FROM per_grade_group
            ),
            valid_rubric_ids AS (
                SELECT json_agg(rubric_id::text ORDER BY rubric_id::text) AS payload
                FROM valid_rubrics
            ),
            packages AS (
                SELECT json_agg(
                       json_build_object(
                           'rubricId',  vr.rubric_id::text,
                           'radarData', COALESCE(rpr.radar, '[]'::json),
                           'groupFacts', COALESCE(fpr.facts, '[]'::json)
                       )
                       ORDER BY vr.rubric_id::text
                     ) AS payload
                FROM valid_rubrics vr
                LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id
                LEFT JOIN facts_per_rubric fpr ON fpr.rubric_id = vr.rubric_id
            )
            SELECT json_build_object(
                'packages',       COALESCE((SELECT payload FROM packages), '[]'::json),
                'validRubricIds', COALESCE((SELECT payload FROM valid_rubric_ids), '[]'::json)
            ) AS result
        """

        return query, params
