"""Leaderboard calculation/business logic for get.py.

This module defines the initial computation skeleton for leaderboard sections.
The route should pass raw MV slices; this module returns deterministic output
shapes that can be expanded without changing route wiring.
"""

from app.api.v4.artifacts.leaderboard.types import (
    LeaderboardAccoladeWinner,
    LeaderboardAccoladeWinners,
    LeaderboardDataRow,
    LeaderboardHeaderMetrics,
    LeaderboardMetric,
    LeaderboardMetricsEntry,
    LeaderboardSections,
    LeaderboardSectionStatus,
)
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.analytics.chat_facts.types import ChatFactsItem
from app.api.v4.views.analytics.daily_metrics.types import DailyMetricsItem
from app.api.v4.views.analytics.profile_metrics.types import ProfileMetricsItem


def _metric(
    value: float | int | None,
    *,
    method: str = "mv_profile_metrics",
    key_field: str | None = None,
    hover: str | None = None,
) -> LeaderboardMetric:
    return LeaderboardMetric(
        has_data=value is not None,
        method=method,
        current_value=value,
        key_field=key_field,
        trend_data=[],
        data_points=[],
        hover=hover,
    )


def _section(has_data: bool, note: str | None = None) -> LeaderboardSectionStatus:
    return LeaderboardSectionStatus(
        has_data=has_data,
        status="neutral" if has_data else "empty",
        note=note,
    )


def build_leaderboard_rows(
    profile_rows: list[ProfileMetricsItem],
    profile_name_by_id: dict[str, str | None] | None = None,
) -> list[LeaderboardDataRow]:
    """Build minimal leaderboard rows from profile-level MV rows."""
    rows: list[LeaderboardDataRow] = []
    profile_name_by_id = profile_name_by_id or {}
    for row in profile_rows:
        profile_id = str(row.profile_id)
        highest_score_avg = (
            float(row.highest_score)
            if row.highest_score is not None
            else (float(row.avg_score) if row.avg_score is not None else None)
        )
        metrics_entry = LeaderboardMetricsEntry(
            total_attempts=_metric(
                row.total_attempts,
                key_field="total_attempts",
            ),
            highest_score_avg=_metric(
                highest_score_avg,
                key_field="highest_score",
            ),
            messages_per_session=_metric(
                float(row.avg_messages_per_session)
                if row.avg_messages_per_session is not None
                else None,
                key_field="avg_messages_per_session",
            ),
            persona_response_seconds=_metric(
                float(row.avg_persona_response_sec)
                if row.avg_persona_response_sec is not None
                else None,
                key_field="avg_persona_response_sec",
                hover="Lower is better",
            ),
            time_spent_minutes=_metric(
                float(row.total_time_minutes)
                if row.total_time_minutes is not None
                else None,
                key_field="total_time_minutes",
            ),
            improvement_rate_per_day=_metric(
                float(row.improvement_rate) if row.improvement_rate is not None else None,
                key_field="improvement_rate",
            ),
            perfect_score_count=_metric(
                row.perfect_score_count,
                key_field="perfect_score_count",
            ),
            quickest_pass_minutes=_metric(
                float(row.quickest_pass_minutes)
                if row.quickest_pass_minutes is not None
                else None,
                key_field="quickest_pass_minutes",
                hover="Lower is better",
            ),
        )
        rows.append(
            LeaderboardDataRow(
                profile_id=profile_id,
                name=profile_name_by_id.get(profile_id),
                simulation_ids=[str(sim_id) for sim_id in row.simulation_ids],
                scenario_ids=[str(scenario_id) for scenario_id in row.scenario_ids],
                metrics_entry=metrics_entry,
            )
        )
    rows.sort(
        key=lambda r: (
            -float(r.metrics_entry.highest_score_avg.current_value or 0)
            if r.metrics_entry and r.metrics_entry.highest_score_avg
            else 0,
            -float(r.metrics_entry.total_attempts.current_value or 0)
            if r.metrics_entry and r.metrics_entry.total_attempts
            else 0,
            r.profile_id or "",
        )
    )
    for i, row in enumerate(rows, start=1):
        row.rank = i
    return rows


