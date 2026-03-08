"""Shared Pydantic models for entry/resource/artifact documentation."""

from typing import Any

from pydantic import BaseModel

from app.utils.docs_helper import DocsApiResponse


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


class ComposedDocsResponse(BaseModel):
    """Composed documentation for a full artifact endpoint.

    Aggregates the artifact tool docs, entry docs, resource docs,
    permission functions, and infra operations into one response.
    """

    name: str
    type: str
    description: str
    artifact: DocsResponse | None = None
    entries: list[DocsResponse]
    resources: list[DocsResponse]
    permissions: list[OperationInfo]
    api_operations: list[OperationInfo]
    page_metadata: DocsApiResponse | None = None
