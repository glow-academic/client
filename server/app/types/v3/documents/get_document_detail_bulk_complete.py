"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_bulk_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetDocumentDetailBulkSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/get_document_detail_bulk_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetDocumentDetailBulkSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    types: list[str]
    department_ids: list[str]
    department_mapping: dict[str, Any]
    valid_department_ids: list[str]
    field_mapping: dict[str, Any]
    valid_field_ids: list[str]
