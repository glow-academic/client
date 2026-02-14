"""Typed event models for documents resource generation."""

from typing import Any

from pydantic import BaseModel


class DocumentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: documents_generation_complete."""

    artifact_type: str
    resource_type: str = "documents"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
