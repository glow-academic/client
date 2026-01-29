"""Document artifact documentation."""

from typing import Any


def get_documents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the document artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "documents",
        "type": "artifact",
        "database": {
            "table": "document_artifact",
            "primary_key": "id",
            "columns": [
                {
                    "name": "id",
                    "type": "uuid",
                    "nullable": False,
                    "default": "uuidv7()",
                    "description": "Primary key, UUID v7",
                },
                {
                    "name": "created_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Creation timestamp",
                },
                {
                    "name": "updated_at",
                    "type": "timestamptz",
                    "nullable": False,
                    "default": "now()",
                    "description": "Last update timestamp",
                },
            ],
            "indexes": [
                {
                    "name": "document_artifact_pkey",
                    "type": "PRIMARY KEY",
                    "columns": ["id"],
                }
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "fields",
                "flags",
                "departments",
            ],
            "junction_tables": [
                "document_names",
                "document_descriptions",
                "document_fields",
                "document_flags",
                "document_departments",
                "document_templates",
                "document_html",
                "document_schemas",
                "document_agent_domains",
                "scenario_documents",
                "draft_documents",
            ],
            "related_artifacts": [
                {
                    "artifact": "scenarios",
                    "junction_table": "scenario_documents",
                    "description": "Documents can be assigned to scenarios",
                },
                {
                    "artifact": "drafts",
                    "junction_table": "draft_documents",
                    "description": "Draft documents for autosave",
                },
            ],
        },
        "api_routing": {
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for documents - single name per document",
                    "junction_table": "document_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for documents - single description per document",
                    "junction_table": "document_descriptions",
                },
                {
                    "name": "fields",
                    "endpoint": "/api/v4/resources/fields",
                    "create_only": True,
                    "description": "Field resources for documents - multiple fields can be assigned",
                    "junction_table": "document_fields",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for documents - boolean flags with types",
                    "junction_table": "document_flags",
                    "note": "Uses type_document_flags enum for flag types (active, template)",
                },
                {
                    "name": "departments",
                    "endpoint": "/api/v4/resources/departments",
                    "create_only": True,
                    "description": "Department resources for documents - department associations",
                    "junction_table": "document_departments",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/documents/Documents.tsx",
                "client/components/documents/Document.tsx",
                "client/components/documents/NewDocument.tsx",
                "client/components/documents/DocumentBasicInfoSection.tsx",
                "client/components/documents/DocumentFieldsSection.tsx",
                "client/components/documents/TemplateForm.tsx",
                "client/components/documents/TemplatePreview.tsx",
                "client/components/documents/UploadClassificationDialog.tsx",
            ],
            "pages": [
                "client/app/(main)/management/documents/page.tsx",
                "client/app/(main)/management/documents/new/page.tsx",
                "client/app/(main)/management/documents/d/[documentId]/page.tsx",
            ],
            "usage_patterns": "Documents are created and edited through the management/documents pages. Users can assign multiple resources (names, descriptions, fields, flags, departments) to documents. Documents can be templates and are used in scenarios.",
        },
        "glow_context": {
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
                "Resources - Documents use multiple resource types (names, descriptions, fields, flags, departments) for rich representation",
            ],
            "generation": {
                "available": True,
                "endpoint": "/socket/v4/documents/generate",
                "resource_types": [
                    "names",
                    "descriptions",
                    "fields",
                    "flags",
                    "departments",
                ],
                "description": "Documents support AI generation for all resource types via WebSocket",
            },
        },
    }
