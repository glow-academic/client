"""Canonical request_limits resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RequestLimitsResourceData(BaseModel):
    """Canonical request_limits resource fields. All optional for streaming support."""

    id: str | None = None
    requests_per_day: int | None = None
    generated: bool | None = None
