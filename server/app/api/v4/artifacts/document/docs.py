"""Document artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="document",
    plural_name="documents",
    table_name="document_artifact",
    junction_prefix="document",
    fk_pattern="document_%",
    api_routing={
        "base_path": "/api/v4/documents",
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
)

router = create_artifact_docs_router(CONFIG)


def get_documents_docs() -> dict[str, Any]:
    """Get document documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
