"""Types for record artifact."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

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

    pass


class GetRecordWebsocketResponse(BaseModel):
    """Websocket-facing record response with hydrated resources.

    Uses Any for config chain fields to accept both compiled SQL types
    and resource fetcher types during migration.
    """

    systems: list[Any] | None = None
    agents: list[Any] | None = None
    models: list[Any] | None = None
    providers: list[Any] | None = None
    tools: list[Any] | None = None
    args: list[Any] | None = None
    args_outputs: list[Any] | None = None
    profile: list[Any] | None = None
    params: BaseModel | None = None
    resource_system_ids: dict[str, UUID | None] | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
    entries: RecordWebsocketEntries | None = None
    resources: RecordWebsocketResources
