"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_hints_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateHintsSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    message_id: UUID
    hint_texts: list[str]

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.message_id,
            self.hint_texts,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/simulations/create_hints_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateHintsSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    hint_ids: dict[str, Any]
