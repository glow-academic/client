"""Canonical profiles resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ProfilesResourceData(BaseModel):
    """Canonical profiles resource fields. All optional for streaming support."""

    profile_id: str | None = None
    name: str | None = None
    description: str | None = None
    emails: list[str] | None = None
    primary_email: str | None = None
