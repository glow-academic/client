"""Canonical auths resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class AuthsResourceData(BaseModel):
    """Canonical auths resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    slug: str | None = None
    protocol: str | None = None
    generated: bool | None = None
