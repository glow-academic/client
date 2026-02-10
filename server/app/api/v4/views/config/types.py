"""Types for config view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ConfigViewItem(BaseModel):
    """Single config from the config view (inference config)."""

    config_id: UUID

    # Inference config resource IDs
    agents_id: UUID | None = None
    models_id: UUID | None = None
    providers_id: UUID | None = None
    tool_ids: list[UUID] | None = None

    created_at: datetime | None = None


class GetConfigRequest(BaseModel):
    """Request for getting config data."""

    config_id: UUID = Field(description="Config ID to fetch")


class GetConfigResponse(BaseModel):
    """Response containing config data."""

    items: list[ConfigViewItem] = Field(
        default_factory=list, description="Config data items"
    )
