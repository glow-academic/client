"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/personas/delete_persona_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeletePersonaSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    persona_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.persona_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/personas/delete_persona_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeletePersonaSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    usage_count: int
    name: str
    deleted: bool
    actor_name: str
