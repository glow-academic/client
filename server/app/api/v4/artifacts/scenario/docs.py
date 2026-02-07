"""Scenario artifact documentation."""

from typing import Any

from app.api.v4.artifacts.scenario import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="scenario",
    plural_name="scenarios",
    table_name="scenario_artifact",
    junction_prefix="scenario",
    fk_pattern="scenario_%",
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
        "base_path": "/api/v4/scenarios",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single scenario by ID",
                "request_model": "GetScenarioApiRequest",
                "response_model": "GetScenarioApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a scenario",
                "request_model": "SaveScenarioApiRequest",
                "response_model": "SaveScenarioApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List scenarios with optional filters",
                "request_model": "GetScenariosListApiRequest",
                "response_model": "GetScenariosListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing scenario",
                "request_model": "DuplicateScenarioApiRequest",
                "response_model": "DuplicateScenarioApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a scenario",
                "request_model": "DeleteScenarioApiRequest",
                "response_model": "DeleteScenarioApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a scenario draft (autosave)",
                "request_model": "PatchScenarioDraftApiRequest",
                "response_model": "PatchScenarioDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": (
            "Scenarios represent interactive learning situations used in GLOW for "
            "simulation-based learning. They combine personas, documents, parameters, "
            "and other resources to create rich learning experiences."
        ),
        "use_cases": [
            "Creating interactive learning situations",
            "Combining personas, documents, and parameters",
            "Defining learning objectives and problem statements",
            "Organizing scenarios by department",
        ],
        "related_concepts": [
            "Simulations - Scenarios can be assigned to simulations",
            "Personas - Scenarios can include multiple personas",
            "Documents - Scenarios can include documents",
            "Parameters - Scenarios can include parameters",
            "Resources - Scenarios use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_scenarios_docs() -> dict[str, Any]:
    """Get scenario documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
