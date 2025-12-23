"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/complete_document_creation_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CompleteDocumentCreationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/complete_document_creation_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CompleteDocumentCreationSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    child_document_id: str
    upload_id: str
