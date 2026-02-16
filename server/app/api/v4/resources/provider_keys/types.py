"""Canonical provider_keys resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ProviderKeysResourceData(BaseModel):
    """Canonical provider_keys resource fields. All optional for streaming support."""

    id: str | None = None
    provider_id: str | None = None
    key_id: str | None = None
    provider_name: str | None = None
    key_name: str | None = None
    key_description: str | None = None
    active: bool | None = None
    generated: bool | None = None
