"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/parameters/delete_parameter_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteParameterSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    parameterId: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.parameterId,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/parameters/delete_parameter_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class DeleteParameterSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    name: str
    usage_count: int
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/parameters/delete_parameter_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class DeleteParameterApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    parameterId: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/parameters/delete_parameter_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class DeleteParameterApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    name: str
    usage_count: int
    actor_name: str
