"""Leaderboard bundle schemas."""

from typing import Any

from pydantic import BaseModel


class LeaderboardMetric(BaseModel):
    """Leaderboard metric."""

    hasData: bool
    method: str
    currentValue: int
    keyField: str | None = None
    trendData: list[Any]
    dataPoints: list[Any]
    hover: dict[str, Any]


class LeaderboardMetrics(BaseModel):
    """Leaderboard metrics."""

    totalAttempts: LeaderboardMetric
    highestScoreAvg: LeaderboardMetric
    messagesPerSession: LeaderboardMetric
    personaResponseSeconds: LeaderboardMetric
    timeSpentMinutes: LeaderboardMetric
    improvementRatePerDay: LeaderboardMetric
    perfectScoreCount: LeaderboardMetric
    quickestPassMinutes: LeaderboardMetric


class LeaderboardRow(BaseModel):
    """Leaderboard row."""

    profileId: str
    firstName: str
    lastName: str
    metrics: LeaderboardMetrics


class LeaderboardBundleResponse(BaseModel):
    """Leaderboard bundle response."""

    data: list[LeaderboardRow]

