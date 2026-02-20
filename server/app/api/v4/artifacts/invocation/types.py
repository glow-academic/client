"""Handcrafted types for invocation artifact (operational view of benchmark).

Invocation is to benchmark what training is to home: the operational/execution layer.
Full implementation deferred — these types support the socket generation layer.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

# =============================================================================
# GET Request / Response
# =============================================================================


class GetInvocationApiRequest(BaseModel):
    """Request model for get invocation endpoint."""

    benchmark_entry_id: UUID
    draft_id: UUID | None = None


# =============================================================================
# WebSocket Types
# =============================================================================


class InvocationWebsocketViews(BaseModel):
    """Views data for invocation websocket response."""

    runs: GetRunListViewResponse | None = None


class InvocationWebsocketResources(BaseModel):
    """Hydrated resources for invocation websocket — selected only."""

    # Config chain
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None
    config_profile: list[QGetProfilesV4Item] | None = None


class GetInvocationWebsocketResponse(BaseModel):
    """Websocket-facing invocation response with hydrated resources."""

    views: InvocationWebsocketViews | None = None
    resources: InvocationWebsocketResources
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None
