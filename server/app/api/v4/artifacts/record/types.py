"""Types for record artifact."""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

# =============================================================================
# WebSocket Types
# =============================================================================


class GetRecordApiRequest(BaseModel):
    """Request model for get record endpoint."""

    record_id: UUID | None = None
    draft_id: UUID | None = None


class RecordWebsocketEntries(BaseModel):
    """Entries data for record websocket response."""

    runs: GetRunListViewResponse | None = None


class RecordWebsocketResources(BaseModel):
    """Hydrated resources for record websocket — selected only."""

    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_args: list[QGetArgsV4Item] | None = None
    config_args_outputs: list[QGetArgsOutputsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetRecordWebsocketResponse(BaseModel):
    """Websocket-facing record response with hydrated resources."""

    entries: RecordWebsocketEntries | None = None
    resources: RecordWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
