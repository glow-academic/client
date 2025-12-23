"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/duplicate_rubric_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DuplicateRubricSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    originalRubricId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.originalRubricId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/rubrics/duplicate_rubric_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DuplicateRubricSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    rubric_id: str
    original_name: str
    actor_name: str
