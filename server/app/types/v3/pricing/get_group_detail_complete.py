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


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_group_detail_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetGroupDetailApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    group_id: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/pricing/get_group_detail_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetGroupDetailApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    result: dict[str, Any]
