"""Model permission helpers.

Extracts business logic from SQL into Python for the two-pass architecture.
These functions compute permissions, UI flags, and access control based on
data fetched from the Pass 1 SQL query.
"""

from uuid import UUID

from app.api.v4.permissions import (
    select_agents_for_artifact,
    select_multi_resource_agent,
)
from app.api.v4.types import CandidateAgent

# Re-export for backwards compatibility
__all__ = [
    "CandidateAgent",
    "select_agents_for_artifact",
    "select_multi_resource_agent",
    "MODEL_RESOURCES",
    "MODEL_BASIC_RESOURCES",
    "MODEL_PROVIDER_RESOURCES",
    "MODEL_FEATURES_RESOURCES",
]


def compute_can_edit(
    user_role: str | None,
    model_department_ids: list[str] | list[UUID] | None,
    active_persona_count: int,
) -> bool:
    """Unified can_edit logic for both get and list views.

    Constraints:
    1. Not a default model (unless superadmin)
    2. Not linked to active personas
    3. User has admin/instructional/superadmin role
    """
    # Default models can only be edited by superadmin
    if not model_department_ids and user_role != "superadmin":
        return False

    # Models in use by personas cannot be edited
    if active_persona_count > 0:
        return False

    # Role check
    return user_role in ("admin", "instructional", "superadmin")


def compute_disabled_reason(
    user_role: str | None,
    model_department_ids: list[str] | list[UUID] | None,
    active_persona_count: int,
) -> str | None:
    """Compute the reason why editing is disabled, if any.

    Returns None if editing is allowed.
    """
    # Default models can only be edited by superadmin
    if not model_department_ids and user_role != "superadmin":
        return (
            "This is a default model that cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Models in use by personas cannot be edited
    if active_persona_count > 0:
        return (
            "This model is currently in use by personas and cannot be edited. "
            "You can view the details but cannot make changes."
        )

    # Role check
    if user_role not in ("admin", "instructional", "superadmin"):
        return (
            "This model cannot be edited. "
            "You can view the details but cannot make changes."
        )

    return None


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID] | None,
    model_department_ids: list[UUID] | None,
) -> bool:
    """Check if user has access to view the model.

    Access rules:
    - Superadmin has access to all models
    - User has access if model has no departments (default model)
    - User has access if they share at least one department with the model
    """
    if user_role == "superadmin":
        return True

    # Default models (no departments) are accessible to all
    if not model_department_ids:
        return True

    # Check department overlap
    if not user_department_ids:
        return False

    user_dept_set = set(user_department_ids)
    model_dept_set = set(model_department_ids)
    return bool(user_dept_set & model_dept_set)


# ========== Show/Required Functions ==========


def compute_show_name(names_has_tools: bool) -> bool:
    """Determine if name picker should be shown."""
    return names_has_tools


def compute_show_description() -> bool:
    """Determine if description picker should be shown."""
    return True


def compute_show_flag() -> bool:
    """Determine if flag toggle should be shown."""
    return True


def compute_show_value(values_has_tools: bool) -> bool:
    """Determine if value picker should be shown."""
    return values_has_tools


def compute_show_endpoint(endpoints_has_tools: bool) -> bool:
    """Determine if endpoint picker should be shown."""
    return endpoints_has_tools


def compute_show_provider() -> bool:
    """Determine if provider picker should be shown."""
    return True


def compute_show_key() -> bool:
    """Determine if key picker should be shown."""
    return True


def compute_show_departments(departments_count: int) -> bool:
    """Determine if departments picker should be shown."""
    return departments_count > 0


def compute_show_modalities() -> bool:
    """Determine if modalities picker should be shown."""
    return True


def compute_show_temperature_levels() -> bool:
    """Determine if temperature levels picker should be shown."""
    return True


def compute_show_pricing() -> bool:
    """Determine if pricing picker should be shown."""
    return True


def compute_show_reasoning_levels() -> bool:
    """Determine if reasoning levels picker should be shown."""
    return True


def compute_show_qualities() -> bool:
    """Determine if qualities picker should be shown."""
    return True


def compute_show_voices() -> bool:
    """Determine if voices picker should be shown."""
    return True


def compute_name_required() -> bool:
    """Determine if name is required."""
    return True


def compute_description_required() -> bool:
    """Determine if description is required."""
    return False


def compute_flag_required() -> bool:
    """Determine if flag is required."""
    return False


def compute_value_required() -> bool:
    """Determine if value is required."""
    return True


def compute_endpoint_required() -> bool:
    """Determine if endpoint is required."""
    return True


def compute_provider_required() -> bool:
    """Determine if provider is required."""
    return True


def compute_key_required() -> bool:
    """Determine if key is required."""
    return False


def compute_departments_required() -> bool:
    """Determine if departments is required."""
    return False


def compute_modalities_required() -> bool:
    """Determine if modalities is required."""
    return False


def compute_temperature_levels_required() -> bool:
    """Determine if temperature levels is required."""
    return False


def compute_pricing_required() -> bool:
    """Determine if pricing is required."""
    return False


def compute_reasoning_levels_required() -> bool:
    """Determine if reasoning levels is required."""
    return False


def compute_qualities_required() -> bool:
    """Determine if qualities is required."""
    return False


def compute_voices_required() -> bool:
    """Determine if voices is required."""
    return False


# ========== List Endpoint Permission Functions ==========


