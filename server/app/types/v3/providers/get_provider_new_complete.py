"""SQL parameter model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_new_complete.sql
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetProviderNewSqlParams(BaseModel):
    """SQL parameters for query execution.

    Parameters are ordered $1, $2, ...
    """

    profileId: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert model to tuple in parameter order ($1, $2, ...)."""
        return (
            self.profileId,
        )


"""SQL response row model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_new_complete.sql
"""

from typing import Any

from pydantic import BaseModel


class GetProviderNewSqlRow(BaseModel):
    """SQL query result row.

    Columns returned by the SQL query.
    """

    provider_id: str
    name: str
    description: str
    value: str
    active: bool
    created_at: str
    updated_at: str
    base_url: str
    user_role: str
    can_edit: bool
    can_delete: bool
    actor_name: str


"""API request model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_new_complete.sql

API request model excludes profile_id (obtained from request header).
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetProviderNewApiRequest(BaseModel):
    """API request parameters.

    Excludes profile_id (obtained from request header).
    """

    profileId: UUID


"""API response model generated from SQL introspection.

Generated from: app/sql/v3/providers/get_provider_new_complete.sql

For now, identical to SQL response structure.
"""

from typing import Any

from pydantic import BaseModel


class GetProviderNewApiResponse(BaseModel):
    """API response data.

    Structure matches SQL query result.
    """

    provider_id: str
    name: str
    description: str
    value: str
    active: bool
    created_at: str
    updated_at: str
    base_url: str
    user_role: str
    can_edit: bool
    can_delete: bool
    actor_name: str
