"""Infra-local reports types to avoid route import cycles."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ReportsMetric(BaseModel):
    current_value: float | int | None = None
    has_data: bool = False
    method: str | None = None
    data_points: list[ReportsDataPoint] = Field(default_factory=list)
    hover: ReportsMetricHover | None = None
    status: str = "neutral"


class ReportsDataPoint(BaseModel):
    profile_id: str | None = None
    date: str | None = None
    value: float | int | None = None
    simulation_id: str | None = None
    scenario_id: str | None = None
    attempt_id: str | None = None


class ReportsMetricHover(BaseModel):
    mean: int = 0
    median: int = 0
    mode: int = 0
    count: int = 0
    completed: int = 0
    total: int = 0
    percent: int = 0
    top: list[int] = Field(default_factory=list)
    mean_seconds: int = 0
    median_seconds: int = 0
    samples: int = 0
    avg_score_percent: int = 0
    avg_minutes: int = 0
    efficiency: int = 0
    tracked: int = 0
    stagnant: int = 0
    rate_percent: int = 0
    total_minutes: int = 0
    total_hours: float = 0.0
    attempts: int = 0
    unique_simulations: int = 0
    per_simulation_mean: int = 0


class ReportsProfileMetrics(BaseModel):
    average_score: ReportsMetric = Field(default_factory=ReportsMetric)
    completion_percentage: ReportsMetric = Field(default_factory=ReportsMetric)
    first_attempt_pass_rate: ReportsMetric = Field(default_factory=ReportsMetric)
    highest_score: ReportsMetric = Field(default_factory=ReportsMetric)
    messages_per_session: ReportsMetric = Field(default_factory=ReportsMetric)
    persona_response_times: ReportsMetric = Field(default_factory=ReportsMetric)
    session_efficiency: ReportsMetric = Field(default_factory=ReportsMetric)
    stagnation_rate: ReportsMetric = Field(default_factory=ReportsMetric)
    time_spent: ReportsMetric = Field(default_factory=ReportsMetric)
    total_attempts: ReportsMetric = Field(default_factory=ReportsMetric)


class ReportsHeaderMetrics(BaseModel):
    total_attempts: ReportsMetric = Field(default_factory=ReportsMetric)
    average_score: ReportsMetric = Field(default_factory=ReportsMetric)
    completion_percentage: ReportsMetric = Field(default_factory=ReportsMetric)
    first_attempt_pass_rate: ReportsMetric = Field(default_factory=ReportsMetric)


class ReportsSectionStatus(BaseModel):
    has_data: bool = False
    status: str = "neutral"
    note: str | None = None


class ReportsOverviewRow(BaseModel):
    simulation_id: str | None = None
    attempts: int = 0
    completed_attempts: int = 0
    passed_attempts: int = 0
    average_score: float | None = None
    completion_percentage: float | None = None
    pass_rate: float | None = None


class ReportsOverviewSection(BaseModel):
    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsOverviewRow] = Field(default_factory=list)


class ReportsLeaderboardRow(BaseModel):
    rank: int
    profile_id: str | None = None
    total_attempts: int = 0
    average_score: float | None = None
    highest_score: float | None = None
    completion_percentage: float | None = None
    first_attempt_pass_rate: float | None = None
    profile_metrics: ReportsProfileMetrics | None = None
    simulation_ids: list[str] = Field(default_factory=list)
    scenario_ids: list[str] = Field(default_factory=list)


class ReportsLeaderboardSection(BaseModel):
    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsLeaderboardRow] = Field(default_factory=list)


class ReportsTrendPoint(BaseModel):
    date: str | None = None
    attempts: int = 0
    completed_attempts: int = 0
    passed_attempts: int = 0
    average_score: float | None = None
    completion_percentage: float | None = None
    pass_rate: float | None = None


class ReportsTrendsSection(BaseModel):
    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    chart_data: list[ReportsTrendPoint] = Field(default_factory=list)


class ReportsHistoryRow(BaseModel):
    attempt_id: str | None = None
    profile_id: str | None = None
    simulation_id: str | None = None
    cohort_id: str | None = None
    attempt_created_at: datetime | None = None
    attempt_type: str | None = None
    is_archived: bool = False
    infinite_mode: bool = False
    score_percent: float | None = None
    has_passed: bool = False
    num_chats: int = 0
    num_chats_completed: int = 0
    total_time_seconds: int = 0
    scenario_ids: list[str] = Field(default_factory=list)


class ReportsHistorySection(BaseModel):
    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsHistoryRow] = Field(default_factory=list)


class ReportsSections(BaseModel):
    header_metrics: ReportsHeaderMetrics = Field(default_factory=ReportsHeaderMetrics)
    overview: ReportsOverviewSection = Field(default_factory=ReportsOverviewSection)
    leaderboard: ReportsLeaderboardSection = Field(
        default_factory=ReportsLeaderboardSection
    )
    trends: ReportsTrendsSection = Field(default_factory=ReportsTrendsSection)
    history: ReportsHistorySection = Field(default_factory=ReportsHistorySection)
