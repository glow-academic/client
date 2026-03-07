"""Handcrafted types for invocation artifact (operational view of benchmark).

Invocation is to benchmark what training is to home: the operational/execution layer.
Includes Suite/Bundle types for the customization flow and socket generation layer.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

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


class InvocationWebsocketEntries(BaseModel):
    """Views data for invocation websocket response."""

    runs: GetRunListViewResponse | None = None


class InvocationWebsocketResources(BaseModel):
    """Hydrated resources for invocation websocket — selected only."""

    pass


class GetInvocationWebsocketResponse(InternalResponseBase):
    """Websocket-facing invocation response with hydrated resources."""

    entries: InvocationWebsocketEntries | None = None
    resources: InvocationWebsocketResources


# =============================================================================
# SUITE/BUNDLE endpoint types (customize flow) — Section-first pattern
# =============================================================================


class GetSuiteRequest(BaseModel):
    """Client API request for one benchmark bundle customization payload."""

    test_id: UUID
    group_id: UUID
    draft_id: UUID | None = None
    # Search filters
    descriptions_search: str | None = None


# --- Section types (one per resource) ---


class BaseSuiteSection(BaseModel):
    """Common metadata fields for all benchmark bundle resource sections."""

    show: bool = False
    required: bool = False
    show_ai_generate: bool = False


class SuiteNameSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteDescriptionSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteFlagSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteDepartmentSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteValueSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteKeySection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteEndpointSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteModalitySection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteTemperatureLevelSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuitePricingSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteReasoningLevelSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteQualitySection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


class SuiteVoiceSection(BaseSuiteSection):
    current: list[Any] | None = None
    resources: list[Any] | None = None


# --- GET response (section-first) ---


class GetSuiteResponse(BaseModel):
    """Client-facing bundle response — section-first pattern."""

    test_id: UUID
    profile_has_access: bool = False
    draft_version: int | None = None
    group_id: UUID | None = None

    # 13 section-first resources
    names: SuiteNameSection | None = None
    descriptions: SuiteDescriptionSection | None = None
    values: SuiteValueSection | None = None
    flags: SuiteFlagSection | None = None
    departments: SuiteDepartmentSection | None = None
    keys: SuiteKeySection | None = None
    endpoints: SuiteEndpointSection | None = None
    modalities: SuiteModalitySection | None = None
    temperature_levels: SuiteTemperatureLevelSection | None = None
    pricing: SuitePricingSection | None = None
    reasoning_levels: SuiteReasoningLevelSection | None = None
    qualities: SuiteQualitySection | None = None
    voices: SuiteVoiceSection | None = None


# --- Websocket types (mirrors training bundle websocket pattern) ---


class SuiteWebsocketResources(BaseModel):
    """Hydrated resources for bundle websocket — selected only."""

    names: list[Any] | None = None
    descriptions: list[Any] | None = None
    values: list[Any] | None = None
    flags: list[Any] | None = None
    departments: list[Any] | None = None
    keys: list[Any] | None = None
    endpoints: list[Any] | None = None
    modalities: list[Any] | None = None
    temperature_levels: list[Any] | None = None
    pricing: list[Any] | None = None
    reasoning_levels: list[Any] | None = None
    qualities: list[Any] | None = None
    voices: list[Any] | None = None


class SuiteWebsocketEntries(BaseModel):
    """Draft view for bundle websocket consumers."""

    draft_suite: Any | None = None
    runs: GetRunListViewResponse | None = None


class GetSuiteWebsocketResponse(InternalResponseBase):
    """Websocket-facing bundle response with hydrated resources."""

    entries: SuiteWebsocketEntries | None = None
    resources: SuiteWebsocketResources


# =============================================================================
# DRAFT endpoint types (composable infra)
# =============================================================================


class PatchInvocationDraftApiRequest(BaseModel):
    """Request model for new-style invocation draft endpoint.

    All resources are ID-only (no creatable resources).

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # All ID-only
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None
    model_flag_ids: list[UUID] | None = None
    model_position_ids: list[UUID] | None = None
    model_rubric_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    reasoning_level_ids: list[UUID] | None = None
    temperature_level_ids: list[UUID] | None = None
    voice_ids: list[UUID] | None = None


class PatchInvocationDraftApiResponse(BaseModel):
    """Response model for new-style invocation draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
