"""Shared API types for centralized event delivery."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PollEventsApiRequest(BaseModel):
    """Generic polling request for any artifact event stream."""

    artifact: str
    operation: str
    entity_id: UUID | None = None
    cursor: str | None = None
    types: list[str] | None = None
    limit: int = Field(default=50, ge=1, le=200)


class EventEnvelope(BaseModel):
    """Transport-level event shape exposed by generic delivery endpoints."""

    id: str
    event_type: str
    artifact: str
    operation: str
    created_at: datetime
    entity_id: UUID | None = None
    call_id: UUID | None = None
    tool_id: UUID | None = None
    payload: dict = Field(default_factory=dict)


class PollEventsApiResponse(BaseModel):
    """Generic polling response for any artifact stream."""

    events: list[EventEnvelope]
    next_cursor: str | None = None
    previous_cursor: str | None = None


class DispatchWebhookApiRequest(BaseModel):
    """Generic webhook dispatch request for any artifact stream."""

    artifact: str
    operation: str
    license_key: str
    entity_id: UUID | None = None
    cursor: str | None = None
    types: list[str] | None = None
    limit: int = Field(default=50, ge=1, le=200)


class DispatchWebhookApiResponse(BaseModel):
    """Webhook dispatch result."""

    success: bool
    delivered_count: int
    target_url: str
    next_cursor: str | None = None
