"""Canonical documents resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class DocumentsResourceData(BaseModel):
    """Canonical documents resource fields. All optional for streaming support."""

    document_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    file_id: str | None = None
    text_id: str | None = None
    image_ids: list[str] | None = None
    template: bool | None = None
    parameter_field_ids: list[str] | None = None
