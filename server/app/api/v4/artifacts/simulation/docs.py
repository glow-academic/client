"""Simulation artifact documentation."""

from typing import Any

from app.api.v4.artifacts.simulation import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="simulation",
    plural_name="simulations",
    table_name="simulation_artifact",
    junction_prefix="simulation",
    fk_pattern="simulation_%",
    permissions_module=permissions,
    permission_functions=[
        "has_access",
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_save",
        "compute_can_draft",
    ],
    api_routing={
        "base_path": "/api/v4/simulations",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single simulation by ID",
                "request_model": "GetSimulationApiRequest",
                "response_model": "GetSimulationApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a simulation",
                "request_model": "SaveSimulationApiRequest",
                "response_model": "SaveSimulationApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List simulations with optional filters",
                "request_model": "GetSimulationsListApiRequest",
                "response_model": "GetSimulationsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing simulation",
                "request_model": "DuplicateSimulationApiRequest",
                "response_model": "DuplicateSimulationApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a simulation",
                "request_model": "DeleteSimulationApiRequest",
                "response_model": "DeleteSimulationApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a simulation draft (autosave)",
                "request_model": "PatchSimulationDraftApiRequest",
                "response_model": "PatchSimulationDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Simulations represent collections of scenarios used in GLOW for comprehensive simulation-based learning experiences.",
        "use_cases": [
            "Creating comprehensive learning experiences",
            "Grouping multiple scenarios together",
            "Organizing simulations by department",
        ],
        "related_concepts": [
            "Scenarios - Simulations contain multiple scenarios",
            "Resources - Simulations use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_simulations_docs() -> dict[str, Any]:
    """Get simulation documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
