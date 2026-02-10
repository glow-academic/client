"""Handcrafted types for document endpoints.

Section-first API responses following the gold standard pattern (REFERENCE.md).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.api.v4.views.drafts.types import DraftDocumentViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetModelsV4Item,
    QGetNamesV4Item,
    QGetParameterFieldsV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
    QGetUploadsV4Item,
)

# ========== GET Endpoint Types ==========


class DocumentFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active"
    label: str  # e.g., "Active"
    description: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    generated: bool | None = None


class GetDocumentApiRequest(BaseModel):
    """Request model for get document endpoint."""

    document_id: UUID | None = None
    draft_id: UUID | None = None


class BaseResourceSection(BaseModel):
    """Common metadata for document resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class DocumentNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class DocumentDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


class DocumentFlagSection(BaseResourceSection):
    current: list[DocumentFlagConfig] | None = None
    resources: list[DocumentFlagConfig] | None = None


class DocumentDepartmentSection(BaseResourceSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class DocumentFieldSection(BaseResourceSection):
    current: list[QGetParameterFieldsV4Item] | None = None
    resources: list[QGetParameterFieldsV4Item] | None = None


class DocumentUploadSection(BaseResourceSection):
    current: list[QGetUploadsV4Item] | None = None
    resources: list[QGetUploadsV4Item] | None = None


class GetDocumentApiResponse(BaseModel):
    """Section-first response for document editor."""

    actor_name: str | None = None
    document_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None

    names: DocumentNameSection | None = None
    descriptions: DocumentDescriptionSection | None = None
    flags: DocumentFlagSection | None = None
    departments: DocumentDepartmentSection | None = None
    fields: DocumentFieldSection | None = None
    uploads: DocumentUploadSection | None = None


# ========== Internal Helper Types (used by get.py intermediate layer) ==========


class DocumentResourceBucket(BaseModel):
    """Internal bucket for holding resource lists during get_document_internal processing."""

    names: list[Any] | None = None
    descriptions: list[Any] | None = None
    flags: list[Any] | None = None
    departments: list[Any] | None = None
    fields: list[Any] | None = None
    uploads: list[Any] | None = None


class DocumentResources(BaseModel):
    """Internal resources container with 'resources' (all) and 'current' (selected) buckets."""

    resources: DocumentResourceBucket | None = None
    current: DocumentResourceBucket | None = None


# ========== Websocket Types ==========


class DocumentWebsocketViews(BaseModel):
    """Optional websocket views payload."""

    draft_document: DraftDocumentViewItem | None = None


class DocumentWebsocketResources(BaseModel):
    """Hydrated websocket resources: selected document + config resources."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[DocumentFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    fields: list[QGetParameterFieldsV4Item] | None = None
    uploads: list[QGetUploadsV4Item] | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetDocumentWebsocketResponse(BaseModel):
    """Minimal response for document websocket generation handlers."""

    group_id: UUID | None = None
    views: DocumentWebsocketViews | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    resources: DocumentWebsocketResources


# ========== List Endpoint Types ==========


class ListDocumentApiDocument(BaseModel):
    """Document type for list endpoint with computed permissions."""

    document_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    is_inactive: bool | None = None
    num_scenarios: int | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListDocumentApiScenario(BaseModel):
    """Scenario type for list endpoint."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    parameter_item_ids: list[UUID] | None = None
    count: int | None = None


class ListDocumentApiField(BaseModel):
    """Field type for list endpoint."""

    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListDocumentApiDepartment(BaseModel):
    """Department type for list endpoint."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    count: int | None = None


class ListDocumentApiResponse(BaseModel):
    """Response model for list document endpoint with computed permissions."""

    actor_name: str | None = None
    documents: list[ListDocumentApiDocument] | None = None
    scenarios: list[ListDocumentApiScenario] | None = None
    fields: list[ListDocumentApiField] | None = None
    departments: list[ListDocumentApiDepartment] | None = None
    total_count: int | None = None


# ========== Resource Action Types (for tool call tracking) ==========


class DocumentResourceAction(BaseModel):
    """Single-select resource action with tool call tracking."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class DocumentMultiResourceAction(BaseModel):
    """Multi-select resource action with tool call tracking."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# ========== Save Endpoint Types ==========


class SaveDocumentApiRequest(BaseModel):
    """Request model for save document endpoint - nested resource actions."""

    group_id: UUID
    input_document_id: UUID | None = None
    names: DocumentResourceAction
    descriptions: DocumentResourceAction
    flags: DocumentResourceAction
    departments: DocumentMultiResourceAction
    fields: DocumentMultiResourceAction
    uploads: DocumentMultiResourceAction


class SaveDocumentApiResponse(BaseModel):
    """Response model for save document endpoint."""

    success: bool
    document_id: UUID
    message: str


class SaveDocumentSqlParams(BaseModel):
    """SQL parameters for save document."""

    profile_id: UUID
    input_document_id: UUID | None = None
    group_id: UUID
    names: DocumentResourceAction
    descriptions: DocumentResourceAction
    flags: DocumentResourceAction
    departments: DocumentMultiResourceAction
    fields: DocumentMultiResourceAction
    uploads: DocumentMultiResourceAction

    @classmethod
    def from_request(
        cls, request: SaveDocumentApiRequest, profile_id: UUID
    ) -> SaveDocumentSqlParams:
        return cls(
            profile_id=profile_id,
            input_document_id=request.input_document_id,
            group_id=request.group_id,
            names=request.names,
            descriptions=request.descriptions,
            flags=request.flags,
            departments=request.departments,
            fields=request.fields,
            uploads=request.uploads,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: DocumentResourceAction,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(
            a: DocumentMultiResourceAction,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_document_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.fields),
            multi(self.uploads),
        )


class SaveDocumentSqlRow(BaseModel):
    """SQL row for save document."""

    document_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteDocumentApiRequest(BaseModel):
    """Request model for delete document endpoint."""

    document_id: UUID


class DeleteDocumentApiResponse(BaseModel):
    """Response model for delete document endpoint."""

    success: bool
    message: str


# ========== Duplicate Endpoint Types ==========


class DuplicateDocumentApiRequest(BaseModel):
    """Request model for duplicate document endpoint."""

    document_id: UUID


class DuplicateDocumentApiResponse(BaseModel):
    """Response model for duplicate document endpoint."""

    success: bool
    document_id: UUID
    message: str


# ========== Draft Endpoint Types ==========


class PatchDocumentDraftApiRequest(BaseModel):
    """Request model for patch document draft endpoint - nested resource actions."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: DocumentResourceAction | None = None
    descriptions: DocumentResourceAction | None = None
    flags: DocumentResourceAction | None = None
    departments: DocumentMultiResourceAction | None = None
    fields: DocumentMultiResourceAction | None = None
    uploads: DocumentMultiResourceAction | None = None
    expected_version: int | None = 0


class PatchDocumentDraftApiResponse(BaseModel):
    """Response model for patch document draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


class PatchDocumentDraftSqlParams(BaseModel):
    """SQL parameters for patch document draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: DocumentResourceAction | None = None
    descriptions: DocumentResourceAction | None = None
    flags: DocumentResourceAction | None = None
    departments: DocumentMultiResourceAction | None = None
    fields: DocumentMultiResourceAction | None = None
    uploads: DocumentMultiResourceAction | None = None
    expected_version: int | None = 0

    @classmethod
    def from_request(
        cls, request: PatchDocumentDraftApiRequest, profile_id: UUID
    ) -> PatchDocumentDraftSqlParams:
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=request.names,
            descriptions=request.descriptions,
            flags=request.flags,
            departments=request.departments,
            fields=request.fields,
            uploads=request.uploads,
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: DocumentResourceAction | None,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (
                (a.resource_id, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

        def multi(
            a: DocumentMultiResourceAction | None,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (
                (a.resource_ids, a.create_tool_id, a.link_tool_id)
                if a
                else (None, None, None)
            )

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.flags),
            multi(self.departments),
            multi(self.fields),
            multi(self.uploads),
            self.expected_version,
        )
