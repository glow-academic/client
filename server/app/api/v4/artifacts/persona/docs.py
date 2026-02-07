"""Persona artifact documentation."""

from typing import Any

from app.api.v4.artifacts.persona import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="persona",
    plural_name="personas",
    table_name="persona_artifact",
    junction_prefix="persona",
    fk_pattern="persona_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_save",
        "compute_can_draft",
        "has_access",
    ],
    api_routing={
        "base_path": "/api/v4/personas",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single persona by ID",
                "request_model": "GetPersonaApiRequest",
                "response_model": "GetPersonaApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a persona",
                "request_model": "SavePersonaApiRequest",
                "response_model": "SavePersonaApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List personas with optional filters",
                "request_model": "GetPersonasListApiRequest",
                "response_model": "GetPersonasListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing persona",
                "request_model": "DuplicatePersonaApiRequest",
                "response_model": "DuplicatePersonaApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a persona",
                "request_model": "DeletePersonaApiRequest",
                "response_model": "DeletePersonaApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a persona draft (autosave)",
                "request_model": "PatchPersonaDraftApiRequest",
                "response_model": "PatchPersonaDraftApiResponse",
            },
            "docs": {
                "path": "/docs",
                "method": "POST",
                "description": "Get comprehensive persona documentation",
            },
        },
    },
    glow_context={
        "description": (
            "Personas represent AI characters used in scenarios to provide "
            "different perspectives, roles, or personalities. They are central "
            "to GLOW's simulation and practice features, allowing students to "
            "interact with various AI characters in realistic scenarios."
        ),
        "use_cases": [
            "Creating AI characters for scenario-based learning",
            "Defining different roles in simulations (e.g., patient, doctor, administrator)",
            "Customizing AI behavior through instructions and examples",
            "Organizing personas by department or field",
            "Using personas in messages and model runs for consistent character representation",
        ],
        "related_concepts": [
            "Scenarios - Personas are assigned to scenarios to define available characters",
            "Messages - Messages can be associated with personas to indicate which character is speaking",
            "Runs - Model runs reference personas to track which character generated responses",
            "Parameters - Personas can be linked to parameters for configuration",
            "Resources - Personas use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_personas_docs() -> dict[str, Any]:
    """Get persona documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
