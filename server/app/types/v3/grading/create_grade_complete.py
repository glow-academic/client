"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_grade_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateGradeSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    run_id: UUID
    rubric_id: UUID
    description: str
    passed: bool
    score: int
    time_taken: int

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.run_id,
            self.rubric_id,
            self.description,
            self.passed,
            self.score,
            self.time_taken,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_grade_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateGradeSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
