"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/get_activity_by_message.sql
"""

from typing import Any

from pydantic import BaseModel


class GetActivityByMessageSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
        )


"""SQL response row model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/get_activity_by_message.sql
"""

from typing import Any

from pydantic import BaseModel


class GetActivityByMessageSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    created_at: str
    message: str
    endpoint: str
    error: bool
    id: UUID
    profile_id: UUID


"""API request model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/get_activity_by_message.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class GetActivityByMessageApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: str


"""API response model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/get_activity_by_message.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetActivityByMessageApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    created_at: str
    message: str
    endpoint: str
    error: bool
    id: UUID
    profile_id: UUID
