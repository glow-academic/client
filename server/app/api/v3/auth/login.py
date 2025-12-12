"""Auth login endpoint - returns list of active provider options and departments."""

import json
from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.main import get_db
from app.utils.sql_helper import load_sql


class ProviderOption(BaseModel):
    """Provider option with id (slug), name, and icon URL."""

    id: str  # The slug (e.g., 'microsoft', 'google', 'purdue')
    name: str  # The display name (e.g., 'Microsoft', 'Google', 'Purdue University')
    icon: str | None  # The icon URL (can be None if no icon)
    is_default: bool  # Whether this is a default provider (no department links)


class DepartmentOption(BaseModel):
    """Department option for login page."""

    id: str
    title: str
    description: str


class LoginProvidersRequest(BaseModel):
    """Request for login providers with optional department ID."""

    departmentId: str | None = None


class LoginProvidersResponse(BaseModel):
    """Response with list of active provider options and departments."""

    providers: list[ProviderOption]
    departments: list[DepartmentOption]
    guest_login_enabled: bool
    show_default_account: bool  # Whether to show "continue as default account" button
    default_department_id: (
        str | None
    )  # Default department ID from settings_default_department table


router = APIRouter()


@router.post("/login", response_model=LoginProvidersResponse)
async def get_login_providers(
    request: LoginProvidersRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LoginProvidersResponse:
    """Get list of active auth provider options and departments for login page."""
    department_id = UUID(request.departmentId) if request.departmentId else None
    sql_query = load_sql("sql/v3/auth/get_login_data_complete.sql")
    row = await conn.fetchrow(sql_query, department_id)

    if not row:
        # Return empty response if no data found
        return LoginProvidersResponse(
            providers=[],
            departments=[],
            guest_login_enabled=True,
            show_default_account=False,
            default_department_id=None,
        )

    # Parse JSON fields - asyncpg may return JSON as strings
    def parse_jsonb(data: Any) -> Any:  # noqa: ANN401
        if isinstance(data, str):
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return []
        return data

    # Parse providers JSON - handle empty arrays and null values
    providers_json_raw = row.get("providers_json")
    providers_json = parse_jsonb(providers_json_raw) if providers_json_raw else []
    if not isinstance(providers_json, list):
        providers_json = []

    providers = [
        ProviderOption(
            id=str(p.get("id", "")),
            name=str(p.get("name", "")),
            icon=p.get("icon") if p.get("icon") else None,
            is_default=bool(p.get("is_default", False)),
        )
        for p in providers_json
        if isinstance(p, dict) and p.get("id") and p.get("name")
    ]

    # Parse departments JSON - handle empty arrays and null values
    departments_json_raw = row.get("departments_json")
    departments_json = parse_jsonb(departments_json_raw) if departments_json_raw else []
    if not isinstance(departments_json, list):
        departments_json = []

    departments = [
        DepartmentOption(
            id=str(d.get("id", "")),
            title=str(d.get("title", "")),
            description=str(d.get("description", "")),
        )
        for d in departments_json
        if isinstance(d, dict) and d.get("id") and d.get("title")
    ]

    # Get guest_login_enabled with fallback
    guest_login_enabled = bool(row.get("guest_login_enabled", True))

    # Get default department ID from settings
    default_department_id = row.get("default_department_id")
    if default_department_id and isinstance(default_department_id, str):
        default_department_id = default_department_id.strip() or None
    else:
        default_department_id = None

    # Show "continue as default account" if no default providers exist
    has_default_providers = any(p.is_default for p in providers)
    show_default_account = not has_default_providers

    return LoginProvidersResponse(
        providers=providers,
        departments=departments,
        guest_login_enabled=guest_login_enabled,
        show_default_account=show_default_account,
        default_department_id=default_department_id,
    )
