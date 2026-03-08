"""Handcrafted types for document endpoints.

Section-first API responses following the gold standard pattern (REFERENCE.md).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.infra.document_create import CreateDocumentItem
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection

# ---------------------------------------------------------------------------
# Handcrafted resource types (replaces Q types from app.sql.types)
# ---------------------------------------------------------------------------


class DocumentNameResource(BaseModel):
    """Name resource for document."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class DocumentDescriptionResource(BaseModel):
    """Description resource for document."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class DocumentDepartmentResource(BaseModel):
    """Department resource for document."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class DocumentParameterFieldResource(BaseModel):
    """Parameter field resource for document."""

    id: UUID | None = None
    field_id: UUID | None = None
    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class DocumentFileResource(BaseModel):
    """File (upload) resource for document."""

    id: UUID | None = None
    generated: bool | None = None


class DocumentImageResource(BaseModel):
    """Image resource for document."""

    id: UUID | None = None
    generated: bool | None = None


class DocumentTextResource(BaseModel):
    """Text resource for document."""

    id: UUID | None = None
    generated: bool | None = None


class DocumentDraftEntry(BaseModel):
    """Draft entry for document."""

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
    file_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    name_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    text_ids: list[UUID] | None = None


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
    group_id: UUID


class DocumentNameSection(BaseResourceSection):
    resource: DocumentNameResource | None = None
    resources: list[DocumentNameResource] | None = None


class DocumentDescriptionSection(BaseResourceSection):
    resource: DocumentDescriptionResource | None = None
    resources: list[DocumentDescriptionResource] | None = None


class DocumentFlagSection(BaseResourceSection):
    current: list[DocumentFlagConfig] | None = None
    resources: list[DocumentFlagConfig] | None = None


class DocumentDepartmentSection(BaseResourceSection):
    current: list[DocumentDepartmentResource] | None = None
    resources: list[DocumentDepartmentResource] | None = None


class DocumentFieldSection(BaseResourceSection):
    current: list[DocumentParameterFieldResource] | None = None
    resources: list[DocumentParameterFieldResource] | None = None


class DocumentUploadSection(BaseResourceSection):
    current: list[DocumentFileResource] | None = None
    resources: list[DocumentFileResource] | None = None


class DocumentImageSection(BaseResourceSection):
    current: list[DocumentImageResource] | None = None
    resources: list[DocumentImageResource] | None = None


class DocumentTextSection(BaseResourceSection):
    current: list[DocumentTextResource] | None = None
    resources: list[DocumentTextResource] | None = None


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
    images: DocumentImageSection | None = None
    texts: DocumentTextSection | None = None


# ========== Internal Helper Types (used by get.py intermediate layer) ==========


class DocumentResourceBucket(BaseModel):
    """Internal bucket for holding resource lists during get_document_internal processing."""

    names: list[Any] | None = None
    descriptions: list[Any] | None = None
    flags: list[Any] | None = None
    departments: list[Any] | None = None
    fields: list[Any] | None = None
    uploads: list[Any] | None = None
    images: list[Any] | None = None
    texts: list[Any] | None = None


class DocumentResources(BaseModel):
    """Internal resources container with 'resources' (all) and 'current' (selected) buckets."""

    resources: DocumentResourceBucket | None = None
    current: DocumentResourceBucket | None = None


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
    active_scenario_count: int | None = None
    upload_id: UUID | None = None
    # Computed in Python
    can_edit: bool | None = None
    can_duplicate: bool | None = None
    can_delete: bool | None = None
    updated_at: datetime | None = None


class ListDocumentApiResponse(BaseModel):
    """Response model for list document endpoint with computed permissions."""

    actor_name: str | None = None
    documents: list[ListDocumentApiDocument] | None = None
    scenario_filter: ListFilterSection | None = None
    field_filter: ListFilterSection | None = None
    department_filter: ListFilterSection | None = None
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


# ========== Shared Create/Update Types ==========


class DocumentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class DocumentResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    document_id: UUID | None = None
    message: str
    errors: list[DocumentFieldError] | None = None


# ========== Create Endpoint Types ==========


class CreateDocumentApiRequest(BaseModel):
    """Request model for bulk create document endpoint."""

    documents: list[CreateDocumentItem]
    group_id: UUID | None = None


class CreateDocumentApiResponse(BaseModel):
    """Response model for bulk create document endpoint."""

    results: list[DocumentResultItem]


# ========== Update Endpoint Types ==========


class UpdateDocumentItem(BaseModel):
    """Single document item for update — document_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    document_id: UUID  # Required — which document to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Flag — provide ID or boolean
    flag_id: UUID | None = None
    is_inactive: bool | None = None
    # Multi-select — provide IDs or names
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # Multi-select — IDs only
    field_ids: list[UUID] | None = None
    upload_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    text_ids: list[UUID] | None = None


class UpdateDocumentApiRequest(BaseModel):
    """Request model for bulk update document endpoint."""

    documents: list[UpdateDocumentItem]
    group_id: UUID | None = None


class UpdateDocumentApiResponse(BaseModel):
    """Response model for bulk update document endpoint."""

    results: list[DocumentResultItem]


# ========== Legacy Save Types (backwards compat) ==========


class SaveDocumentFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveDocumentItem(BaseModel):
    """Single document item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field
    must be provided.
    """

    input_document_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Flag — provide ID or boolean
    flag_id: UUID | None = None
    is_inactive: bool | None = None
    # Multi-select — provide IDs or names
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # Multi-select — IDs only
    field_ids: list[UUID] | None = None
    upload_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    text_ids: list[UUID] | None = None


class SaveDocumentApiRequest(BaseModel):
    """Request model for bulk save document endpoint."""

    documents: list[SaveDocumentItem]
    group_id: UUID | None = None


class SaveDocumentResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    document_id: UUID | None = None
    message: str
    errors: list[SaveDocumentFieldError] | None = None


class SaveDocumentApiResponse(BaseModel):
    """Response model for bulk save document endpoint."""

    results: list[SaveDocumentResult]


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
    images: DocumentMultiResourceAction
    texts: DocumentMultiResourceAction

    @classmethod
    def from_request(
        cls,
        request: SaveDocumentApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> SaveDocumentSqlParams:
        return cls(
            profile_id=profile_id,
            input_document_id=request.input_document_id,
            group_id=group_id,
            names=DocumentResourceAction(resource_id=request.name_id),
            descriptions=DocumentResourceAction(resource_id=request.description_id),
            flags=DocumentResourceAction(resource_id=request.flag_id),
            departments=DocumentMultiResourceAction(
                resource_ids=request.department_ids
            ),
            fields=DocumentMultiResourceAction(resource_ids=request.field_ids),
            uploads=DocumentMultiResourceAction(resource_ids=request.upload_ids),
            images=DocumentMultiResourceAction(resource_ids=request.image_ids),
            texts=DocumentMultiResourceAction(resource_ids=request.text_ids),
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
            multi(self.images),
            multi(self.texts),
        )


class SaveDocumentSqlRow(BaseModel):
    """SQL row for save document."""

    document_id: UUID | None = None
    actor_name: str | None = None


# ========== Delete Endpoint Types ==========


class DeleteDocumentApiRequest(BaseModel):
    """Request model for bulk delete document endpoint."""

    document_ids: list[UUID]


class DeleteDocumentResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    document_id: UUID
    message: str


class DeleteDocumentApiResponse(BaseModel):
    """Response model for bulk delete document endpoint."""

    results: list[DeleteDocumentResult]


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
    """Request model for new-style document draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, file_ids, image_ids, text_ids,
        parameter_field_ids, parameter_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    file_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    text_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


class PatchDocumentDraftApiResponse(BaseModel):
    """Response model for new-style document draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# ========== Export Endpoint Types ==========


class ExportDocumentApiResponse(BaseModel):
    """Response model for export document endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int
