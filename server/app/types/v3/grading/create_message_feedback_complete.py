"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_message_feedback_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateMessageFeedbackSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    grade_id: UUID
    message_id: UUID
    name: str
    description: str
    type: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.grade_id,
            self.message_id,
            self.name,
            self.description,
            self.type,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_message_feedback_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateMessageFeedbackSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    id: str
