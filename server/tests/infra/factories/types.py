"""Shared return types for infra test factories."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ProfileIdentityFixture:
    artifact_id: UUID
    profile_resource_id: UUID
    name: str | None
    role: str | None
    role_name: str | None
    role_description: str | None
    role_artifacts: list[str]
    departments: list[str]
    emails: list[str]