def compute_can_delete(
    user_role: str | None,
    model_department_ids: list[str] | None,
    total_persona_links: int,
    agents_usage_count: int,
) -> bool:
    """Compute can_delete permission.

    Business logic:
    - Default models (no departments) cannot be deleted except by superadmin
    - Models linked to ANY persona cannot be deleted
    - Models linked to ANY agent cannot be deleted
    - Only admins, instructional, and superadmins can delete
    """
    # Default models can only be deleted by superadmin
    if not model_department_ids and user_role != "superadmin":
        return False

    # Models with persona links cannot be deleted
    if total_persona_links > 0:
        return False

    # Models with agent links cannot be deleted
    if agents_usage_count > 0:
        return False

    # Only admins, instructional, and superadmins can delete
    return user_role in ("admin", "instructional", "superadmin")


def compute_can_duplicate(user_role: str | None) -> bool:
    """Compute can_duplicate permission."""
    return user_role in ("admin", "instructional", "superadmin")


# ========== Save/Create Endpoint Permission Functions ==========


def compute_can_create(
    user_role: str | None,
    department_ids: list[str] | list[UUID] | None,
) -> bool:
    """Compute permission to create a new model.

    Business logic:
    - Non-superadmins cannot create general objects (empty department_ids)
    - Only admin/instructional/superadmin can create models
    """
    # Role check first
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    # Non-superadmins cannot create general objects (no departments)
    if user_role != "superadmin" and not department_ids:
        return False

    return True


def compute_can_save(
    user_role: str | None,
    user_department_ids: list[str] | list[UUID] | None,
    model_department_ids: list[str] | list[UUID] | None,
    active_persona_count: int,
) -> bool:
    """Compute permission to save/update an existing model.

    Business logic:
    - Not a default model (unless superadmin)
    - Not linked to active personas
    - User has admin/instructional/superadmin role
    - Non-superadmins must belong to ALL of the model's departments
    """
    # Role check first
    if user_role not in ("admin", "instructional", "superadmin"):
        return False

    # Default models can only be edited by superadmin
    if not model_department_ids and user_role != "superadmin":
        return False

    # Models in use by active personas cannot be edited
    if active_persona_count > 0:
        return False

    # Non-superadmins must belong to ALL of the model's departments
    if user_role != "superadmin" and model_department_ids:
        if not user_department_ids:
            return False
        # Convert to sets of strings for comparison
        user_dept_set = {str(d) for d in user_department_ids}
        model_dept_set = {str(d) for d in model_department_ids}
        # User must have ALL model departments
        if not model_dept_set.issubset(user_dept_set):
            return False

    return True


# ========== Draft Endpoint Permission Functions ==========


def compute_can_draft(user_role: str | None) -> bool:
    """Compute permission to create or update a draft."""
    return user_role in ("admin", "instructional", "superadmin")


# ========== Agent Scoring - Model-specific Constants ==========

# Model-specific resource definitions
MODEL_RESOURCES: set[str] = {
    "names",
    "descriptions",
    "values",
    "endpoints",
    "providers",
    "keys",
    "flags",
    "departments",
    "modalities",
    "temperature_levels",
    "pricing",
    "reasoning_levels",
    "qualities",
    "voices",
}

# Multi-resource agent definitions for model
MODEL_BASIC_RESOURCES: set[str] = {"names", "descriptions", "flags", "departments"}
MODEL_PROVIDER_RESOURCES: set[str] = {"values", "endpoints", "providers", "keys"}
MODEL_FEATURES_RESOURCES: set[str] = {
    "modalities",
    "temperature_levels",
    "pricing",
    "reasoning_levels",
    "qualities",
    "voices",
}
MODEL_GENERAL_RESOURCES: set[str] = MODEL_RESOURCES  # All resources


# ========== Domain Metadata - for client-side display in modals ==========

MODEL_DOMAIN_METADATA: dict[str, dict[str, str | bool]] = {
    "names": {
        "name": "Name",
        "description": "The display name for this model",
        "icon": "type",
    },
    "descriptions": {
        "name": "Description",
        "description": "A brief description of this model",
        "icon": "file-text",
    },
    "values": {
        "name": "Value",
        "description": "The model identifier value (e.g., gpt-4, claude-3)",
        "icon": "code",
    },
    "endpoints": {
        "name": "Endpoint",
        "description": "The API endpoint URL for this model",
        "icon": "link",
    },
    "providers": {
        "name": "Provider",
        "description": "The AI provider for this model",
        "icon": "building",
    },
    "keys": {
        "name": "API Key",
        "description": "The API key used to authenticate with the provider",
        "icon": "key",
    },
    "flags": {
        "name": "Status",
        "description": "Active/inactive status and feature toggles",
        "icon": "flag",
    },
    "departments": {
        "name": "Departments",
        "description": "Which departments can access this model",
        "icon": "building",
    },
    "modalities": {
        "name": "Modalities",
        "description": "Input and output modalities supported by this model",
        "icon": "layers",
    },
    "temperature_levels": {
        "name": "Temperature",
        "description": "Temperature settings for this model",
        "icon": "thermometer",
    },
    "pricing": {
        "name": "Pricing",
        "description": "Pricing configuration for this model",
        "icon": "dollar-sign",
    },
    "reasoning_levels": {
        "name": "Reasoning",
        "description": "Reasoning effort levels for this model",
        "icon": "brain",
    },
    "qualities": {
        "name": "Quality",
        "description": "Quality levels for this model",
        "icon": "star",
    },
    "voices": {
        "name": "Voices",
        "description": "Voice options for this model",
        "icon": "mic",
    },
}


def build_domain_data(
    domain_ids: dict[str, UUID | None],
    show_flags: dict[str, bool],
    required_flags: dict[str, bool],
) -> list:
    """Build rich domain metadata for client display.

    Delegates to shared build_domain_data with model-specific metadata.
    """
    from app.api.v4.types import build_domain_data as _build_domain_data

    return _build_domain_data(
        domain_ids, show_flags, required_flags, MODEL_DOMAIN_METADATA
    )
