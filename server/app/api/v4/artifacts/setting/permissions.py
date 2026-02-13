"""Settings permissions and UI flag rules.

Extracts business logic from SQL into Python for the two-pass architecture.
These functions compute permissions, UI flags, and access control based on
data fetched from the Pass 1 SQL query.
"""

from uuid import UUID

SETTING_RESOURCES = {
    "names",
    "descriptions",
    "colors",
    "flags",
    "departments",
    "profiles",
    "auths",
    "provider_keys",
    "auth_item_keys",
    "roles",
    "role_routes",
}

SETTING_GENERATION_RESOURCES = {
    "names",
    "descriptions",
    "colors",
    "flags",
    "departments",
}


def has_access(
    user_role: str | None,
    user_department_ids: list[UUID],
    setting_department_ids: list[UUID],
) -> bool:
    if user_role == "superadmin":
        return True
    if not setting_department_ids:
        return True
    return bool(set(user_department_ids) & set(setting_department_ids))


def compute_can_edit(
    user_role: str | None,
    user_department_ids: list[UUID],
    setting_department_ids: list[UUID],
) -> bool:
    return has_access(user_role, user_department_ids, setting_department_ids)


def compute_disabled_reason(
    user_role: str | None,
    user_department_ids: list[UUID],
    setting_department_ids: list[UUID],
) -> str | None:
    if compute_can_edit(user_role, user_department_ids, setting_department_ids):
        return None
    return "You don't have access to edit this setting."


def compute_show_name() -> bool:
    return True


def compute_show_description() -> bool:
    return True


def compute_show_colors(colors_count: int) -> bool:
    return colors_count > 0


def compute_show_flag() -> bool:
    return True


def compute_show_departments(departments_count: int) -> bool:
    return departments_count > 0


def compute_show_profiles() -> bool:
    return True


def compute_show_auths() -> bool:
    return True


def compute_show_provider_keys() -> bool:
    return True


def compute_show_auth_item_keys() -> bool:
    return True


def compute_show_roles() -> bool:
    return True


def compute_show_role_routes() -> bool:
    return True


def compute_name_required() -> bool:
    return True


def compute_description_required() -> bool:
    return False


def compute_colors_required() -> bool:
    return True


def compute_flag_required() -> bool:
    return False


def compute_departments_required(show_departments: bool) -> bool:
    return show_departments


def compute_profiles_required() -> bool:
    return False


def compute_auths_required() -> bool:
    return False


def compute_provider_keys_required() -> bool:
    return False


def compute_auth_item_keys_required() -> bool:
    return False


def compute_roles_required() -> bool:
    return False


def compute_role_routes_required() -> bool:
    return False


# ========== AI generation flags ==========


def compute_show_ai_generate(agent_ids: dict[str, UUID | None], resource: str) -> bool:
    """Returns True if an agent exists for that resource."""
    return agent_ids.get(resource) is not None


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'setting_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("setting_", "")
    label = key.replace("_", " ").title()
    return (key, label)


# ========== Delete / Duplicate ==========


def compute_can_delete(
    user_role: str | None,
    user_department_ids: list[UUID],
    setting_department_ids: list[UUID],
) -> bool:
    """Settings can only be deleted by users with access."""
    return has_access(user_role, user_department_ids, setting_department_ids)


def compute_can_duplicate(user_role: str | None) -> bool:
    """Any authenticated user can duplicate a setting."""
    return user_role is not None


def compute_can_draft(user_role: str | None) -> bool:
    """Any authenticated user can create or edit drafts."""
    return user_role is not None
