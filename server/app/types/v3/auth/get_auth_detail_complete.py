"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """


    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/get_auth_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetAuthDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    description: str
    active: bool
    can_edit: bool
    auth_items_json: dict[str, Any]
    actor_name: str
