"""Settings permissions and UI flag rules."""

from uuid import UUID

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
