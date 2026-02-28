"""Types for record artifact."""

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.artifacts.types import InternalResponseBase
from app.api.v4.entries.runs.search import GetRunListViewResponse

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


class GetRecordWebsocketResponse(InternalResponseBase):
    """Websocket-facing record response with hydrated resources."""

    entries: RecordWebsocketEntries | None = None
    resources: RecordWebsocketResources
