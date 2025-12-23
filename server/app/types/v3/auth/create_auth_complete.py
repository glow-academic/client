"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/auth/create_auth_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateAuthSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    name: str
    description: str
    active: bool
    items_json: dict[str, Any]
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.name,
            self.description,
            self.active,
            self.items_json,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/auth/create_auth_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateAuthSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    auth_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/auth/create_auth_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class CreateAuthApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    name: str
    description: str
    active: bool
    items_json: dict[str, Any]


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/auth/create_auth_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateAuthApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    auth_id: str
    actor_name: str
