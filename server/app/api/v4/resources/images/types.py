"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetImageV4Item(BaseModel):
    """Image item returned from get endpoint."""

    image_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class GetImageApiRequest(BaseModel):
    """Request for getting an image by ID."""

    id: UUID


class GetImageApiResponse(BaseModel):
    """Response for getting an image."""

    item: GetImageV4Item | None = None


class GetImageSqlParams(BaseModel):
    """SQL parameters for get image."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetImageSqlRow(BaseModel):
    """SQL row for get image."""

    items: list[GetImageV4Item] | None = None


class SearchImagesParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    upload_ids: list[UUID] = []
    completed: bool | None = None
    # Artifact boolean filters
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.upload_ids,
            self.completed,
            self.scenario,
        )
