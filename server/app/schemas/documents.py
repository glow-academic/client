"""Documents V2 API schemas."""

from typing import Any

from pydantic import BaseModel

from .base import (DepartmentMapping, ParameterItemMapping, ParameterMapping,
                   ScenarioMapping)


class DocumentsFilters(BaseModel):
    """Filters for documents list request."""

    profileId: str


class DocumentItem(BaseModel):
    """Individual document item in the response."""

    document_id: str
    name: str
    type: str
    updatedAt: str
    extension: str
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_ids: list[str] | None  # None = cross-department
    file_path: str
    mime_type: str
    parameter_item_ids: list[str]


class DocumentsListResponse(BaseModel):
    """Response for documents list endpoint."""

    documents: list[DocumentItem]
    scenario_mapping: ScenarioMapping
    parameter_item_mapping: ParameterItemMapping
    parameter_mapping: ParameterMapping
    department_mapping: DepartmentMapping


class DocumentDetailRequest(BaseModel):
    """Request to get document details."""

    documentId: str
    profileId: str


class DocumentDetailResponse(BaseModel):
    """Detailed document response."""

    name: str
    active: bool
    type: str
    document_type_options: list[str]
    department_ids: list[str] | None  # None = cross-department (all departments)
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping
    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]
    parameter_item_mapping: ParameterItemMapping


class DocumentDetailBulkRequest(BaseModel):
    """Request to get bulk document details."""

    documentIds: list[str]
    profileId: str


class DocumentDetailBulkResponse(BaseModel):
    """Bulk document detail response."""

    document_type_options: list[str]
    type: str | None  # Common type if all same, else None
    department_ids: list[str]  # Union of all department_ids
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping
    parameter_item_ids: list[str]  # Union of all parameter_item_ids
    valid_parameter_item_ids: list[str]
    parameter_item_mapping: ParameterItemMapping


class UpdateDocumentRequest(BaseModel):
    """Request to update a document."""

    documentId: str
    type: str
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_item_ids: list[str]

    # TODO: Update document_parameter_items table when this endpoint is called
    # Currently just accepting parameter_item_ids but not storing the relationship


class BulkUpdateDocumentsRequest(BaseModel):
    """Request to bulk update documents."""

    documentIds: list[str]
    type: str
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_item_ids: list[str]

    # TODO: Update document_parameter_items table for each document
    # Currently just accepting parameter_item_ids but not storing the relationship


class UpdateDocumentResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str


class DeleteDocumentRequest(BaseModel):
    """Request to delete a document."""

    documentId: str


class BulkDeleteDocumentsRequest(BaseModel):
    """Request to bulk delete documents."""

    documentIds: list[str]


class DeleteDocumentResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


# Upload/Download Schemas
class FinalizeUploadRequest(BaseModel):
    """Request to finalize a TUS upload."""

    fileId: str
    zip: bool | None = False
    autoClassify: bool | None = False
    csv: bool | None = False
    test: bool | None = False
    profile_id: str | None = None
    department_ids: list[str] | None = None  # None = cross-department
    parameter_item_ids: list[str] | None = None


class FinalizeUploadResponse(BaseModel):
    """Response from finalizing an upload."""

    success: bool
    message: str
    status: str
    document_id: str | None = None
    documents: list[dict[str, Any]] | None = None
    users_created: int | None = None
    users_skipped: int | None = None
    errors: list[str] | None = None
    created_users: list[dict[str, Any]] | None = None
    skipped_users: list[dict[str, Any]] | None = None


# Certificate Schemas
class GenerateCertificateRequest(BaseModel):
    """Request to generate a certificate."""

    profileId: str
    profileName: str
    cohortData: list[dict[str, Any]] = []
