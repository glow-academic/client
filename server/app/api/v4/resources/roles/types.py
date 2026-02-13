"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class QGetRolesV4Item(BaseModel):
    """Role item returned from get endpoint."""

    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class GetRolesApiRequest(BaseModel):
    """Request for getting all roles."""

    pass


class GetRolesApiResponse(BaseModel):
    """Response for getting roles."""

    items: list[QGetRolesV4Item] | None = None


class GetRolesSqlParams(BaseModel):
    """SQL parameters for get roles (no parameters)."""

    def to_tuple(self) -> tuple[Any, ...]:
        return ()


class GetRolesSqlRow(BaseModel):
    """SQL row for get roles."""

    items: list[QGetRolesV4Item] | None = None


class SearchRolesParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    profile: bool = False
    setting: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.profile,
            self.setting,
        )
