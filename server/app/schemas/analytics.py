"""Shared analytics request and response schemas."""

from enum import Enum
from typing import Any

from pydantic import BaseModel


# Enums
class ProfileRole(str, Enum):
    """Profile role enum matching database."""

    STUDENT = "student"
    INSTRUCTOR = "instructor"
    TA = "ta"


class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


class Method(str, Enum):
    """Analytics computation methods."""

    AVG = "avg"
    MAX = "max"
    SUM = "sum"
    RATE = "rate"
    COUNT_DISTINCT = "countDistinct"
    MIN = "min"
    SLOPE = "slope"


# Request Schemas
class AnalyticsFilters(BaseModel):
    """Analytics filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    profileId: str | None = None
    departmentIds: list[str] | None = None


# Basic Response Schemas
class TrendData(BaseModel):
    """Trend data point."""

    date: str
    value: float
    count: int


class DataPoint(BaseModel):
    """Individual data point."""

    profileId: str
    date: str | None = None
    value: float | None = None
    attemptId: str | None = None
    simulationId: str | None = None
    scenarioId: str | None = None
    count: int | None = None


class MetricResponse(BaseModel):
    """Standard metric response."""

    hasData: bool
    method: Method
    currentValue: int
    trendAnalysis: str | None = None
    valueField: str | None = None
    keyField: str | None = None
    trendData: list[TrendData]
    dataPoints: list[DataPoint]
    hover: dict[str, Any] | None = None


# Utility
class RefreshResponse(BaseModel):
    """Materialized view refresh response."""

    success: bool
    message: str
    status: str
