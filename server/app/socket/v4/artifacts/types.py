"""Artifact socket payload types."""

from pydantic import BaseModel


class GenerateErrorApiRequest(BaseModel):
    """Payload for generate_*_error events."""

    sid: str
    error_message: str
    artifact_type: str | None = None
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
