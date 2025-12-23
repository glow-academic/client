"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/delete_auth_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteAuthSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    auth_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.auth_id,
            self.profile_id,
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
