"""Names resource types — handcrafted, co-located with handler."""

from uuid import UUID

from pydantic import BaseModel, Field


class NameItem(BaseModel):
    id: UUID
    name: str
    generated: bool


# Backward-compat alias — artifact types.py files reference this name.
# TODO: migrate downstream imports to NameItem, then remove.
QGetNamesV4Item = NameItem


class GetNamesRequest(BaseModel):
    ids: list[UUID] = Field(default_factory=list)


class GetNamesResponse(BaseModel):
    items: list[NameItem] = Field(default_factory=list)


class CreateNameRequest(BaseModel):
    name: str


class CreateNameResponse(BaseModel):
    name_id: UUID
    call_id: UUID | None = None
