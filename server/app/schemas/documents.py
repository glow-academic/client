"""Documents V2 API schemas."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from .base import DepartmentMapping, ParameterItemMapping, ScenarioMapping


class DocumentsFilters(BaseModel):
    """Filters for documents list request."""

    departmentIds: List[str]
    profileId: str


class DocumentItem(BaseModel):
    """Individual document item in the response."""

    document_id: str
    name: str
    type: str
    updatedAt: str
    extension: str
    scenario_ids: List[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_id: str
    file_path: str
    mime_type: str
    parameter_item_ids: List[str]


class DocumentsListResponse(BaseModel):
    """Response for documents list endpoint."""

    documents: List[DocumentItem]
    scenario_mapping: ScenarioMapping
    parameter_item_mapping: ParameterItemMapping


class DocumentDetailRequest(BaseModel):
    """Request to get document details."""

    documentId: str
    profileId: str


class DocumentDetailResponse(BaseModel):
    """Detailed document response."""

    name: str
    active: bool
    type: str
    document_type_options: List[str]
    department_id: str
    valid_department_ids: List[str]
    department_mapping: DepartmentMapping
    parameter_item_ids: List[str]
    valid_parameter_item_ids: List[str]
    parameter_item_mapping: ParameterItemMapping


class DocumentDetailBulkRequest(BaseModel):
    """Request to get bulk document details."""

    documentIds: List[str]
    profileId: str


class DocumentDetailBulkResponse(BaseModel):
    """Bulk document detail response."""

    document_type_options: List[str]
    type: Optional[str]  # Common type if all same, else None
    department_ids: List[str]  # Union of all department_ids
    valid_department_ids: List[str]
    department_mapping: DepartmentMapping
    parameter_item_ids: List[str]  # Union of all parameter_item_ids
    valid_parameter_item_ids: List[str]
    parameter_item_mapping: ParameterItemMapping


class UpdateDocumentRequest(BaseModel):
    """Request to update a document."""

    documentId: str
    type: str
    department_id: str
    parameter_item_ids: List[str]

    # TODO: Update document_parameter_items table when this endpoint is called
    # Currently just accepting parameter_item_ids but not storing the relationship


class BulkUpdateDocumentsRequest(BaseModel):
    """Request to bulk update documents."""

    documentIds: List[str]
    type: str
    department_id: str
    parameter_item_ids: List[str]

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

    documentIds: List[str]


class DeleteDocumentResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


# Upload/Download Schemas
class FinalizeUploadRequest(BaseModel):
    """Request to finalize a TUS upload."""

    fileId: str
    zip: Optional[bool] = False
    autoClassify: Optional[bool] = False
    csv: Optional[bool] = False
    test: Optional[bool] = False
    profile_id: Optional[str] = None
    department_id: Optional[str] = None


class FinalizeUploadResponse(BaseModel):
    """Response from finalizing an upload."""

    success: bool
    message: str
    status: str
    document_id: Optional[str] = None
    documents: Optional[List[Dict[str, Any]]] = None
    users_created: Optional[int] = None
    users_skipped: Optional[int] = None
    errors: Optional[List[str]] = None
    created_users: Optional[List[Dict[str, Any]]] = None
    skipped_users: Optional[List[Dict[str, Any]]] = None


# Certificate Schemas
class GenerateCertificateRequest(BaseModel):
    """Request to generate a certificate."""

    profileId: str
    profileName: str
    cohortData: List[Dict[str, Any]] = []

