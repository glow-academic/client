"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/complete_document_creation_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CompleteDocumentCreationSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    parent_document_id: UUID
    file_path: str
    mime_type: str
    file_size: int
    param_5: str
    param_6: str
    param_7: UUID
    param_8: UUID
    param_9: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.parent_document_id,
            self.file_path,
            self.mime_type,
            self.file_size,
            self.param_5,
            self.param_6,
            self.param_7,
            self.param_8,
            self.param_9,
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
