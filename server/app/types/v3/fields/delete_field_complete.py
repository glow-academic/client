"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/fields/delete_field_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteFieldSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    param_1: UUID
    param_2: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.param_1,
            self.param_2,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/fields/delete_field_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteFieldSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/fields/delete_field_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteFieldApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    param_1: UUID
    param_2: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/fields/delete_field_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteFieldApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    name: str
    actor_name: str
