"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/profile/get_profile_context_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetProfileContextSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/profile/get_profile_context_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetProfileContextSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    is_authorized: bool
    actual_id: str
    actual_first_name: str
    actual_last_name: str
    actual_emails: list[str]
    actual_primary_email: str
    actual_role: str
    actual_active: bool
    actual_req_per_day: int
    actual_last_login: str
    actual_last_active: str
    actual_created_at: str
    actual_updated_at: str
    actual_primary_department_id: str
    id: str
    first_name: str
    last_name: str
    emails: list[str]
    primary_email: str
    role: str
    active: bool
    req_per_day: int
    last_login: str
    last_active: str
    created_at: str
    updated_at: str
    primary_department_id: str
    departments: dict[str, Any]
    cohorts: dict[str, Any]
    simulations: dict[str, Any]
    earliest_attempt_date: str
    scoped_roles: Any
    settings_id: str
    settings_created_at: str
    settings_active: bool
    settings_name: str
    settings_description: str
    settings_primary_color: str
    settings_accent: str
    settings_background: str
    settings_surface: str
    settings_success: str
    settings_warning: str
    settings_error: str
    settings_sidebar_background: str
    settings_sidebar_primary: str
    settings_chart1: str
    settings_chart2: str
    settings_chart3: str
    settings_chart4: str
    settings_chart5: str
    settings_guest_login_enabled: bool
    settings_success_threshold: int
    settings_warning_threshold: int
    settings_danger_threshold: int
    settings_auth_ids: list[str]
    settings_auth_mapping: dict[str, Any]
    settings_provider_ids: list[str]
    settings_provider_mapping: dict[str, Any]
    settings_default_guest_profile_id: str
    settings_default_account_profile_id: str
