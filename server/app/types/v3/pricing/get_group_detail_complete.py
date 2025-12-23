"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_group_detail_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetGroupDetailSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    group_id: UUID
    profile_id: str

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.group_id,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_group_detail_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetGroupDetailSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    result: dict[str, Any]
