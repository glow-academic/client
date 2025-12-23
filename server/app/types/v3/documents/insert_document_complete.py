"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/documents/insert_document_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class InsertDocumentSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    document_id: UUID
    param_2: str
    param_3: str
    param_4: UUID
    param_5: list[UUID]
    param_6: list[UUID]
    param_7: UUID
    param_8: dict[str, Any]
    param_9: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.document_id,
            self.param_2,
            self.param_3,
            self.param_4,
            self.param_5,
            self.param_6,
            self.param_7,
            self.param_8,
            self.param_9,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/documents/insert_document_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class InsertDocumentSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    document_id: str
    actor_name: str
