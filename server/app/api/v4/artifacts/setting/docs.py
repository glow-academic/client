"""Setting artifact documentation."""

from typing import Any


def get_settings_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the setting artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "settings",
        "type": "artifact",
        "database": {
            "table": "setting_artifact",
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
                {"name": "setting_artifact_pkey", "type": "PRIMARY KEY", "columns": ["id"]}
            ],
            "foreign_keys": [],
        },
        "relationships": {
            "has_resources": [
                "names",
                "descriptions",
                "flags",
            ],
            "junction_tables": [
                "setting_names",
                "setting_descriptions",
                "setting_flags",
                "setting_providers",
                "setting_auths",
                "setting_keys",
                "setting_departments",
            ],
            "related_artifacts": [
                {
                    "artifact": "providers",
                    "junction_table": "setting_providers",
                    "description": "Settings can be linked to providers",
                },
                {
                    "artifact": "auths",
                    "junction_table": "setting_auths",
                    "description": "Settings can be linked to auth configurations",
                },
                {
                    "artifact": "keys",
                    "junction_table": "setting_keys",
                    "description": "Settings can be linked to API keys",
                },
                {
                    "artifact": "departments",
                    "junction_table": "setting_departments",
                    "description": "Settings can be linked to departments",
                },
            ],
        },
        "api_routing": {
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
        "resources": {
            "available": [
                {
                    "name": "names",
                    "endpoint": "/api/v4/resources/names",
                    "create_only": True,
                    "description": "Name resources for settings - single name per setting",
                    "junction_table": "setting_names",
                },
                {
                    "name": "descriptions",
                    "endpoint": "/api/v4/resources/descriptions",
                    "create_only": True,
                    "description": "Description resources for settings - single description per setting",
                    "junction_table": "setting_descriptions",
                },
                {
                    "name": "flags",
                    "endpoint": "/api/v4/resources/flags",
                    "create_only": True,
                    "description": "Flag resources for settings - boolean flags with types",
                    "junction_table": "setting_flags",
                    "note": "Uses type_setting_flags enum for flag types (active, guest_login_enabled)",
                },
            ]
        },
        "frontend": {
            "components": [
                "client/components/settings/Settings.tsx",
                "client/components/settings/Setting.tsx",
                "client/components/settings/NewSetting.tsx",
                "client/components/settings/SettingsBasicInfoSection.tsx",
                "client/components/settings/SettingsAIProvidersSection.tsx",
                "client/components/settings/SettingsAIProviderConfigSection.tsx",
                "client/components/settings/SettingsAuthMethodsSection.tsx",
                "client/components/settings/SettingsAuthMethodConfigSection.tsx",
                "client/components/settings/SettingsKeySelectionSection.tsx",
                "client/components/settings/SettingsKeyPicker.tsx",
                "client/components/settings/SettingsDefaultAccountSection.tsx",
                "client/components/settings/SettingsLayoutColorsSection.tsx",
                "client/components/settings/SettingsBrandColorsSection.tsx",
                "client/components/settings/SettingsChartColorsSection.tsx",
                "client/components/settings/SettingsStatusColorsSection.tsx",
                "client/components/settings/SettingsSidebarColorsSection.tsx",
                "client/components/settings/SettingsThemePresetPicker.tsx",
                "client/components/settings/ThemePreview.tsx",
                "client/components/common/settings/ProvidersTable.tsx",
                "client/components/common/settings/AuthsTable.tsx",
            ],
            "pages": [
                "client/app/(main)/settings/page.tsx",
            ],
            "usage_patterns": "Settings are created and edited through the settings page. Users can assign resources (names, descriptions, flags) to settings. Settings are used to configure system-wide options including AI providers, authentication methods, keys, departments, and theme colors.",
        },
        "glow_context": {
            "description": "Settings represent system-wide configuration options in GLOW. They control various aspects of the system including AI provider configurations, authentication methods, API keys, department associations, and theme/color settings.",
            "use_cases": [
                "Configuring AI provider settings",
                "Managing authentication method configurations",
                "Setting up API keys for external services",
                "Organizing settings by department",
                "Configuring theme and color settings",
                "Managing system-wide defaults",
            ],
            "related_concepts": [
                "Providers - Settings can be linked to providers for AI service configuration",
                "Auths - Settings can be linked to authentication configurations",
                "Keys - Settings can be linked to API keys",
                "Departments - Settings can be linked to departments",
                "Drafts - Settings support draft autosave functionality",
                "Resources - Settings use multiple resource types (names, descriptions, flags) for rich representation",
            ],
            "generation": {
                "available": True,
                "endpoint": "/socket/v4/settings/generate",
                "resource_types": [
                    "names",
                    "descriptions",
                    "flags",
                ],
                "description": "Settings support AI generation for all resource types via WebSocket",
            },
        },
    }
