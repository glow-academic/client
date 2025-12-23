"""SQL parameter model generated from SQL introspection.

Generated from: tests/sql/integration/infra/activity/get_activity_by_message.sql
"""

from typing import Any

from pydantic import BaseModel


class GetActivityByMessageSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
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
    id: str
    profile_id: str
