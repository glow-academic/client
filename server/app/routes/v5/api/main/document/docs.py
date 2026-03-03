"""Document artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.infra.globals import get_db
from app.routes.v5.tools.resources.names.get import get_names_internal
from app.sql.types import GetDocumentDocsSqlParams, GetDocumentDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/documents/get_document_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="document",
    plural_name="documents",
    table_name="document_artifact",
    junction_prefix="document",
    fk_pattern="document_%",
    api_routing={
        "base_path": "/api/v5/documents",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single document by ID",
                "request_model": "GetDocumentApiRequest",
                "response_model": "GetDocumentApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a document",
                "request_model": "SaveDocumentApiRequest",
                "response_model": "SaveDocumentApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List documents with optional filters",
                "request_model": "GetDocumentsListApiRequest",
                "response_model": "GetDocumentsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing document",
                "request_model": "DuplicateDocumentApiRequest",
                "response_model": "DuplicateDocumentApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a document",
                "request_model": "DeleteDocumentApiRequest",
                "response_model": "DeleteDocumentApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a document draft (autosave)",
                "request_model": "PatchDocumentDraftApiRequest",
                "response_model": "PatchDocumentDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Documents represent files and templates used in GLOW for various purposes including certificates, forms, and scenario materials. They can be linked to scenarios and used in document generation workflows.",
        "use_cases": [
            "Creating document templates for certificates and forms",
            "Uploading and managing document files",
            "Linking documents to scenarios for use in simulations",
            "Organizing documents by department",
            "Using documents in document generation workflows",
        ],
        "related_concepts": [
            "Scenarios - Documents can be assigned to scenarios",
            "Templates - Documents can be templates for generation",
            "Uploads - Documents are linked to uploaded files",
            "Drafts - Documents support draft autosave functionality",
            "Resources - Documents use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Documents",
        list_description="Manage learning resources and educational documents for teaching assistant training. Organize course materials, instructional resources, and reference documents to support pedagogical development and L&D program content.",
        detail_title="Document",
        detail_description="Learning resource and educational document for teaching assistant training. Access course materials, instructional resources, and reference documents to support pedagogical development.",
        new_title="New Document",
        new_description="Upload new learning resources and educational documents for teaching assistant training. Add course materials, instructional resources, and reference documents to support pedagogical development and L&D program content.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_document_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetDocumentDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetDocumentDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_documents_docs() -> dict[str, Any]:
    """Get document documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
