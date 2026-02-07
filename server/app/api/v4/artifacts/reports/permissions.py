"""Reports calculation/business logic for get.py."""

from collections import defaultdict
from datetime import date, datetime

from app.api.v4.artifacts.reports.types import (
    ReportsDataPoint,
    ReportsHeaderMetrics,
    ReportsHistoryRow,
    ReportsHistorySection,
    ReportsLeaderboardRow,
    ReportsLeaderboardSection,
    ReportsMetric,
    ReportsMetricHover,
    ReportsOverviewRow,
    ReportsOverviewSection,
    ReportsProfileMetrics,
    ReportsSections,
    ReportsSectionStatus,
    ReportsTrendPoint,
    ReportsTrendsSection,
)
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.analytics.chat_facts.types import ChatFactsItem
from app.api.v4.views.analytics.daily_metrics.types import DailyMetricsItem
from app.api.v4.views.analytics.profile_metrics.types import ProfileMetricsItem


def _metric(value: float | int | None) -> ReportsMetric:
    return ReportsMetric(
        current_value=value,
        has_data=value is not None,
        method=None,
        data_points=[],
        hover=None,
        status="neutral",
    )


def _section(has_data: bool, note: str | None = None) -> ReportsSectionStatus:
    return ReportsSectionStatus(
        has_data=has_data,
        status="neutral" if has_data else "empty",
        note=note,
    )


