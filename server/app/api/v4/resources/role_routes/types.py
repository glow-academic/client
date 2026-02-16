"""Canonical role_routes resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RoleRoutesResourceData(BaseModel):
    """Canonical role_routes resource fields. All optional for streaming support."""

    id: str | None = None
    role_id: str | None = None
    route_id: str | None = None
    generated: bool | None = None
