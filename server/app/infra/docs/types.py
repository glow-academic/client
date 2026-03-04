"""Shared Pydantic models for entry/resource/artifact documentation."""

from typing import Any

from pydantic import BaseModel


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool


class MvInfo(BaseModel):
    name: str
    definition: str
    columns: list[ColumnInfo]


class TableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo]


class ParamInfo(BaseModel):
    name: str
    type: str
    required: bool
    default: Any | None = None


class OperationInfo(BaseModel):
    name: str
    description: str
    params: list[ParamInfo]
    returns: dict[str, Any] | None = None


class DocsResponse(BaseModel):
    name: str
    type: str
    description: str
    materialized_view: MvInfo | None = None
    tables: list[TableInfo]
    operations: list[OperationInfo]
