"""Reports calculation/business logic for get.py."""

from collections import defaultdict
from datetime import date, datetime

from app.api.v4.artifacts.reports.types import (
    ReportsHeaderMetrics,
    ReportsHistoryRow,
    ReportsHistorySection,
    ReportsLeaderboardRow,
    ReportsLeaderboardSection,
    ReportsMetric,
    ReportsOverviewRow,
    ReportsOverviewSection,
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


def compute_reports_header_metrics(
    attempts: list[AttemptFactsItem],
    daily_rows: list[DailyMetricsItem],
    profile_rows: list[ProfileMetricsItem],
) -> ReportsHeaderMetrics:
    """Compute top-level report summary metrics from MV slices."""
    total_attempts = len(attempts)

    # Weighted by attempt_count from daily slice where possible.
    weighted_score_sum = 0.0
    weighted_score_n = 0
    completed_count = 0
    passed_count = 0
    for row in daily_rows:
        attempts_n = row.attempt_count or 0
        if attempts_n <= 0:
            continue
        completed_count += row.completed_count or 0
        passed_count += row.passed_count or 0
        if row.avg_score is not None:
            weighted_score_sum += float(row.avg_score) * attempts_n
            weighted_score_n += attempts_n

    average_score = (
        round(weighted_score_sum / weighted_score_n, 2)
        if weighted_score_n > 0
        else None
    )
    completion_pct = (
        round((completed_count / total_attempts) * 100, 2)
        if total_attempts > 0
        else None
    )

    # Use profile-metrics aggregate for first attempt pass rate if available.
    pass_rate_values = [
        float(row.first_attempt_pass_rate)
        for row in profile_rows
        if row.first_attempt_pass_rate is not None
    ]
    first_attempt_pass_rate = (
        round(sum(pass_rate_values) / len(pass_rate_values), 2)
        if pass_rate_values
        else None
    )

    return ReportsHeaderMetrics(
        total_attempts=_metric(total_attempts),
        average_score=_metric(average_score),
        completion_percentage=_metric(completion_pct),
        first_attempt_pass_rate=_metric(first_attempt_pass_rate),
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
        completion_pct = (
            (completed_n / attempts_n) * 100 if attempts_n > 0 else None
        )
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
) -> ReportsLeaderboardSection:
    """Compute leaderboard rows from profile metrics slice."""
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
        completion_pct = (
            (completed_n / attempts_n) * 100 if attempts_n > 0 else None
        )
        pass_rate = (passed_n / attempts_n) * 100 if attempts_n > 0 else None
        points.append(
            ReportsTrendPoint(
                date=day,
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
        key=lambda row: row.attempt_created_at
        if row.attempt_created_at is not None
        else datetime.min,
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
        daily_rows=daily_rows,
        profile_rows=profile_rows,
    )

    return ReportsSections(
        header_metrics=header_metrics,
        overview=compute_overview_section(attempts=attempts),
        leaderboard=compute_leaderboard_section(profile_rows=profile_rows),
        trends=compute_trends_section(daily_rows=daily_rows),
        history=compute_history_section(attempts=attempts),
    )