def _round2(value: float | int | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _date_str(value: date | datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _status_standard(value: float | int | None, thresholds: dict[str, int]) -> str:
    if value is None or float(value) == 0:
        return "neutral"
    rounded = round(float(value))
    if rounded >= thresholds["success"]:
        return "success"
    if rounded >= thresholds["warning"]:
        return "warning"
    return "danger"


def _status_inverse(value: float | int | None, thresholds: dict[str, int]) -> str:
    if value is None or float(value) == 0:
        return "neutral"
    rounded = round(float(value))
    if rounded > thresholds["danger"]:
        return "danger"
    if rounded > thresholds["warning"]:
        return "warning"
    return "success"


def _metric_envelope(
    *,
    value: float | int | None,
    method: str,
    status: str,
    data_points: list[ReportsDataPoint] | None = None,
    hover: ReportsMetricHover | None = None,
) -> ReportsMetric:
    return ReportsMetric(
        current_value=_round2(value),
        has_data=value is not None and float(value) > 0,
        method=method,
        data_points=data_points or [],
        hover=hover,
        status=status,
    )


def _compute_stagnation_stats(
    chat_rows: list[ChatFactsItem],
) -> dict[str, tuple[float, int, int, list[ReportsDataPoint]]]:
    """Compute legacy-style stagnation rate per profile from ordered grade stream.

    Legacy rule mirrored from SQL:
    - Compare each grade to previous grade in chronological order
    - Mark stagnated when current <= previous + 0.1
    - stagnation_rate = 100 * avg(stagnated_flags)
    """
    profile_grades: dict[str, list[tuple[datetime, float]]] = defaultdict(list)
    for row in chat_rows:
        if row.profile_id is None or row.grade_percent is None:
            continue
        ts = row.grade_created_at or row.chat_created_at
        profile_grades[str(row.profile_id)].append((ts, float(row.grade_percent)))

    out: dict[str, tuple[float, int, int, list[ReportsDataPoint]]] = {}
    for profile_id, entries in profile_grades.items():
        ordered = sorted(entries, key=lambda item: item[0])
        if len(ordered) < 2:
            out[profile_id] = (0.0, 0, 0, [])
            continue

        tracked = 0
        stagnant = 0
        points: list[ReportsDataPoint] = []
        prev_score: float | None = None
        for ts, score in ordered:
            points.append(
                ReportsDataPoint(
                    profile_id=profile_id,
                    date=_date_str(ts.date()),
                    value=_round2(score),
                )
            )
            if prev_score is None:
                prev_score = score
                continue
            tracked += 1
            if score <= prev_score + 0.1:
                stagnant += 1
            prev_score = score

        rate = (stagnant / tracked * 100.0) if tracked > 0 else 0.0
        out[profile_id] = (_round2(rate) or 0.0, tracked, stagnant, points)

    return out


def compute_reports_header_metrics(
    attempts: list[AttemptFactsItem],
    chat_rows: list[ChatFactsItem],
    daily_rows: list[DailyMetricsItem],
    profile_rows: list[ProfileMetricsItem],
    total_count: int = 0,
    thresholds: dict[str, int] | None = None,
) -> ReportsHeaderMetrics:
    """Compute top-level report summary metrics from MV slices."""
    thresholds = thresholds or {"success": 85, "warning": 80, "danger": 70}
    total_attempts = total_count if total_count > 0 else len(attempts)

    # Weighted by attempt_count from daily slice where possible.
    weighted_score_sum = 0.0
    weighted_score_n = 0
    for row in daily_rows:
        attempts_n = row.attempt_count or 0
        if attempts_n <= 0:
            continue
        if row.avg_score is not None:
            weighted_score_sum += float(row.avg_score) * attempts_n
            weighted_score_n += attempts_n

    average_score = (
        round(weighted_score_sum / weighted_score_n, 2)
        if weighted_score_n > 0
        else None
    )

    # Fallback to attempt rows if daily metrics are empty.
    if average_score is None:
        attempt_scores = [
            float(attempt.score_percent)
            for attempt in attempts
            if attempt.score_percent is not None
        ]
        if attempt_scores:
            average_score = round(sum(attempt_scores) / len(attempt_scores), 2)

    completed_count = sum(1 for row in chat_rows if row.completed)
    completion_pct = (
        round((completed_count / total_attempts) * 100, 2)
        if total_attempts > 0
        else None
    )

    # Use weighted profile-metrics aggregate (matches profile-level rollups better).
    weighted_first_attempt_sum = 0.0
    weighted_first_attempt_n = 0
    for row in profile_rows:
        if row.first_attempt_pass_rate is None:
            continue
        attempts_n = row.total_attempts or 0
        if attempts_n <= 0:
            continue
        weighted_first_attempt_sum += float(row.first_attempt_pass_rate) * attempts_n
        weighted_first_attempt_n += attempts_n
    first_attempt_pass_rate = (
        round(weighted_first_attempt_sum / weighted_first_attempt_n, 2)
        if weighted_first_attempt_n > 0
        else None
    )

    avg_score_points = [
        ReportsDataPoint(date=_date_str(row.date_key), value=_round2(row.avg_score))
        for row in sorted(daily_rows, key=lambda r: r.date_key)
        if row.avg_score is not None
    ]
    completion_points = [
        ReportsDataPoint(
            date=_date_str(row.date_key),
            value=_round2(
                ((row.completed_count or 0) / (row.attempt_count or 1) * 100)
                if (row.attempt_count or 0) > 0
                else None
            ),
        )
        for row in sorted(daily_rows, key=lambda r: r.date_key)
        if (row.attempt_count or 0) > 0
    ]
    first_attempt_points = [
        ReportsDataPoint(
            profile_id=str(row.profile_id),
            value=_round2(row.first_attempt_pass_rate),
        )
        for row in profile_rows
        if row.first_attempt_pass_rate is not None
    ]

    return ReportsHeaderMetrics(
        total_attempts=_metric_envelope(
            value=total_attempts,
            method="countDistinct",
            status=_status_standard(total_attempts, thresholds),
            hover=ReportsMetricHover(attempts=total_attempts),
        ),
        average_score=_metric_envelope(
            value=average_score,
            method="avg",
            status=_status_standard(average_score, thresholds),
            data_points=avg_score_points,
            hover=ReportsMetricHover(
                mean=round(average_score) if average_score is not None else 0,
                median=round(average_score) if average_score is not None else 0,
                mode=round(average_score) if average_score is not None else 0,
                avg_score_percent=round(average_score)
                if average_score is not None
                else 0,
            ),
        ),
        completion_percentage=_metric_envelope(
            value=completion_pct,
            method="rate",
            status=_status_standard(completion_pct, thresholds),
            data_points=completion_points,
            hover=ReportsMetricHover(
                completed=completed_count,
                total=total_attempts,
                percent=round(completion_pct) if completion_pct is not None else 0,
            ),
        ),
        first_attempt_pass_rate=_metric_envelope(
            value=first_attempt_pass_rate,
            method="rate",
            status=_status_standard(first_attempt_pass_rate, thresholds),
            data_points=first_attempt_points,
            hover=ReportsMetricHover(
                percent=round(first_attempt_pass_rate)
                if first_attempt_pass_rate is not None
                else 0,
            ),
        ),
    )


def _build_profile_metrics(
    row: ProfileMetricsItem,
    thresholds: dict[str, int],
    stagnation_stats: dict[str, tuple[float, int, int, list[ReportsDataPoint]]],
) -> ReportsProfileMetrics:
    avg_score = _round2(row.avg_score)
    completion_pct = _round2(row.completion_pct)
    first_attempt = _round2(row.first_attempt_pass_rate)
    highest_score = _round2(row.highest_score)
    avg_messages = _round2(row.avg_messages_per_session)
    persona_response = _round2(row.avg_persona_response_sec)
    session_efficiency = _round2(row.session_efficiency)
    profile_key = str(row.profile_id)
    stagnation_rate, tracked, stagnant, stagnation_points = stagnation_stats.get(
        profile_key,
        (0.0, 0, 0, []),
    )
    total_minutes = _round2(row.total_time_minutes)
    total_attempts = row.total_attempts or 0

    return ReportsProfileMetrics(
        average_score=_metric_envelope(
            value=avg_score,
            method="avg",
            status=_status_standard(avg_score, thresholds),
            hover=ReportsMetricHover(
                mean=round(avg_score) if avg_score is not None else 0,
                median=round(avg_score) if avg_score is not None else 0,
                mode=round(avg_score) if avg_score is not None else 0,
                avg_score_percent=round(avg_score) if avg_score is not None else 0,
            ),
        ),
        completion_percentage=_metric_envelope(
            value=completion_pct,
            method="rate",
            status=_status_standard(completion_pct, thresholds),
            hover=ReportsMetricHover(
                percent=round(completion_pct) if completion_pct is not None else 0,
            ),
        ),
        first_attempt_pass_rate=_metric_envelope(
            value=first_attempt,
            method="rate",
            status=_status_standard(first_attempt, thresholds),
            hover=ReportsMetricHover(
                percent=round(first_attempt) if first_attempt is not None else 0,
            ),
        ),
        highest_score=_metric_envelope(
            value=highest_score,
            method="max",
            status=_status_standard(highest_score, thresholds),
            hover=ReportsMetricHover(
                top=[round(highest_score)] if highest_score is not None else [],
            ),
        ),
        messages_per_session=_metric_envelope(
            value=avg_messages,
            method="avg",
            status=_status_standard(avg_messages, thresholds),
            hover=ReportsMetricHover(
                mean=round(avg_messages) if avg_messages is not None else 0,
                median=round(avg_messages) if avg_messages is not None else 0,
                count=total_attempts,
            ),
        ),
        persona_response_times=_metric_envelope(
            value=persona_response,
            method="avg",
            status=_status_inverse(persona_response, thresholds),
            hover=ReportsMetricHover(
                mean_seconds=round(persona_response)
                if persona_response is not None
                else 0,
                median_seconds=round(persona_response)
                if persona_response is not None
                else 0,
            ),
        ),
        session_efficiency=_metric_envelope(
            value=session_efficiency,
            method="avg",
            status=_status_standard(session_efficiency, thresholds),
            hover=ReportsMetricHover(
                efficiency=round(session_efficiency)
                if session_efficiency is not None
                else 0,
            ),
        ),
        stagnation_rate=_metric_envelope(
            value=stagnation_rate,
            method="rate",
            status=_status_inverse(stagnation_rate, thresholds),
            data_points=stagnation_points,
            hover=ReportsMetricHover(
                tracked=tracked,
                stagnant=stagnant,
                rate_percent=round(stagnation_rate),
            ),
        ),
        time_spent=_metric_envelope(
            value=total_minutes,
            method="sum",
            status=_status_standard(total_minutes, thresholds),
            hover=ReportsMetricHover(
                total_minutes=round(total_minutes) if total_minutes is not None else 0,
                total_hours=round((total_minutes or 0) / 60.0, 1),
            ),
        ),
        total_attempts=_metric_envelope(
            value=total_attempts,
            method="countDistinct",
            status=_status_standard(total_attempts, thresholds),
            hover=ReportsMetricHover(attempts=total_attempts),
        ),
    )


def compute_overview_section(
    attempts: list[AttemptFactsItem],
) -> ReportsOverviewSection:
    """Compute simulation-level overview aggregates."""
    grouped: dict[str, dict[str, float]] = defaultdict(
        lambda: {
            "attempts": 0.0,
            "completed": 0.0,
            "passed": 0.0,
            "score_sum": 0.0,
            "score_n": 0.0,
        }
    )

    for attempt in attempts:
        if attempt.simulation_id is None:
            continue
        key = str(attempt.simulation_id)
        bucket = grouped[key]
        bucket["attempts"] += 1
        if (attempt.num_chats or 0) > 0 and (attempt.num_chats_completed or 0) >= (
            attempt.num_chats or 0
        ):
            bucket["completed"] += 1
        if attempt.has_passed:
            bucket["passed"] += 1
        if attempt.score_percent is not None:
            bucket["score_sum"] += float(attempt.score_percent)
            bucket["score_n"] += 1

    rows: list[ReportsOverviewRow] = []
    for simulation_id, bucket in grouped.items():
        attempts_n = int(bucket["attempts"])
        completed_n = int(bucket["completed"])
        passed_n = int(bucket["passed"])
        avg_score = (
            bucket["score_sum"] / bucket["score_n"] if bucket["score_n"] > 0 else None
        )
        completion_pct = (completed_n / attempts_n) * 100 if attempts_n > 0 else None
        pass_rate = (passed_n / attempts_n) * 100 if attempts_n > 0 else None
        rows.append(
            ReportsOverviewRow(
                simulation_id=simulation_id,
                attempts=attempts_n,
                completed_attempts=completed_n,
                passed_attempts=passed_n,
                average_score=_round2(avg_score),
                completion_percentage=_round2(completion_pct),
                pass_rate=_round2(pass_rate),
            )
        )

    rows.sort(
        key=lambda row: (
            row.attempts,
            row.average_score if row.average_score is not None else -1.0,
        ),
        reverse=True,
    )
    return ReportsOverviewSection(
        status=_section(bool(rows), "Derived from mv_attempt_facts"),
        rows=rows,
    )


def compute_leaderboard_section(
    profile_rows: list[ProfileMetricsItem],
    chat_rows: list[ChatFactsItem],
    thresholds: dict[str, int] | None = None,
) -> ReportsLeaderboardSection:
    """Compute leaderboard rows from profile metrics slice."""
    thresholds = thresholds or {"success": 85, "warning": 80, "danger": 70}
    stagnation_stats = _compute_stagnation_stats(chat_rows)
    sorted_rows = sorted(
        profile_rows,
        key=lambda row: (
            float(row.avg_score) if row.avg_score is not None else -1.0,
            row.total_attempts,
        ),
        reverse=True,
    )

    rows: list[ReportsLeaderboardRow] = []
    for index, row in enumerate(sorted_rows):
        rows.append(
            ReportsLeaderboardRow(
                rank=index + 1,
                profile_id=str(row.profile_id) if row.profile_id else None,
                total_attempts=row.total_attempts or 0,
                average_score=_round2(row.avg_score),
                highest_score=_round2(row.highest_score),
                completion_percentage=_round2(row.completion_pct),
                first_attempt_pass_rate=_round2(row.first_attempt_pass_rate),
                profile_metrics=_build_profile_metrics(
                    row=row,
                    thresholds=thresholds,
                    stagnation_stats=stagnation_stats,
                ),
                simulation_ids=[str(sid) for sid in row.simulation_ids or []],
                scenario_ids=[str(sid) for sid in row.scenario_ids or []],
            )
        )

    return ReportsLeaderboardSection(
        status=_section(bool(rows), "Derived from mv_profile_metrics"),
        rows=rows,
    )


def compute_trends_section(
    daily_rows: list[DailyMetricsItem],
) -> ReportsTrendsSection:
    """Compute daily trend points from daily metrics slice."""
    grouped: dict[date, dict[str, float]] = defaultdict(
        lambda: {
            "attempts": 0.0,
            "completed": 0.0,
            "passed": 0.0,
            "score_sum": 0.0,
            "score_n": 0.0,
        }
    )

    for row in daily_rows:
        bucket = grouped[row.date_key]
        attempts_n = float(row.attempt_count or 0)
        bucket["attempts"] += attempts_n
        bucket["completed"] += float(row.completed_count or 0)
        bucket["passed"] += float(row.passed_count or 0)
        if row.avg_score is not None and attempts_n > 0:
            bucket["score_sum"] += float(row.avg_score) * attempts_n
            bucket["score_n"] += attempts_n

    points: list[ReportsTrendPoint] = []
    for day in sorted(grouped.keys()):
        bucket = grouped[day]
        attempts_n = int(bucket["attempts"])
        completed_n = int(bucket["completed"])
        passed_n = int(bucket["passed"])
        avg_score = (
            bucket["score_sum"] / bucket["score_n"] if bucket["score_n"] > 0 else None
        )
        completion_pct = (completed_n / attempts_n) * 100 if attempts_n > 0 else None
        pass_rate = (passed_n / attempts_n) * 100 if attempts_n > 0 else None
        points.append(
            ReportsTrendPoint(
                date=_date_str(day),
                attempts=attempts_n,
                completed_attempts=completed_n,
                passed_attempts=passed_n,
                average_score=_round2(avg_score),
                completion_percentage=_round2(completion_pct),
                pass_rate=_round2(pass_rate),
            )
        )

    return ReportsTrendsSection(
        status=_section(bool(points), "Derived from mv_daily_metrics"),
        chart_data=points,
    )


def compute_history_section(
    attempts: list[AttemptFactsItem],
) -> ReportsHistorySection:
    """Compute history rows from attempt facts slice."""
    rows: list[ReportsHistoryRow] = []
    for attempt in sorted(
        attempts,
        key=lambda row: (
            row.attempt_created_at
            if row.attempt_created_at is not None
            else datetime.min
        ),
        reverse=True,
    ):
        rows.append(
            ReportsHistoryRow(
                attempt_id=str(attempt.attempt_id),
                profile_id=str(attempt.profile_id) if attempt.profile_id else None,
                simulation_id=str(attempt.simulation_id)
                if attempt.simulation_id
                else None,
                cohort_id=str(attempt.cohort_id) if attempt.cohort_id else None,
                attempt_created_at=attempt.attempt_created_at,
                attempt_type=attempt.attempt_type,
                is_archived=attempt.is_archived,
                infinite_mode=attempt.infinite_mode,
                score_percent=_round2(attempt.score_percent),
                has_passed=attempt.has_passed,
                num_chats=attempt.num_chats or 0,
                num_chats_completed=attempt.num_chats_completed or 0,
                total_time_seconds=attempt.total_time_seconds or 0,
                scenario_ids=[str(sid) for sid in attempt.scenario_ids or []],
            )
        )

    return ReportsHistorySection(
        status=_section(bool(rows), "Uses mv_attempt_facts timeline"),
        rows=rows,
    )


def build_reports_sections(
    attempts: list[AttemptFactsItem],
    chat_rows: list[ChatFactsItem],
    daily_rows: list[DailyMetricsItem],
    profile_rows: list[ProfileMetricsItem],
    total_count: int = 0,
    thresholds: dict[str, int] | None = None,
) -> ReportsSections:
    """Build section-computation skeleton for reports artifact.

    Notes:
    - overview: attempt-level base facts
    - leaderboard: profile-level ranks/summaries
    - trends: daily time-series + chat-level detail context
    - history: attempt/chat event coverage
    """
    header_metrics = compute_reports_header_metrics(
        attempts=attempts,
        chat_rows=chat_rows,
        daily_rows=daily_rows,
        profile_rows=profile_rows,
        total_count=total_count,
        thresholds=thresholds,
    )

    return ReportsSections(
        header_metrics=header_metrics,
        overview=compute_overview_section(attempts=attempts),
        leaderboard=compute_leaderboard_section(
            profile_rows=profile_rows,
            chat_rows=chat_rows,
            thresholds=thresholds,
        ),
        trends=compute_trends_section(daily_rows=daily_rows),
        history=compute_history_section(attempts=attempts),
    )
