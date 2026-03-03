"""Setting artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="setting",
    plural_name="settings",
    table_name="setting_artifact",
    junction_prefix="setting",
    fk_pattern="setting_%",
    api_routing={
        "base_path": "/api/v5/settings",
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
    page_metadata=PageMetadataConfig(
        list_title="Settings",
        list_description="Manage platform settings and configuration for teaching assistant training. Configure system-wide settings, preferences, and platform behavior.",
        detail_title="Setting",
        detail_description="Platform setting configuration for teaching assistant training. Manage system-wide preferences and behavior.",
        new_title="New Setting",
        new_description="Create a new platform setting for teaching assistant training. Configure system-wide settings and preferences.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_setting_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_settings_docs() -> dict[str, Any]:
    """Get setting documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
