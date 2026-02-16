"""Canonical images resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ImagesResourceData(BaseModel):
    """Canonical images resource fields. All optional for streaming support."""

    image_id: str | None = None
    name: str | None = None
    description: str | None = None
    upload_id: str | None = None
    generated: bool | None = None
