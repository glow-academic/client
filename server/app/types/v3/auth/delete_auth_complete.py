"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/delete_auth_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteAuthSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/delete_auth_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteAuthSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    auth_id: str
    name: str
    actor_name: str
