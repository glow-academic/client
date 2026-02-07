"""Setting artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="setting",
    plural_name="settings",
    table_name="setting_artifact",
    junction_prefix="setting",
    fk_pattern="setting_%",
    api_routing={
        "base_path": "/api/v4/settings",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single setting by ID",
                "request_model": "GetSettingApiRequest",
                "response_model": "GetSettingApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a setting",
                "request_model": "SaveSettingApiRequest",
                "response_model": "SaveSettingApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List settings with optional filters",
                "request_model": "GetSettingsListApiRequest",
                "response_model": "GetSettingsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing setting",
                "request_model": "DuplicateSettingApiRequest",
                "response_model": "DuplicateSettingApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a setting",
                "request_model": "DeleteSettingApiRequest",
                "response_model": "DeleteSettingApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a setting draft (autosave)",
                "request_model": "PatchSettingDraftApiRequest",
                "response_model": "PatchSettingDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Settings represent system-wide configuration options in GLOW. They control AI providers, authentication, API keys, departments, and themes.",
        "use_cases": [
            "Configuring AI provider settings",
            "Managing authentication method configurations",
            "Setting up API keys for external services",
            "Organizing settings by department",
            "Configuring theme and color settings",
        ],
        "related_concepts": [
            "Providers - Settings can be linked to providers for AI service configuration",
            "Auths - Settings can be linked to authentication configurations",
            "Keys - Settings can be linked to API keys",
            "Departments - Settings can be linked to departments",
            "Resources - Settings use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_settings_docs() -> dict[str, Any]:
    """Get setting documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
