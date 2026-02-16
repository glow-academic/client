"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetVideoV4Item(BaseModel):
    """Video item returned from get endpoint."""

    video_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class GetVideoApiRequest(BaseModel):
    """Request for getting a video by ID."""

    id: UUID


class GetVideoApiResponse(BaseModel):
    """Response for getting a video."""

    item: GetVideoV4Item | None = None


class GetVideoSqlParams(BaseModel):
    """SQL parameters for get video."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetVideoSqlRow(BaseModel):
    """SQL row for get video."""

    items: list[GetVideoV4Item] | None = None


class SearchVideosParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    upload_ids: list[UUID] = []
    # Artifact boolean filters
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.upload_ids,
            self.scenario,
        )
