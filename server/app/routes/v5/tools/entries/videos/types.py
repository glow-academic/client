"""Videos entry types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel


class CreateVideoResponse(BaseModel):
    id: UUID
