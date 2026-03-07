"""Handcrafted types for parameter artifact endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

# ---------------------------------------------------------------------------
# Handcrafted resource types (replaces Q types from app.sql.types)
# ---------------------------------------------------------------------------


class ParameterNameResource(BaseModel):
    """Name resource for parameter."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ParameterDescriptionResource(BaseModel):
    """Description resource for parameter."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class ParameterDepartmentResource(BaseModel):
    """Department resource for parameter."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ParameterFieldResource(BaseModel):
    """Parameter field resource for parameter."""

    id: UUID | None = None
    field_id: UUID | None = None
    parameter_id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ParameterDraftEntry(BaseModel):
    """Draft entry for parameter."""

    id: UUID | None = None
    version: int | None = None
    created_at: datetime | None = None
    generated: bool | None = None
    mcp: bool | None = None
    active: bool | None = None
    group_id: UUID | None = None
    session_id: UUID | None = None
    department_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    name_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None


class ParameterFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str
    label: str
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    generated: bool | None = None


# ---------------------------------------------------------------------------
# Section types
# ---------------------------------------------------------------------------


class ParameterNameSection(BaseResourceSection):
    resource: ParameterNameResource | None = None
    resources: list[ParameterNameResource] | None = None


class ParameterDescriptionSection(BaseResourceSection):
    resource: ParameterDescriptionResource | None = None
    resources: list[ParameterDescriptionResource] | None = None


class ParameterFlagSection(BaseResourceSection):
    current: list[ParameterFlagConfig] | None = None
    resources: list[ParameterFlagConfig] | None = None


class ParameterDepartmentSection(BaseResourceSection):
    current: list[ParameterDepartmentResource] | None = None
    resources: list[ParameterDepartmentResource] | None = None


class ParameterFieldSection(BaseResourceSection):
    current: list[ParameterFieldResource] | None = None
    resources: list[ParameterFieldResource] | None = None


# ---------------------------------------------------------------------------
# GET endpoint types
# ---------------------------------------------------------------------------


class GetParameterApiRequest(BaseModel):
    """Request model for get parameter endpoint."""

    parameter_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID


class GetParameterApiResponse(BaseModel):
    """Section-first client response for get parameter endpoint."""

    actor_name: str | None = None
    parameter_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    fields_step_show_ai_generate: bool | None = None

    names: ParameterNameSection | None = None
    descriptions: ParameterDescriptionSection | None = None
    flags: ParameterFlagSection | None = None
    departments: ParameterDepartmentSection | None = None
    fields: ParameterFieldSection | None = None


# ---------------------------------------------------------------------------
# Websocket types
# ---------------------------------------------------------------------------


class ParameterWebsocketEntries(BaseModel):
    draft_parameter: ParameterDraftEntry | None = None
    runs: GetRunListViewResponse | None = None


class ParameterWebsocketResources(BaseModel):
    """Hydrated selected resources for websocket generation context."""

    names: list[ParameterNameResource] | None = None
    descriptions: list[ParameterDescriptionResource] | None = None
    flags: list[ParameterFlagConfig] | None = None
    departments: list[ParameterDepartmentResource] | None = None
    fields: list[ParameterFieldResource] | None = None


class GetParameterWebsocketResponse(InternalResponseBase):
    entries: ParameterWebsocketEntries | None = None
    resources: ParameterWebsocketResources


# ========== List Endpoint Types ==========


class ListParameterApiParameter(BaseModel):
    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    num_items: int | None = None
    sample_items: list[str] | None = None
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListParameterApiResponse(BaseModel):
    actor_name: str | None = None
    parameters: list[ListParameterApiParameter] | None = None
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
    total_count: int | None = None


# ========== Save/Draft Resource Action Types ==========


class ParameterResourceAction(BaseModel):
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ParameterMultiResourceAction(BaseModel):
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class SaveParameterApiRequest(BaseModel):
    """Request model for save parameter endpoint - flat resource IDs."""

    input_parameter_id: UUID | None = None
    name_id: UUID
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None


class SaveParameterApiResponse(BaseModel):
    success: bool
    parameter_id: UUID
    message: str


class SaveParameterSqlParams(BaseModel):
    profile_id: UUID
    group_id: UUID
    input_parameter_id: UUID | None = None
    names: ParameterResourceAction
    descriptions: ParameterResourceAction
    flags: ParameterMultiResourceAction
    departments: ParameterMultiResourceAction
    fields: ParameterMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveParameterApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveParameterSqlParams:
        return cls(
            profile_id=profile_id,
            group_id=group_id,
            input_parameter_id=request.input_parameter_id,
            names=ParameterResourceAction(resource_id=request.name_id),
            descriptions=ParameterResourceAction(resource_id=request.description_id),
            flags=ParameterMultiResourceAction(resource_ids=request.flag_ids),
            departments=ParameterMultiResourceAction(
                resource_ids=request.department_ids
            ),
            fields=ParameterMultiResourceAction(resource_ids=request.field_ids),
        )

    def to_tuple(self) -> tuple:
        def single(a: ParameterResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ParameterMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.group_id,
            self.input_parameter_id,
            single(self.names),
            single(self.descriptions),
            multi(self.flags),
            multi(self.departments),
            multi(self.fields),
        )


class SaveParameterSqlRow(BaseModel):
    parameter_id: UUID | None = None
    actor_name: str | None = None


class PatchParameterDraftApiRequest(BaseModel):
    """Request model for patch parameter draft endpoint - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    expected_version: int = 0


class PatchParameterDraftApiResponse(BaseModel):
    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchParameterDraftSqlParams(BaseModel):
    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ParameterResourceAction
    descriptions: ParameterResourceAction
    flags: ParameterMultiResourceAction
    departments: ParameterMultiResourceAction
    fields: ParameterMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls, request: PatchParameterDraftApiRequest, profile_id: UUID
    ) -> PatchParameterDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=ParameterResourceAction(resource_id=request.name_id),
            descriptions=ParameterResourceAction(resource_id=request.description_id),
            flags=ParameterMultiResourceAction(resource_ids=request.flag_ids),
            departments=ParameterMultiResourceAction(
                resource_ids=request.department_ids
            ),
            fields=ParameterMultiResourceAction(resource_ids=request.field_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple:
        def single(a: ParameterResourceAction) -> tuple:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ParameterMultiResourceAction) -> tuple:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            multi(self.flags),
            multi(self.departments),
            multi(self.fields),
            self.expected_version,
        )


class PatchParameterDraftSqlRow(BaseModel):
    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# ========== Delete Endpoint Types ==========


class DeleteParameterApiRequest(BaseModel):
    parameter_id: UUID


class DeleteParameterApiResponse(BaseModel):
    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateParameterApiRequest(BaseModel):
    parameter_id: UUID


class DuplicateParameterApiResponse(BaseModel):
    success: bool
    parameter_id: UUID
    message: str
