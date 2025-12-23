"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/delete_rubric_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteRubricSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    rubricId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.rubricId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/delete_rubric_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteRubricSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    rubric_id: str
    name: str
    usage_count: int
    deleted: bool
    actor_name: str
