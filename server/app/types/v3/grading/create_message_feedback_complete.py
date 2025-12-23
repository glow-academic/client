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


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_message_feedback_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateMessageFeedbackApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    grade_id: UUID
    message_id: UUID
    name: str
    description: str
    type: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/grading/create_message_feedback_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateMessageFeedbackApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    id: str
