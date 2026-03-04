"""Canonical uploads resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class UploadsResourceData(BaseModel):
    """Canonical uploads resource fields. All optional for streaming support."""

    files_id: str | None = None
    upload_id: str | None = None
    generated: bool | None = None
