"""Profile artifact documentation."""

from typing import Any

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="profile",
    plural_name="profiles",
    table_name="profile_artifact",
    junction_prefix="profile",
    fk_pattern="profile_%",
    api_routing={
        "base_path": "/api/v4/profiles",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single profile by ID",
                "request_model": "GetProfileApiRequest",
                "response_model": "GetProfileApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a profile",
                "request_model": "SaveProfileApiRequest",
                "response_model": "SaveProfileApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List profiles with optional filters",
                "request_model": "GetProfilesListApiRequest",
                "response_model": "GetProfilesListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing profile",
                "request_model": "DuplicateProfileApiRequest",
                "response_model": "DuplicateProfileApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a profile",
                "request_model": "DeleteProfileApiRequest",
                "response_model": "DeleteProfileApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a profile draft (autosave)",
                "request_model": "PatchProfileDraftApiRequest",
                "response_model": "PatchProfileDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Profiles represent user profiles in GLOW. They contain user identity, roles, and department associations.",
        "use_cases": [
            "Managing user identity and roles",
            "Associating users with departments",
            "Tracking user settings and preferences",
        ],
        "related_concepts": [
            "Departments - Profiles are associated with departments",
            "Roles - Profiles have role-based access control",
            "Resources - Profiles use multiple resource types for rich representation",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_profiles_docs() -> dict[str, Any]:
    """Get profile documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
