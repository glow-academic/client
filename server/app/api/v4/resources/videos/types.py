"""Canonical videos resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class VideosResourceData(BaseModel):
    """Canonical videos resource fields. All optional for streaming support."""

    video_id: str | None = None
    name: str | None = None
    description: str | None = None
    upload_id: str | None = None
    generated: bool | None = None