def _compute_header_metrics(profile_rows: list[ProfileMetricsItem]) -> LeaderboardHeaderMetrics:
    total_profiles = len({row.profile_id for row in profile_rows})
    total_attempts = sum(row.total_attempts for row in profile_rows)

    avg_scores = [float(row.avg_score) for row in profile_rows if row.avg_score is not None]
    average_score = round(sum(avg_scores) / len(avg_scores), 2) if avg_scores else None

    perfect_scores = sum(row.perfect_score_count for row in profile_rows)

    return LeaderboardHeaderMetrics(
        total_profiles=_metric(total_profiles, key_field="profile_id"),
        total_attempts=_metric(total_attempts, key_field="total_attempts"),
        average_score=_metric(average_score, key_field="avg_score"),
        perfect_scores=_metric(perfect_scores, key_field="perfect_score_count"),
    )


def _metric_value(row: LeaderboardDataRow, key: str) -> float | int | None:
    if not row.metrics_entry:
        return None
    metric = getattr(row.metrics_entry, key, None)
    if not metric:
        return None
    return metric.current_value


def _pick_max(
    rows: list[LeaderboardDataRow], key: str
) -> LeaderboardDataRow | None:
    if not rows:
        return None
    with_values = [r for r in rows if _metric_value(r, key) is not None]
    if not with_values:
        return None
    return max(
        with_values,
        key=lambda r: float(_metric_value(r, key) or 0),
    )


def _pick_min_positive(
    rows: list[LeaderboardDataRow], key: str
) -> LeaderboardDataRow | None:
    with_values = [
        r
        for r in rows
        if _metric_value(r, key) is not None and float(_metric_value(r, key) or 0) > 0
    ]
    if not with_values:
        return None
    return min(with_values, key=lambda r: float(_metric_value(r, key) or 0))


def _winner(
    row: LeaderboardDataRow | None,
    metric_key: str,
    details_fmt: str,
) -> LeaderboardAccoladeWinner | None:
    if not row:
        return None
    value = _metric_value(row, metric_key)
    if value is None:
        return None
    return LeaderboardAccoladeWinner(
        profile_id=row.profile_id,
        name=row.name,
        value=value,
        details=details_fmt.format(value=value),
    )


def compute_accolade_winners(rows: list[LeaderboardDataRow]) -> LeaderboardAccoladeWinners:
    """Compute deterministic accolade winners from normalized leaderboard rows."""
    highest_scorer = _pick_max(rows, "highest_score_avg")
    perfect_score = _pick_max(rows, "perfect_score_count")
    longest_convo = _pick_max(rows, "messages_per_session")
    response_times = _pick_min_positive(rows, "persona_response_seconds")
    quickest_pass = _pick_min_positive(rows, "quickest_pass_minutes")
    the_persistent = _pick_max(rows, "total_attempts")
    marathon_runner = _pick_max(rows, "time_spent_minutes")
    rapid_riser = _pick_max(rows, "improvement_rate_per_day")

    return LeaderboardAccoladeWinners(
        highest_scorer=_winner(highest_scorer, "highest_score_avg", "{value:.0f} avg"),
        perfect_score=_winner(perfect_score, "perfect_score_count", "{value:.0f} perfect"),
        longest_convo=_winner(longest_convo, "messages_per_session", "{value:.0f} msgs/session"),
        response_times=_winner(response_times, "persona_response_seconds", "{value:.0f}s"),
        quickest_pass=_winner(quickest_pass, "quickest_pass_minutes", "{value:.0f} min"),
        the_persistent=_winner(the_persistent, "total_attempts", "{value:.0f} attempts"),
        marathon_runner=_winner(marathon_runner, "time_spent_minutes", "{value:.0f} min"),
        rapid_riser=_winner(rapid_riser, "improvement_rate_per_day", "{value:.0f} pts/day"),
    )


def build_leaderboard_sections(
    attempts: list[AttemptFactsItem],
    chat_rows: list[ChatFactsItem],
    daily_rows: list[DailyMetricsItem],
    profile_rows: list[ProfileMetricsItem],
    rows: list[LeaderboardDataRow] | None = None,
) -> LeaderboardSections:
    """Build leaderboard section-computation skeleton from four MV slices."""
    row_data = rows or []
    return LeaderboardSections(
        header_metrics=_compute_header_metrics(profile_rows),
        rankings=_section(bool(profile_rows), "Derived from mv_profile_metrics"),
        accolades=_section(
            bool(profile_rows),
            "Derived from mv_profile_metrics rank metrics",
        ),
        trends=_section(
            bool(daily_rows) or bool(chat_rows),
            "Derived from mv_daily_metrics and mv_chat_facts",
        ),
        filters=_section(
            bool(attempts) or bool(profile_rows),
            "Filter IDs sourced from mv_attempt_facts and mv_profile_metrics",
        ),
        accolade_winners=compute_accolade_winners(row_data),
    )
