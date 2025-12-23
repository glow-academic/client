"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/providers/create_provider_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class CreateProviderSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    name: str
    description: str
    value: str
    active: bool
    base_url: str
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.name,
            self.description,
            self.value,
            self.active,
            self.base_url,
            self.profile_id,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/providers/create_provider_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class CreateProviderSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    provider_id: str
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/providers/create_provider_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any

from pydantic import BaseModel


class CreateProviderApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    name: str
    description: str
    value: str
    active: bool
    base_url: str


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/providers/create_provider_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class CreateProviderApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    provider_id: str
    actor_name: str
